#!/bin/sh
set -eu

export HOME="${HOME:-/var/lib/mayagent}"
state_dir="${STATE_DIR:-/app/.state}"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-${HOME}/.config}"
export XDG_STATE_HOME="${XDG_STATE_HOME:-${state_dir}/cli-state/herdr/state}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/may-herdr-runtime}"

mkdir -p "${XDG_CONFIG_HOME}/herdr" "${XDG_STATE_HOME}" "${XDG_RUNTIME_DIR}"
chmod 700 "${XDG_RUNTIME_DIR}" 2>/dev/null || true

if [ ! -f "${XDG_CONFIG_HOME}/herdr/config.toml" ]; then
  cat > "${XDG_CONFIG_HOME}/herdr/config.toml" <<'EOF'
resume_agents_on_restore = true
EOF
fi

exec /usr/local/bin/herdr "$@"
