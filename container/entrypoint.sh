#!/bin/bash
set -e

export INSTANCE="${INSTANCE:-background}"
export DAEMON_INSTANCE="${DAEMON_INSTANCE:-${INSTANCE}}"
export DAEMON_AGENT="${DAEMON_AGENT:-${AGENT:-host}}"
export DISPLAY=:99
export PROJECT_ROOT="${PROJECT_ROOT:-/app}"
export APP_ROOT="${APP_ROOT:-${PROJECT_ROOT}}"
export AGENTS_ROOT="${AGENTS_ROOT:-${APP_ROOT}/agents}"
export SHARED_ROOT="${SHARED_ROOT:-${APP_ROOT}/shared}"
export PROJECTS_ROOT="${PROJECTS_ROOT:-${APP_ROOT}/projects}"
export STATE_DIR="${STATE_DIR:-/app/.state}"

# Match the unprivileged runtime identity to the mounted installation before
# creating state or agent configuration. This keeps local and remote hosts
# writable without recursively changing a potentially large installation.
source /usr/local/bin/setup-runtime-user.sh

# Chrome binary (arch-dependent)
export CHROME_BIN=""
[ -x /opt/google/chrome/chrome ] && export CHROME_BIN=/opt/google/chrome/chrome
[ -z "$CHROME_BIN" ] && [ -x /usr/bin/chromium ] && export CHROME_BIN=/usr/bin/chromium
mkdir -p "${STATE_DIR}/chrome-profile"
chown mayagent:mayagent "${STATE_DIR}/chrome-profile" 2>/dev/null || true

# The service owns background work and socket-based interfaces. Human Console
# processes connect through the socket; the in-process Console is only for a
# direct TTY invocation. Web remains separate so workflow or LLM work cannot
# block the dashboard event loop.
export MAY_ARGS="${MAY_ARGS:---cron --telegram --socket}"

# SSH config
mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"
if ! grep -q "StrictHostKeyChecking accept-new" "${HOME}/.ssh/config" 2>/dev/null; then
  printf "Host *\n  StrictHostKeyChecking accept-new\n" >> "${HOME}/.ssh/config"
  chmod 600 "${HOME}/.ssh/config"
fi
chown mayagent:mayagent "${HOME}/.ssh" "${HOME}/.ssh/config" 2>/dev/null || true
export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes -i ${HOME}/.ssh/id_rsa"

# Keep plain Claude launches unrestricted inside the container sandbox.
source /usr/local/bin/setup-claude-config.sh

# Configure Codex CLI to use the shared model endpoint without approval or
# sandbox prompts. This also applies when Herdr restores `codex resume`.
source /usr/local/bin/setup-codex-config.sh

# Configure Pi Coding Agent with both OpenAI Responses and Anthropic Messages.
source /usr/local/bin/setup-pi-config.sh

# Configure Gemini CLI against the same endpoint, with the container as its
# sandbox and no per-tool approval prompts.
source /usr/local/bin/setup-gemini-config.sh

[ -L "${AGENTS_ROOT}/shared" ] && rm -f "${AGENTS_ROOT}/shared"
[ -L "${SHARED_ROOT}/projects" ] && rm -f "${SHARED_ROOT}/projects"

# Install Herdr's official hooks after the agent setup scripts have updated
# their config files. The hooks record native conversation IDs so Herdr can
# resume Codex, Claude, and Pi panes after its server (or container) restarts.
if [ "$(id -u)" = "0" ] && id mayagent >/dev/null 2>&1; then
  /usr/sbin/runuser -u mayagent -- env \
    HOME="${HOME}" \
    PI_CODING_AGENT_DIR="${PI_CODING_AGENT_DIR}" \
    /usr/local/bin/setup-herdr-integrations.sh
else
  /usr/local/bin/setup-herdr-integrations.sh
fi
exec supervisord -c /etc/supervisord.conf
