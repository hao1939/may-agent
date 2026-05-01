#!/bin/bash
# Regression Guard: Alerts if any SOUL.md or context.md grows back above targets
# Run periodically or as a pre-commit hook to prevent bloat recurrence.
#
# Targets:
#   SOUL.md: <600 words
#   context.md: <450 words

SOUL_LIMIT=600
CONTEXT_LIMIT=450
EXIT_CODE=0

echo "=== Context Bloat Regression Guard ==="
echo ""

# Check SOUL.md files
echo "--- SOUL.md files (limit: ${SOUL_LIMIT}w) ---"
for f in $(find /app/agents -name "SOUL.md" 2>/dev/null); do
    wc=$(wc -w < "$f")
    status="✅"
    if [ "$wc" -gt "$SOUL_LIMIT" ]; then
        status="❌ OVER LIMIT"
        EXIT_CODE=1
    fi
    printf "  %4dw %s %s\n" "$wc" "$status" "$f"
done

echo ""
echo "--- context.md files (limit: ${CONTEXT_LIMIT}w) ---"
for f in $(find /app/agents -name "context.md" 2>/dev/null); do
    wc=$(wc -w < "$f")
    status="✅"
    if [ "$wc" -gt "$CONTEXT_LIMIT" ]; then
        status="❌ OVER LIMIT"
        EXIT_CODE=1
    fi
    printf "  %4dw %s %s\n" "$wc" "$status" "$f"
done

echo ""
if [ "$EXIT_CODE" -eq 0 ]; then
    echo "All files within limits. No regression detected."
else
    echo "⚠️  REGRESSION DETECTED — files above word count targets!"
fi

exit $EXIT_CODE
