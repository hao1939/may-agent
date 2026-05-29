#!/bin/bash
set -e

export INSTANCE="${INSTANCE:-background}"
export DAEMON_INSTANCE="${DAEMON_INSTANCE:-${INSTANCE}}"
export DAEMON_AGENT="${DAEMON_AGENT:-may}"
export DISPLAY=:99
export PROJECT_ROOT="${PROJECT_ROOT:-/app}"
export APP_ROOT="${APP_ROOT:-${PROJECT_ROOT}}"
export AGENTS_ROOT="${AGENTS_ROOT:-${APP_ROOT}/agents}"
export SHARED_ROOT="${SHARED_ROOT:-${APP_ROOT}/shared}"
export PROJECTS_ROOT="${PROJECTS_ROOT:-${APP_ROOT}/projects}"
export STATE_DIR="${STATE_DIR:-/app/.state}"

# Chrome binary (arch-dependent)
export CHROME_BIN=""
[ -x /opt/google/chrome/chrome ] && export CHROME_BIN=/opt/google/chrome/chrome
[ -z "$CHROME_BIN" ] && [ -x /usr/bin/chromium ] && export CHROME_BIN=/usr/bin/chromium
mkdir -p "${STATE_DIR}/chrome-profile"

# may-agent args for supervisord. Web runs in a separate process so workflow
# or LLM work cannot block the dashboard event loop.
export MAY_ARGS="${MAY_ARGS:---chat --cron --telegram --console --socket}"

# SSH config
mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"
if ! grep -q "StrictHostKeyChecking accept-new" "${HOME}/.ssh/config" 2>/dev/null; then
  printf "Host *\n  StrictHostKeyChecking accept-new\n" >> "${HOME}/.ssh/config"
  chmod 600 "${HOME}/.ssh/config"
fi
export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes -i ${HOME}/.ssh/id_rsa"

# Add host node bin to PATH for CLI coding agents (claude, codex, gemini)
for d in /home/hao/.nvm/versions/node/*/bin; do [ -d "$d" ] && export PATH="$d:$PATH" && break; done

# Codex CLI config (route through litellm)
source /usr/local/bin/setup-codex-config.sh

# Ensure mount roots are writable by mayagent (uid 1000) without walking the
# whole state tree on every boot. Recursive chown makes restarts scale with
# session history size and can block the Web UI from starting for a long time.
mkdir -p "${STATE_DIR}" "${AGENTS_ROOT}" "${PROJECTS_ROOT}" "${SHARED_ROOT}"
[ -L "${AGENTS_ROOT}/shared" ] && rm -f "${AGENTS_ROOT}/shared"
[ -L "${SHARED_ROOT}/projects" ] && rm -f "${SHARED_ROOT}/projects"
for path in "${STATE_DIR}" "${STATE_DIR}/chrome-profile" "${AGENTS_ROOT}" "${PROJECTS_ROOT}" "${SHARED_ROOT}"; do
  if [ -e "$path" ] && [ "$(stat -c '%u:%g' "$path" 2>/dev/null)" != "1000:1000" ]; then
    chown mayagent:mayagent "$path" 2>/dev/null || true
  fi
done
exec supervisord -c /etc/supervisord.conf
