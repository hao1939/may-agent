#!/bin/bash
# run.sh — keep may-agent alive across crashes
# The interface agent's session is persistent (append-only JSONL),
# so resumeAgent() picks up exactly where it left off after a restart.
#
# Usage: ./run.sh [--agent <name>]
#   AGENT env var or --agent flag selects the interface agent (default: may)
#
# Exit code 0 = clean exit (user typed "exit"/"quit", or SIGINT/SIGTERM)
# Any other code = crash — restart after a brief delay.

cd "$(dirname "$0")"

while true; do
    echo "[$(date)] Starting may-agent..."
    npx tsx run/may.ts "$@"
    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
        echo "[$(date)] Clean exit."
        break
    fi

    echo "[$(date)] Crashed with exit code $EXIT_CODE. Restarting in 3s..."
    sleep 3
done
