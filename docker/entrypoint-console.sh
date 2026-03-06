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

# Start Chrome
google-chrome --no-sandbox --disable-gpu --no-first-run --disable-dev-shm-usage --start-maximized --user-data-dir=/tmp/chrome-profile &>/dev/null &

# Run may-agent via launcher (handles crash recovery + hot-reload).
# To restart may-agent without killing the container:
#   docker exec <container> /usr/local/bin/restart-may.sh
export SCHEDULERS=1

# Launcher handles signals, backoff, and exit codes — no bash loop needed
exec tsx run/launcher.ts --keep-session --cron --telegram --openclaw --console
