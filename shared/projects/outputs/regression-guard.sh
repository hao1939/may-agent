#!/usr/bin/env bash
# Regression Guard: Alerts if any SOUL.md or context.md grows back above targets
# Run periodically to ensure agent config bloat doesn't return.
# Targets: SOUL.md < 600w, context.md < 450w

SOUL_LIMIT=600
CTX_LIMIT=450
EXIT_CODE=0

echo "=== Agent Config Regression Guard ==="
echo ""

for soul in /app/agents/*/SOUL.md; do
  [ -f "$soul" ] || continue
  agent=$(basename "$(dirname "$soul")")
  wc=$(wc -w < "$soul" | tr -d ' ')
  status="✅"
  if [ "$wc" -gt "$SOUL_LIMIT" ]; then
    status="❌ OVER LIMIT"
    EXIT_CODE=1
  fi
  printf "  SOUL.md  %-20s %4dw / %dw %s\n" "$agent" "$wc" "$SOUL_LIMIT" "$status"
done

echo ""

for ctx in /app/agents/*/context.md; do
  [ -f "$ctx" ] || continue
  agent=$(basename "$(dirname "$ctx")")
  wc=$(wc -w < "$ctx" | tr -d ' ')
  status="✅"
  if [ "$wc" -gt "$CTX_LIMIT" ]; then
    status="❌ OVER LIMIT"
    EXIT_CODE=1
  fi
  printf "  context  %-20s %4dw / %dw %s\n" "$agent" "$wc" "$CTX_LIMIT" "$status"
done

echo ""
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "All files within limits. No regression detected."
else
  echo "⚠️  REGRESSION DETECTED — files above word count targets."
fi
exit $EXIT_CODE
