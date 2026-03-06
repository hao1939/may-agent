#!/bin/bash
# restart-may.sh — restart may-agent inside the container without killing the container.
#
# Sends a restart command via the Unix socket. The may.ts process exits with
# code 100 (hot-reload), and the launcher respawns it immediately with fresh code.
#
# Fallback: if socket is unavailable, kills the process directly.
# The launcher (or supervisord) will respawn it.
#
# Usage: docker exec may-agent /usr/local/bin/restart-may.sh

set -e

SOCK_PATH="${STATE_DIR:-.state}/instances/${INSTANCE:-default}/may.sock"

# Try socket restart first (clean, preferred)
if [ -S "$SOCK_PATH" ]; then
  echo "Sending restart command via $SOCK_PATH..."
  echo '{"type":"restart"}' | socat - UNIX-CONNECT:"$SOCK_PATH" 2>/dev/null && {
    echo "Restart command sent. Launcher will respawn with fresh code."
    exit 0
  }
fi

echo "Socket not available. Falling back to process kill..."

if pgrep -x supervisord >/dev/null 2>&1; then
  echo "Restarting via supervisord..."
  supervisorctl -c /tmp/supervisord.conf restart may-agent
else
  # Find and kill the may.ts process. Launcher will respawn it.
  MAY_PID=$(pgrep -f "run/may\.ts" | head -1)
  if [ -z "$MAY_PID" ]; then
    echo "may-agent process not found."
    exit 1
  fi
  echo "Killing may-agent (PID $MAY_PID), launcher will respawn..."
  kill "$MAY_PID"
  sleep 1
  if kill -0 "$MAY_PID" 2>/dev/null; then
    echo "Still alive, sending SIGKILL..."
    kill -9 "$MAY_PID" 2>/dev/null || true
  fi
  echo "Done."
fi
