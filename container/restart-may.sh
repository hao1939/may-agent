#!/bin/bash
# restart-may.sh — restart may-agent inside the container without killing the container.
#
# Three strategies, tried in order:
#   1. Socket: send {"type":"restart"} → may.ts exits 100 → launcher respawns
#   2. supervisorctl: ask supervisord to restart the may-agent program
#   3. Kill may.ts via PID file: launcher sees exit, respawns
#
# Usage:
#   docker exec <container> restart-may.sh
#   docker exec <container> restart-may.sh --force   # skip socket, use supervisorctl directly

set -e

FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

STATE="${STATE_DIR:-/app/.state}"
INST="${INSTANCE:-default}"
INST_DIR="${STATE}/instances/${INST}"
SOCK_PATH="${INST_DIR}/may.sock"
PID_FILE="${INST_DIR}/may.pid"

# ── Strategy 1: Socket restart (preferred, clean hot-reload) ──────────────
if [ "$FORCE" -eq 0 ] && [ -S "$SOCK_PATH" ]; then
  echo "Sending restart via socket ($SOCK_PATH)..."
  if echo '{"type":"restart"}' | socat -t2 - UNIX-CONNECT:"$SOCK_PATH" 2>/dev/null; then
    echo "Restart command sent. Launcher will respawn with fresh code."
    exit 0
  fi
  echo "Socket send failed. Trying fallback..."
fi

# ── Strategy 2: supervisorctl ─────────────────────────────────────────────
if command -v supervisorctl &>/dev/null; then
  echo "Restarting may-agent via supervisorctl..."
  if supervisorctl restart may-agent 2>/dev/null; then
    echo "may-agent restarted via supervisord."
    exit 0
  fi
  echo "supervisorctl failed. Trying PID fallback..."
fi

# ── Strategy 3: Kill may.ts via PID file ──────────────────────────────────
if [ -f "$PID_FILE" ]; then
  MAY_PID=$(cat "$PID_FILE")
  if kill -0 "$MAY_PID" 2>/dev/null; then
    echo "Killing may.ts (PID $MAY_PID). Launcher will respawn..."
    kill "$MAY_PID"
    for i in $(seq 1 5); do
      if ! kill -0 "$MAY_PID" 2>/dev/null; then
        echo "may.ts stopped. Launcher will respawn."
        exit 0
      fi
      sleep 1
    done
    echo "Still alive after 5s, sending SIGKILL..."
    kill -9 "$MAY_PID" 2>/dev/null || true
    echo "may.ts killed. Launcher will respawn."
    exit 0
  fi
  echo "PID $MAY_PID from $PID_FILE is stale."
fi

echo "Could not find may.ts process. Is the agent running?"
exit 1
