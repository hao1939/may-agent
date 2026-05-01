#!/bin/bash
# Regression Guard: Alerts if any SOUL.md or context.md grows back above target word counts
# Targets: SOUL.md < 600w, context.md < 450w
# Run periodically or as a pre-commit hook

SOUL_LIMIT=600
CONTEXT_LIMIT=450
FAILED=0

echo "=== SOUL/Context Word Count Regression Guard ==="
echo ""

# Check all SOUL.md files
for f in $(find /app/agents -name "SOUL.md" 2>/dev/null); do
  wc=$(wc -w < "$f")
  if [ "$wc" -gt "$SOUL_LIMIT" ]; then
    echo "❌ OVER LIMIT: $f — ${wc}w (limit: ${SOUL_LIMIT}w)"
    FAILED=1
  else
    echo "✅ $f — ${wc}w"
  fi
done

echo ""

# Check all context.md files
for f in $(find /app/agents -name "context.md" 2>/dev/null); do
  wc=$(wc -w < "$f")
  if [ "$wc" -gt "$CONTEXT_LIMIT" ]; then
    echo "❌ OVER LIMIT: $f — ${wc}w (limit: ${CONTEXT_LIMIT}w)"
    FAILED=1
  else
    echo "✅ $f — ${wc}w"
  fi
done

echo ""
if [ "$FAILED" -eq 1 ]; then
  echo "⚠️  REGRESSION DETECTED — files above target word counts"
  exit 1
else
  echo "All files within limits. No regression."
  exit 0
fi
