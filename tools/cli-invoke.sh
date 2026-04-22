#!/bin/bash
# cli-invoke.sh — Invoke a production agent CLI (Claude Code, Gemini CLI, OpenAI Codex)
# Usage: bash agents/tools/cli-invoke.sh <cli> <prompt> [timeout_seconds]
#
# Returns JSON: {"cli":"...","exit_code":N,"output":"...","error":"...","elapsed_ms":N}
# Exit codes: 0=success, 1=error, 2=missing CLI, 3=missing API key, 124=timeout

set -euo pipefail

CLI="${1:?Usage: cli-invoke.sh <claude|gemini|codex> <prompt> [timeout]}"
PROMPT="${2:?Missing prompt}"
TIMEOUT="${3:-30}"

# Validate CLI exists
if ! command -v "$CLI" &>/dev/null; then
  echo "{\"cli\":\"$CLI\",\"exit_code\":2,\"output\":\"\",\"error\":\"CLI not found: $CLI\",\"elapsed_ms\":0}"
  exit 2
fi

# Check API key
case "$CLI" in
  claude)
    KEY_VAR="ANTHROPIC_API_KEY"
    CMD=(claude -p "$PROMPT" --output-format text)
    ;;
  gemini)
    KEY_VAR="GEMINI_API_KEY"
    CMD=(gemini -p "$PROMPT" -y)
    ;;
  codex)
    KEY_VAR="OPENAI_API_KEY"
    CMD=(codex exec --skip-git-repo-check "$PROMPT")
    ;;
  *)
    echo "{\"cli\":\"$CLI\",\"exit_code\":1,\"output\":\"\",\"error\":\"Unknown CLI: $CLI. Use claude, gemini, or codex.\",\"elapsed_ms\":0}"
    exit 1
    ;;
esac

if [ -z "${!KEY_VAR:-}" ]; then
  echo "{\"cli\":\"$CLI\",\"exit_code\":3,\"output\":\"\",\"error\":\"Missing $KEY_VAR environment variable\",\"elapsed_ms\":0}"
  exit 3
fi

# Invoke with timing
START_MS=$(($(date +%s%N) / 1000000))
OUTPUT=$(timeout "$TIMEOUT" "${CMD[@]}" 2>&1) || EXIT_CODE=$?
EXIT_CODE=${EXIT_CODE:-0}
END_MS=$(($(date +%s%N) / 1000000))
ELAPSED=$((END_MS - START_MS))

# Escape output for JSON
ESCAPED_OUTPUT=$(echo "$OUTPUT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')

if [ "$EXIT_CODE" -eq 124 ]; then
  echo "{\"cli\":\"$CLI\",\"exit_code\":124,\"output\":$ESCAPED_OUTPUT,\"error\":\"Timeout after ${TIMEOUT}s\",\"elapsed_ms\":$ELAPSED}"
  exit 124
fi

echo "{\"cli\":\"$CLI\",\"exit_code\":$EXIT_CODE,\"output\":$ESCAPED_OUTPUT,\"error\":\"\",\"elapsed_ms\":$ELAPSED}"
exit "$EXIT_CODE"
