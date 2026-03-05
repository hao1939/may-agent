#!/bin/bash
# restart-may.sh — restart may-agent inside the container without killing the container.
#
# For supervisord entrypoint: uses supervisorctl to restart the may-agent program.
# For console entrypoint: kills the tsx process; the restart loop respawns it.
#
# Usage: docker exec may-agent /usr/local/bin/restart-may.sh

set -e

if pgrep -x supervisord >/dev/null 2>&1; then
  echo "Restarting via supervisord..."
  supervisorctl -c /tmp/supervisord.conf restart may-agent
else
  # Console entrypoint — find and kill the tsx/node process running may.ts.
  # The restart loop in entrypoint-console.sh will respawn it.
  MAY_PID=$(pgrep -f "run/may\.ts" | head -1)
  if [ -z "$MAY_PID" ]; then
    echo "may-agent process not found."
    exit 1
  fi
  echo "Killing may-agent (PID $MAY_PID), restart loop will respawn..."
  kill "$MAY_PID"
  # Wait briefly to confirm it died
  sleep 1
  if kill -0 "$MAY_PID" 2>/dev/null; then
    echo "Still alive, sending SIGKILL..."
    kill -9 "$MAY_PID" 2>/dev/null || true
  fi
  echo "Done."
fi
