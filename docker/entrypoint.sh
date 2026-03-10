#!/bin/bash
set -e

# Source env file
[ -f ${PROJECT_ROOT:-.}/.env ] && export $(grep -v "^#" ${PROJECT_ROOT:-.}/.env | xargs)

DISPLAY_NUM=${DISPLAY_NUM:-99}
SCREEN_RES=${SCREEN_RESOLUTION:-1920x1080x24}
VNC_PORT=${VNC_PORT:-5900}
NOVNC_PORT=${NOVNC_PORT:-6080}

export DISPLAY=":${DISPLAY_NUM}"

# Start virtual display
Xvfb :${DISPLAY_NUM} -screen 0 ${SCREEN_RES} -ac +extension GLX +render -noreset &>/dev/null &
sleep 1

# Start window manager
fluxbox &>/dev/null &

# Start VNC server
x11vnc -display :${DISPLAY_NUM} -forever -shared -rfbport ${VNC_PORT} -nopw -quiet -xkb -noxrecord -noxfixes -noxdamage &>/dev/null &

# Start noVNC web client
websockify --web /usr/share/novnc ${NOVNC_PORT} localhost:${VNC_PORT} &>/dev/null &

# Start Chrome (call binary directly to avoid wrapper info bar noise)
/opt/google/chrome/chrome --no-sandbox --disable-gpu --no-first-run --disable-dev-shm-usage --start-maximized --user-data-dir=/tmp/chrome-profile &>/dev/null &

# Launcher is the supervisor — handles crash recovery, hot-reload (exit 100), backoff.
# To restart agent without restarting container:
#   docker exec <container> restart-may.sh
exec tsx src/app/launcher.ts --chat --cron --telegram --console --socket
