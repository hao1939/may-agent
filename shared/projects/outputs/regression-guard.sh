#!/usr/bin/env bash
# Regression guard: alerts if any SOUL.md or context.md grows back above target word counts
# Run periodically to ensure bloat doesn't return after the context-trimming project.

SOUL_LIMIT=600
CTX_LIMIT=450
EXIT_CODE=0

echo "=== SOUL.md / context.md Regression Guard ==="
echo ""

for f in $(find /app/agents -name "SOUL.md" 2>/dev/null); do
  wc=$(wc -w < "$f")
  agent=$(echo "$f" | grep -oP 'agents/\K[^/]+')
  if [ "$wc" -gt "$SOUL_LIMIT" ]; then
    echo "FAIL: $agent/SOUL.md = ${wc}w (limit ${SOUL_LIMIT}w)"
    EXIT_CODE=1
  else
    echo "  OK: $agent/SOUL.md = ${wc}w"
  fi
done

for f in $(find /app/agents -name "context.md" 2>/dev/null); do
  wc=$(wc -w < "$f")
  agent=$(echo "$f" | grep -oP 'agents/\K[^/]+')
  if [ "$wc" -gt "$CTX_LIMIT" ]; then
    echo "FAIL: $agent/context.md = ${wc}w (limit ${CTX_LIMIT}w)"
    EXIT_CODE=1
  else
    echo "  OK: $agent/context.md = ${wc}w"
  fi
done

echo ""
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "All files within limits."
else
  echo "WARNING: Some files exceed word count targets!"
fi
exit $EXIT_CODE
