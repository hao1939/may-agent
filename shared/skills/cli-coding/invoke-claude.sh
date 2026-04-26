#!/usr/bin/env bash
# invoke-claude.sh — Wrapper to invoke Claude Code CLI as a tool
# Usage: invoke-claude.sh "prompt" [max_turns] [timeout_secs]
set -euo pipefail

PROMPT="${1:?Usage: invoke-claude.sh 'prompt' [max_turns] [timeout_secs]}"
MAX_TURNS="${2:-3}"
TIMEOUT="${3:-120}"

# Pre-flight: check proxy connectivity (claude is configured to use litellm proxy)
PROXY_URL="${ANTHROPIC_BASE_URL:-http://litellm:4000}"
if ! curl -sf -m 3 "$PROXY_URL/health" >/dev/null 2>&1; then
    echo "ERROR: Claude CLI proxy ($PROXY_URL) is not reachable." >&2
    echo "The Claude CLI is configured to route through litellm. Ensure the proxy is running." >&2
    exit 2
fi

# Invoke claude in print (non-interactive) mode
timeout "$TIMEOUT" claude -p "$PROMPT" --max-turns "$MAX_TURNS" --output-format json 2>/tmp/claude-invoke-err.txt
EXIT_CODE=$?

if [ $EXIT_CODE -eq 124 ]; then
    echo "ERROR: Claude CLI timed out after ${TIMEOUT}s" >&2
    cat /tmp/claude-invoke-err.txt >&2
    exit 124
fi
exit $EXIT_CODE
