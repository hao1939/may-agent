#!/bin/bash
# Test Regression Check
# Ensures test count doesn't drop below baseline.
# Exit codes: 0 = pass, 1 = regression detected, 2 = test failures

BASELINE=1342
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Test Regression Check ==="
echo "Baseline: ${BASELINE} tests"
echo ""

# Run tests and capture output
cd "$SCRIPT_DIR"
OUTPUT=$(npx vitest run 2>&1)
EXIT_CODE=$?

# Extract test counts from vitest output
TOTAL=$(echo "$OUTPUT" | grep -oP 'Tests\s+\K\d+(?=\s+passed)' | head -1)
FAILED=$(echo "$OUTPUT" | grep -oP 'Tests\s+\K\d+(?=\s+failed)' | head -1)

# Alternative parsing if first method fails
if [ -z "$TOTAL" ]; then
  TOTAL=$(echo "$OUTPUT" | grep -i "tests" | grep -oP '\d+\s+passed' | grep -oP '^\d+')
fi

if [ -z "$TOTAL" ]; then
  # Try to get from summary line like "Test Files  X passed" or "Tests  X passed"
  TOTAL=$(echo "$OUTPUT" | tail -20 | grep -oP '(\d+) passed' | tail -1 | grep -oP '\d+')
fi

FAILED=${FAILED:-0}
TOTAL_COUNT=$((${TOTAL:-0} + ${FAILED:-0}))

echo "Results:"
echo "  Passed: ${TOTAL:-unknown}"
echo "  Failed: ${FAILED}"
echo "  Total:  ${TOTAL_COUNT}"
echo ""

# Check for test failures
if [ "$EXIT_CODE" -ne 0 ] || [ "${FAILED:-0}" -gt 0 ]; then
  echo "❌ FAILURE: Test suite has failing tests!"
  echo "$OUTPUT" | tail -30
  exit 2
fi

# Check regression
if [ "${TOTAL_COUNT}" -lt "$BASELINE" ]; then
  echo "❌ REGRESSION: Test count dropped below baseline!"
  echo "   Expected >= ${BASELINE}, got ${TOTAL_COUNT}"
  echo "   Delta: -$((BASELINE - TOTAL_COUNT)) tests"
  exit 1
fi

echo "✅ PASS: ${TOTAL_COUNT} tests (baseline: ${BASELINE}, +$((TOTAL_COUNT - BASELINE)))"
exit 0
