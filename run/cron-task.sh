#!/bin/bash
# cron-task.sh — send a task to a running agent via its socket
#
# Usage: ./run/cron-task.sh <agent> <message>
#   e.g.: ./run/cron-task.sh bob "Run meta-loop: evaluate recent sessions..."
#
# Sends a JSON input command to the agent's socket.
# No-op if the agent isn't running (socket doesn't exist).

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

printf '{"type":"input","message":%s}\n' "$JSON_MESSAGE" \
    | socat -t5 - UNIX-CONNECT:"$SOCKET" 2>/dev/null \
    | head -3

echo "[cron-task] Sent task to ${AGENT}: ${MESSAGE:0:80}"
