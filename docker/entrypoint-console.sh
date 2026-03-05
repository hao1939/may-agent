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

# Run may-agent as foreground process with restart loop.
# To restart may-agent without killing the container:
#   docker exec <container> /usr/local/bin/restart-may.sh
export SCHEDULERS=1

# Track whether we should exit (container shutdown) vs restart (agent restart).
# Docker sends SIGTERM to PID 1 for container stop — we must not restart in that case.
SHUTTING_DOWN=0
trap 'SHUTTING_DOWN=1' SIGTERM SIGINT

while true; do
  echo "[$(date)] Starting may-agent..."
  tsx run/may.ts && EXIT_CODE=0 || EXIT_CODE=$?

  if [ "$SHUTTING_DOWN" -eq 1 ]; then
    echo "[$(date)] Container shutting down."
    exit 0
  fi

  if [ $EXIT_CODE -eq 0 ]; then
    echo "[$(date)] Clean exit."
    exit 0
  fi

  echo "[$(date)] may-agent exited ($EXIT_CODE). Restarting in 2s..."
  sleep 2
done
