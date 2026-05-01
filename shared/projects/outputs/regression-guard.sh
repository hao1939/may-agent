#!/bin/bash
# Regression Guard: Alerts if any SOUL.md or context.md grows back above targets
# Run periodically to ensure agent config bloat doesn't return
# Targets: SOUL.md < 600w, context.md < 450w

SOUL_LIMIT=600
CTX_LIMIT=450
EXIT_CODE=0

echo "=== Agent Config Regression Guard ==="
echo ""

for soul in /app/agents/*/SOUL.md; do
  [ -f "$soul" ] || continue
  agent=$(basename $(dirname "$soul"))
  wc=$(wc -w < "$soul" 2>/dev/null || echo 0)
  if [ "$wc" -gt "$SOUL_LIMIT" ]; then
    echo "⚠️  REGRESSION: $agent/SOUL.md = ${wc}w (limit: ${SOUL_LIMIT}w)"
    EXIT_CODE=1
  else
    echo "✅ $agent/SOUL.md = ${wc}w"
  fi
done

echo ""

for ctx in /app/agents/*/context.md; do
  [ -f "$ctx" ] || continue
  agent=$(basename $(dirname "$ctx"))
  wc=$(wc -w < "$ctx" 2>/dev/null || echo 0)
  if [ "$wc" -gt "$CTX_LIMIT" ]; then
    echo "⚠️  REGRESSION: $agent/context.md = ${wc}w (limit: ${CTX_LIMIT}w)"
    EXIT_CODE=1
  else
    echo "✅ $agent/context.md = ${wc}w"
  fi
done

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "All files within limits. No regression detected."
else
  echo "REGRESSIONS FOUND. Review flagged files above."
fi

exit $EXIT_CODE
