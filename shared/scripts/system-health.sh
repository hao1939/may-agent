#!/bin/bash
# System Health Dashboard
# One-command health check for the shared agent system

set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== System Health Dashboard ==="
echo "Generated: $(date)"
echo ""

# Run tests and capture output
TEST_OUTPUT=$(cd /app && bun run test 2>&1) || true

# Extract metrics
TEST_FILES_LINE=$(echo "$TEST_OUTPUT" | grep -E "across [0-9]+ files?" | tail -1)
TESTS_LINE=$(echo "$TEST_OUTPUT" | grep -E "[0-9]+ pass" | tail -1)
DURATION_LINE=$(echo "$TEST_OUTPUT" | grep -oE "in [0-9.]+s" | tail -1)

echo "--- Test Results ---"
echo "  $TEST_FILES_LINE"
echo "  $TESTS_LINE"
echo "  $DURATION_LINE"
echo ""

# Coverage gap analysis
echo "--- Coverage Gaps ---"
GAPS=0
for wf in workflows/*.ts; do
  [[ "$wf" == *test* ]] && continue
  [[ "$wf" == *index* ]] && continue
  base=$(basename "$wf" .ts)
  if [ ! -f "workflows/${base}.test.ts" ] && ! ls tests/*${base}* 2>/dev/null | grep -q test; then
    echo "  - $base.ts (no test file)"
    GAPS=$((GAPS + 1))
  fi
done

if [ $GAPS -eq 0 ]; then
  echo "  None — all workflow files have test coverage!"
else
  echo "  Total gaps: $GAPS"
fi

echo ""
echo "--- Summary ---"
if echo "$TEST_FILES_LINE" | grep -q "failed"; then
  echo "  STATUS: ❌ FAILING"
else
  echo "  STATUS: ✅ HEALTHY"
fi
