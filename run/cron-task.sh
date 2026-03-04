#!/bin/bash
# cron-task.sh — run a task as an ephemeral agent session via socket
#
# Usage: ./run/cron-task.sh <agent> <message>
#   e.g.: ./run/cron-task.sh bob "Run meta-loop: evaluate recent sessions..."
#
# Sends a {"type":"run"} command to the agent's socket, creating an
# ephemeral session. The agent must be running (socket must exist).
# No-op if the socket doesn't exist.

set -euo pipefail

AGENT="${1:?Usage: cron-task.sh <agent> <message>}"
MESSAGE="${2:?Usage: cron-task.sh <agent> <message>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
STATE_DIR="${STATE_DIR:-${PROJECT_ROOT}/.state}"
SOCKET="${STATE_DIR}/${AGENT}.sock"

if [ ! -S "$SOCKET" ]; then
    echo "[cron-task] ${AGENT} not running (no socket at ${SOCKET}), skipping."
    exit 0
fi

# Escape message for JSON (handle newlines and quotes)
JSON_MESSAGE=$(printf '%s' "$MESSAGE" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')

printf '{"type":"run","agent":"%s","message":%s}\n' "$AGENT" "$JSON_MESSAGE" \
    | socat -t5 - UNIX-CONNECT:"$SOCKET" 2>/dev/null \
    | head -3

echo "[cron-task] Started ephemeral ${AGENT} session: ${MESSAGE:0:80}"
