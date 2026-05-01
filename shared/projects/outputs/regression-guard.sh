#!/bin/bash
# Regression Guard: Alerts if any SOUL.md or context.md grows back above targets
# Run periodically to ensure bloat doesn't return
# Targets: SOUL.md < 600w, context.md < 450w

SOUL_LIMIT=600
CONTEXT_LIMIT=450
EXIT_CODE=0

echo "=== Agent File Size Regression Guard ==="
echo "Checking SOUL.md files (limit: ${SOUL_LIMIT}w)..."

for f in /app/agents/*/SOUL.md; do
  [ -f "$f" ] || continue
  wc=$(wc -w < "$f")
  agent=$(basename $(dirname "$f"))
  if [ "$wc" -gt "$SOUL_LIMIT" ]; then
    echo "  ❌ FAIL: $agent/SOUL.md = ${wc}w (limit: ${SOUL_LIMIT}w)"
    EXIT_CODE=1
  else
    echo "  ✅ OK: $agent/SOUL.md = ${wc}w"
  fi
done

echo ""
echo "Checking context.md files (limit: ${CONTEXT_LIMIT}w)..."

for f in /app/agents/*/context.md; do
  [ -f "$f" ] || continue
  wc=$(wc -w < "$f")
  agent=$(basename $(dirname "$f"))
  if [ "$wc" -gt "$CONTEXT_LIMIT" ]; then
    echo "  ❌ FAIL: $agent/context.md = ${wc}w (limit: ${CONTEXT_LIMIT}w)"
    EXIT_CODE=1
  else
    echo "  ✅ OK: $agent/context.md = ${wc}w"
  fi
done

echo ""
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "All files within limits. No regression detected."
else
  echo "⚠️  REGRESSION DETECTED. Files above target need trimming."
fi

exit $EXIT_CODE
