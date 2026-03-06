#!/bin/bash
# restart-may.sh — restart may-agent inside the container without killing the container.
#
# Three strategies, tried in order:
#   1. Socket: send {"type":"restart"} → may.ts exits 100 → launcher respawns
#   2. Kill may.ts child: launcher sees crash, respawns with backoff
#   3. supervisorctl: restart the whole launcher (last resort)
#
# Usage:
#   docker exec <container> restart-may.sh
#   docker exec <container> restart-may.sh --force   # skip socket, kill directly

set -e

FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

STATE="${STATE_DIR:-/app/.state}"
SOCK_PATH="${STATE}/instances/${INSTANCE:-default}/may.sock"

# ── Strategy 1: Socket restart (preferred) ────────────────────────────────
if [ "$FORCE" -eq 0 ] && [ -S "$SOCK_PATH" ]; then
  echo "Sending restart via socket ($SOCK_PATH)..."
  if echo '{"type":"restart"}' | socat -t2 - UNIX-CONNECT:"$SOCK_PATH" 2>/dev/null; then
    echo "✅ Restart command sent. Launcher will respawn with fresh code."
    exit 0
  fi
  echo "Socket send failed. Trying fallback..."
fi

# ── Strategy 2: Kill the may.ts child process ─────────────────────────────
# The launcher stays alive and respawns may.ts
MAY_PID=$(pgrep -f "run/may\.ts" | head -1)
if [ -n "$MAY_PID" ]; then
  echo "Killing may.ts (PID $MAY_PID). Launcher will respawn..."
  kill "$MAY_PID"
  # Wait for clean exit
  for i in $(seq 1 5); do
    if ! kill -0 "$MAY_PID" 2>/dev/null; then
      echo "✅ may.ts stopped. Launcher will respawn."
      exit 0
    fi
    sleep 1
  done
  echo "Still alive after 5s, sending SIGKILL..."
  kill -9 "$MAY_PID" 2>/dev/null || true
  echo "✅ may.ts killed. Launcher will respawn."
  exit 0
fi

# ── Strategy 3: supervisorctl (last resort) ────────────────────────────────
if pgrep -x supervisord >/dev/null 2>&1; then
  echo "No may.ts process found. Restarting launcher via supervisord..."
  supervisorctl -c /tmp/supervisord.conf restart may-agent
  echo "✅ Launcher restarted via supervisord."
  exit 0
fi

echo "❌ Could not find may.ts process or supervisord. Is the agent running?"
exit 1
