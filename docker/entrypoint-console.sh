#!/bin/bash
set -e

DISPLAY_NUM=${DISPLAY_NUM:-99}
SCREEN_RES=${SCREEN_RESOLUTION:-1920x1080x24}
VNC_PORT=${VNC_PORT:-5900}
NOVNC_PORT=${NOVNC_PORT:-6080}

# Start virtual display
Xvfb :${DISPLAY_NUM} -screen 0 ${SCREEN_RES} -ac +extension GLX +render -noreset &>/dev/null &
sleep 1

# Start window manager
fluxbox &>/dev/null &

# Start VNC server
x11vnc -display :${DISPLAY_NUM} -forever -shared -rfbport ${VNC_PORT} -nopw -quiet -xkb -noxrecord -noxfixes -noxdamage &>/dev/null &

# Start noVNC web client
websockify --web /usr/share/novnc ${NOVNC_PORT} localhost:${VNC_PORT} &>/dev/null &

# Start Chrome/Chromium (use whichever is installed)
CHROME=""
[ -x /opt/google/chrome/chrome ] && CHROME=/opt/google/chrome/chrome
[ -z "$CHROME" ] && [ -x /usr/bin/chromium ] && CHROME=/usr/bin/chromium
mkdir -p /app/.state/chrome-profile
"$CHROME" --no-sandbox --disable-gpu --no-first-run --disable-dev-shm-usage --start-maximized --remote-debugging-port=9222 --user-data-dir=/app/.state/chrome-profile &>/tmp/chrome.log &

# Run may-agent via launcher (handles crash recovery + hot-reload).
# To restart may-agent without killing the container:
#   docker exec <container> /usr/local/bin/restart-may.sh

# Pre-populate SSH known_hosts for git remotes (prevents interactive prompt blocking agents)
if command -v ssh-keyscan >/dev/null 2>&1; then
  mkdir -p "${HOME}/.ssh"
  for host in $(cd /app/agents 2>/dev/null && git remote -v 2>/dev/null | grep -oP '@\K[^:/]+' | sort -u); do
    grep -q "$host" "${HOME}/.ssh/known_hosts" 2>/dev/null || ssh-keyscan "$host" >> "${HOME}/.ssh/known_hosts" 2>/dev/null
  done
fi

# Launcher handles signals, backoff, and exit codes — no bash loop needed
# Add host node bin to PATH for CLI coding agents (claude, codex, gemini)
for d in /home/hao/.nvm/versions/node/*/bin; do [ -d "$d" ] && export PATH="$d:$PATH" && break; done

# Start web UI in background (reads DB + connects to socket)
WEB_BIN="${PROJECT_ROOT:-/app}/bundle/may-agent-web"
[ -x "$WEB_BIN" ] || WEB_BIN=/usr/local/bin/may-agent-web
if [ -x "$WEB_BIN" ]; then
  "$WEB_BIN" --state-dir "${STATE_DIR:-/app/.state}" --port "${WEB_PORT:-8080}" &
  echo "Web UI started on port ${WEB_PORT:-8080}"
fi

# Prefer bind-mounted binary (dev hot-reload), fall back to baked-in
MAY_BIN="${PROJECT_ROOT:-/app}/bundle/may-agent"
[ -x "$MAY_BIN" ] || MAY_BIN=/usr/local/bin/may-agent
exec "$MAY_BIN" --chat --cron --telegram --console --socket
