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
export HOME="${HOME:-/var/lib/mayagent}"
export PI_CODING_AGENT_DIR="${PI_CODING_AGENT_DIR:-${HOME}/.pi/agent}"
export MODEL_BASE_URL="${MODEL_BASE_URL:-http://host.docker.internal:4000}"
export MODEL_API_KEY="${MODEL_API_KEY:-not-needed}"
export GEMINI_API_KEY="${GEMINI_API_KEY:-${MODEL_API_KEY}}"
export GOOGLE_GEMINI_BASE_URL="${GOOGLE_GEMINI_BASE_URL:-${MODEL_BASE_URL%/}}"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-${HOME}/.config}"
export XDG_STATE_HOME="${XDG_STATE_HOME:-${STATE_DIR}/cli-state/herdr/state}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/may-herdr-runtime}"

# 1. Select one identity for services and their terminal/agent children.
runtime_user="${MAY_RUNTIME_USER:-mayagent}"
case "${runtime_user}" in
  root|mayagent) ;;
  *) echo "MAY_RUNTIME_USER must be root or mayagent." >&2; exit 1 ;;
esac
export MAY_RUNTIME_USER="${runtime_user}"

if [ "${runtime_user}" = "root" ]; then
  [ "$(id -u)" = "0" ] || { echo "Root runtime requires starting the container as root." >&2; exit 1; }
  # Never remap the root account or chown the installation to root. Existing
  # mount-owner UID/GID settings apply only to the unprivileged runtime.
  export MAY_RUNTIME_UID=0
  export MAY_RUNTIME_GID=0
else
  # Align the unprivileged identity to the mounted projects before writing state.
  ownership_path="${MAY_RUNTIME_OWNERSHIP_PATH:-${PROJECTS_ROOT}}"
  [ -e "${ownership_path}" ] || ownership_path="${PROJECT_ROOT}"
  configured_uid="${MAY_RUNTIME_UID:-}"
  configured_gid="${MAY_RUNTIME_GID:-}"
  [ -z "${configured_uid}" ] && [ -e "${ownership_path}" ] && configured_uid="$(stat -c '%u' "${ownership_path}")"
  [ -z "${configured_gid}" ] && [ -e "${ownership_path}" ] && configured_gid="$(stat -c '%g' "${ownership_path}")"
  [ -n "${configured_uid}" ] && [ "${configured_uid}" != "0" ] || configured_uid="$(id -u "${runtime_user}")"
  [ -n "${configured_gid}" ] && [ "${configured_gid}" != "0" ] || configured_gid="$(id -g "${runtime_user}")"

  case "${configured_uid}" in *[!0-9]*|'') echo "Invalid May runtime uid: ${configured_uid}" >&2; exit 1 ;; esac
  case "${configured_gid}" in *[!0-9]*|'') echo "Invalid May runtime gid: ${configured_gid}" >&2; exit 1 ;; esac

  if [ "$(id -u)" = "0" ]; then
    current_uid="$(id -u "${runtime_user}")"
    current_gid="$(id -g "${runtime_user}")"
    if [ "${current_gid}" != "${configured_gid}" ]; then
      /usr/sbin/groupmod --non-unique --gid "${configured_gid}" "${runtime_user}"
    fi
    if [ "${current_uid}" != "${configured_uid}" ] || [ "${current_gid}" != "${configured_gid}" ]; then
      /usr/sbin/usermod --non-unique --uid "${configured_uid}" --gid "${configured_gid}" "${runtime_user}"
    fi
  elif [ "$(id -u)" != "${configured_uid}" ] || [ "$(id -g)" != "${configured_gid}" ]; then
    echo "May runtime is already non-root as $(id -u):$(id -g), but mounted ownership requires ${configured_uid}:${configured_gid}." >&2
    exit 1
  fi
  export MAY_RUNTIME_UID="${configured_uid}"
  export MAY_RUNTIME_GID="${configured_gid}"
fi

mkdir -p \
  "${PROJECT_ROOT}" "${STATE_DIR}" "${AGENTS_ROOT}" "${PROJECTS_ROOT}" "${SHARED_ROOT}" \
  "${STATE_DIR}/runtime-logs" "${STATE_DIR}/chrome-profile" "${HOME}" "${XDG_RUNTIME_DIR}"
chmod 700 "${XDG_RUNTIME_DIR}" 2>/dev/null || true

