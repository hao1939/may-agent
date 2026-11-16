#!/bin/bash
set -e

# Services and docker exec share the image's root identity.
[ "$(id -u)" = "0" ] || { echo "May container must run as root." >&2; exit 1; }

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
export HOME="${HOME:-/root}"
export PI_CODING_AGENT_DIR="${PI_CODING_AGENT_DIR:-${HOME}/.pi/agent}"
export MODEL_BASE_URL="${MODEL_BASE_URL:-http://host.docker.internal:4000}"
export MODEL_API_KEY="${MODEL_API_KEY:-not-needed}"
export GEMINI_API_KEY="${GEMINI_API_KEY:-${MODEL_API_KEY}}"
export GOOGLE_GEMINI_BASE_URL="${GOOGLE_GEMINI_BASE_URL:-${MODEL_BASE_URL%/}}"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-${HOME}/.config}"
export XDG_STATE_HOME="${XDG_STATE_HOME:-${STATE_DIR}/cli-state/herdr/state}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/may-herdr-runtime}"
export HERDR_SESSION="${HERDR_SESSION:-may-terminal2}"
export PI_CLIPBOARD_OSC52="${PI_CLIPBOARD_OSC52:-1}"

# Preserve mounted ownership; root needs no UID/GID remapping or chown pass.
mkdir -p \
  "${PROJECT_ROOT}" "${STATE_DIR}" "${AGENTS_ROOT}" "${PROJECTS_ROOT}" "${SHARED_ROOT}" \
  "${STATE_DIR}/runtime-logs" "${STATE_DIR}/chrome-profile" "${HOME}" "${XDG_RUNTIME_DIR}"
chmod 700 "${XDG_RUNTIME_DIR}" 2>/dev/null || true
for path in "${PROJECT_ROOT}" "${STATE_DIR}" "${AGENTS_ROOT}" "${PROJECTS_ROOT}" "${SHARED_ROOT}" "${HOME}"; do
  if ! test -r "${path}" -a -w "${path}" -a -x "${path}"; then
    echo "May container cannot use ${path}; provide a writable installation." >&2
    exit 1
  fi
done

# Refresh native CLI config and link durable histories using the same identity.
/usr/local/bin/node /usr/local/bin/configure-runtime.cjs

export CHROME_BIN=""
[ -x /opt/google/chrome/chrome ] && export CHROME_BIN=/opt/google/chrome/chrome
[ -z "$CHROME_BIN" ] && [ -x /usr/bin/chromium ] && export CHROME_BIN=/usr/bin/chromium
export MAY_ARGS="${MAY_ARGS:---cron --telegram --socket}"
export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes -i ${HOME}/.ssh/id_rsa"

[ -L "${AGENTS_ROOT}/shared" ] && rm -f "${AGENTS_ROOT}/shared"
[ -L "${SHARED_ROOT}/projects" ] && rm -f "${SHARED_ROOT}/projects"

if [ "$#" -gt 0 ]; then
  exec "$@"
fi
exec supervisord -c /etc/supervisord.conf
