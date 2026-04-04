#!/bin/bash
set -e

# Source env file
[ -f ${PROJECT_ROOT:-.}/.env ] && export $(grep -v "^#" ${PROJECT_ROOT:-.}/.env | xargs)

# Default to "background" instance name to avoid conflict with interactive "default" sessions
export INSTANCE="${INSTANCE:-background}"

# ── Resolve env vars for supervisord.conf ─────────────────────────────────

export DISPLAY_NUM="${DISPLAY_NUM:-99}"
export SCREEN_RESOLUTION="${SCREEN_RESOLUTION:-1920x1080x24}"
export VNC_PORT="${VNC_PORT:-5900}"
export NOVNC_PORT="${NOVNC_PORT:-6080}"
export WEB_PORT="${WEB_PORT:-8080}"
export STATE_DIR="${STATE_DIR:-/app/.state}"
export DISPLAY=":${DISPLAY_NUM}"

# Chrome binary (arch-dependent)
export CHROME_BIN=""
[ -x /opt/google/chrome/chrome ] && export CHROME_BIN=/opt/google/chrome/chrome
[ -z "$CHROME_BIN" ] && [ -x /usr/bin/chromium ] && export CHROME_BIN=/usr/bin/chromium
mkdir -p /app/.state/chrome-profile

# Web UI binary: prefer bind-mounted bundle, fall back to baked-in
export WEB_BIN="${PROJECT_ROOT:-/app}/bundle/may-agent-web"
[ -x "$WEB_BIN" ] || export WEB_BIN=/usr/local/bin/may-agent-web

# may-agent binary: prefer bind-mounted bundle, fall back to baked-in
export MAY_BIN="${PROJECT_ROOT:-/app}/bundle/may-agent"
[ -x "$MAY_BIN" ] || export MAY_BIN=/usr/local/bin/may-agent
export MAY_ARGS="--chat --cron --telegram --console --socket"

# ── SSH config ────────────────────────────────────────────────────────────

mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"
if ! grep -q "StrictHostKeyChecking accept-new" "${HOME}/.ssh/config" 2>/dev/null; then
  printf "Host *\n  StrictHostKeyChecking accept-new\n" >> "${HOME}/.ssh/config"
  chmod 600 "${HOME}/.ssh/config"
fi

# Force SSH to use the right key, accept new host keys, and never prompt.
# Prevents SIGTTIN when git spawns SSH under supervisord (no TTY available).
export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes -i ${HOME}/.ssh/id_rsa"

# Add host node bin to PATH for CLI coding agents (claude, codex, gemini)
for d in /home/example-user/.nvm/versions/node/*/bin; do [ -d "$d" ] && export PATH="$d:$PATH" && break; done

# ── Start all services via supervisord ────────────────────────────────────
# Prefer bind-mounted config (dev hot-reload), fall back to baked-in
SUPERVISORD_CONF="${PROJECT_ROOT:-/app}/container/supervisord.conf"
[ -f "$SUPERVISORD_CONF" ] || SUPERVISORD_CONF=/etc/supervisord.conf

exec supervisord -c "$SUPERVISORD_CONF"