if [ "$(id -u)" = "0" ] && [ "${runtime_user}" != "root" ]; then
  chown "${runtime_user}:${runtime_user}" \
    "${PROJECT_ROOT}" "${STATE_DIR}" "${AGENTS_ROOT}" "${PROJECTS_ROOT}" "${SHARED_ROOT}" \
    "${STATE_DIR}/runtime-logs" "${STATE_DIR}/chrome-profile" "${XDG_RUNTIME_DIR}" 2>/dev/null || true
  chown -R "${runtime_user}:${runtime_user}" "${STATE_DIR}/runtime-logs" 2>/dev/null || true
  [ "${HOME}" = "/var/lib/mayagent" ] && chown -R "${runtime_user}:${runtime_user}" "${HOME}" 2>/dev/null || true
  # Repair any root-owned Chrome profile files left by older images where Chrome ran as root.
  if find "${STATE_DIR}/chrome-profile" -mindepth 1 -maxdepth 2 -user 0 -print -quit 2>/dev/null | grep -q .; then
    chown -R "${runtime_user}:${runtime_user}" "${STATE_DIR}/chrome-profile" 2>/dev/null || true
  fi
  path_accessible() { /usr/sbin/runuser -u "${runtime_user}" -- test -r "$1" -a -w "$1" -a -x "$1"; }
else
  path_accessible() { test -r "$1" -a -w "$1" -a -x "$1"; }
fi

for path in "${PROJECT_ROOT}" "${STATE_DIR}" "${AGENTS_ROOT}" "${PROJECTS_ROOT}" "${SHARED_ROOT}" "${HOME}"; do
  if ! path_accessible "${path}"; then
    echo "May runtime user ${runtime_user} (${configured_uid}:${configured_gid}) cannot use ${path}. Set MAY_RUNTIME_UID/MAY_RUNTIME_GID to the mounted installation owner." >&2
    exit 1
  fi
done

# 2. Refresh CLI endpoint/model configs (if overridden via env) & link durable /app/.state histories.
if [ "$(id -u)" = "0" ] && [ "${runtime_user}" != "root" ]; then
  # Ensure any legacy state dirs under /app/.state are readable before running as mayagent.
  for legacy in .ssh ssh herdr .codex .pi .gemini .claude; do
    [ -e "${STATE_DIR}/${legacy}" ] && chown -R "${runtime_user}:${runtime_user}" "${STATE_DIR}/${legacy}" 2>/dev/null || true
  done
  /usr/sbin/runuser -u "${runtime_user}" -- /usr/local/bin/node /usr/local/bin/configure-runtime.cjs
else
  /usr/local/bin/node /usr/local/bin/configure-runtime.cjs
fi

# 3. Export runtime environment for supervisord and interactive shells (`docker exec`).
if [ "$(id -u)" = "0" ] && [ -d /etc/profile.d ]; then
  cat > /etc/profile.d/may-agent-env.sh <<EOF
export PATH="/usr/local/bin:\${PATH}"
export HOME="\${HOME:-${HOME}}"
export PI_CODING_AGENT_DIR="\${PI_CODING_AGENT_DIR:-${PI_CODING_AGENT_DIR}}"
export MODEL_BASE_URL="\${MODEL_BASE_URL:-${MODEL_BASE_URL}}"
export MODEL_API_KEY="\${MODEL_API_KEY:-not-needed}"
export GEMINI_API_KEY="\${GEMINI_API_KEY:-\${MODEL_API_KEY}}"
export GOOGLE_GEMINI_BASE_URL="\${GOOGLE_GEMINI_BASE_URL:-${GOOGLE_GEMINI_BASE_URL}}"
export XDG_CONFIG_HOME="\${XDG_CONFIG_HOME:-${XDG_CONFIG_HOME}}"
export XDG_STATE_HOME="\${XDG_STATE_HOME:-${XDG_STATE_HOME}}"
export XDG_RUNTIME_DIR="\${XDG_RUNTIME_DIR:-${XDG_RUNTIME_DIR}}"
EOF
  chmod 644 /etc/profile.d/may-agent-env.sh
fi
export CHROME_BIN=""
[ -x /opt/google/chrome/chrome ] && export CHROME_BIN=/opt/google/chrome/chrome
[ -z "$CHROME_BIN" ] && [ -x /usr/bin/chromium ] && export CHROME_BIN=/usr/bin/chromium
export MAY_ARGS="${MAY_ARGS:---cron --telegram --socket}"
export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes -i ${HOME}/.ssh/id_rsa"

[ -L "${AGENTS_ROOT}/shared" ] && rm -f "${AGENTS_ROOT}/shared"
[ -L "${SHARED_ROOT}/projects" ] && rm -f "${SHARED_ROOT}/projects"

if [ "$#" -gt 0 ]; then
  if [ "$(id -u)" = "0" ] && [ "${runtime_user}" != "root" ]; then
    exec /usr/sbin/runuser -u "${runtime_user}" -- "$@"
  fi
  exec "$@"
fi

exec supervisord -c /etc/supervisord.conf
