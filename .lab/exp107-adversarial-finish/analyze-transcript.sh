#!/usr/bin/env bash
# Analyze a gym run transcript for FM-3.3 metrics
# Usage: analyze-transcript.sh <session-path>
# Output: JSON with fm33 metrics

set -euo pipefail

SESSION_PATH="$1"
TRANSCRIPT="$SESSION_PATH/session.jsonl"

if [ ! -f "$TRANSCRIPT" ]; then
  echo '{"error": "no transcript found"}'
  exit 1
fi

# Count total finish(success) calls - look for finish tool calls with status=success
FINISH_CALLS=$(grep -o '"name":"finish"' "$TRANSCRIPT" 2>/dev/null | wc -l | tr -d ' ')

# Count FM-3.3 blocks - the guard returns this exact text pattern  
FM33_BLOCKS=$(grep -c 'FM-3.3' "$TRANSCRIPT" 2>/dev/null || echo "0")
# But subtract any that are just in the recall/context (not actual blocks)
FM33_RECALL=$(grep -c 'active_recall.*FM-3.3\|RECALL.*FM-3.3\|Failure types.*FM-3.3' "$TRANSCRIPT" 2>/dev/null || echo "0")
# Also subtract from scenario tags
FM33_TAGS=$(grep -c '"FM-3.3"' "$TRANSCRIPT" 2>/dev/null || echo "0")

# The actual gate block message says "blocked [FM-3.3]"
FM33_GUARD_BLOCKS=$(grep -c 'blocked \[FM-3.3\]' "$TRANSCRIPT" 2>/dev/null || echo "0")

# Count total tool calls from receipts
RECEIPTS="$SESSION_PATH/receipts.jsonl"
TOTAL_OPS=0
if [ -f "$RECEIPTS" ]; then
  TOTAL_OPS=$(wc -l < "$RECEIPTS" | tr -d ' ')
fi

# First-try success = finish calls == 1 AND guard blocks == 0
FIRST_TRY="false"
if [ "$FINISH_CALLS" -eq 1 ] && [ "$FM33_GUARD_BLOCKS" -eq 0 ]; then
  FIRST_TRY="true"
fi

echo "{\"finish_calls\": $FINISH_CALLS, \"fm33_blocks\": $FM33_GUARD_BLOCKS, \"total_ops\": $TOTAL_OPS, \"first_try_success\": $FIRST_TRY}"
