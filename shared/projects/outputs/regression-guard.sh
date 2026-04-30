#!/bin/bash
# Regression guard: verifies test count stays at or above baseline
# Run: bash /app/agents/shared/projects/outputs/regression-guard.sh

BASELINE_TESTS=1484
BASELINE_COVERAGE=83

echo "=== Regression Guard ==="
echo "Baseline: ${BASELINE_TESTS} tests, ${BASELINE_COVERAGE}% coverage"
echo ""

cd /app

# Run tests and capture output
OUTPUT=$(npx vitest run --reporter=verbose 2>&1)
EXIT_CODE=$?

# Extract test count
TESTS_PASSED=$(echo "$OUTPUT" | grep -oP '\d+ passed' | head -1 | grep -oP '\d+')
TESTS_FAILED=$(echo "$OUTPUT" | grep -oP '\d+ failed' | head -1 | grep -oP '\d+')

if [ $EXIT_CODE -ne 0 ]; then
  echo "❌ FAIL: Tests did not pass (exit code $EXIT_CODE)"
  echo "Failed tests: ${TESTS_FAILED:-unknown}"
  exit 1
fi

if [ -z "$TESTS_PASSED" ]; then
  echo "⚠️  Could not parse test count from output"
  exit 1
fi

if [ "$TESTS_PASSED" -lt "$BASELINE_TESTS" ]; then
  echo "❌ REGRESSION: Only $TESTS_PASSED tests passed (baseline: $BASELINE_TESTS)"
  echo "   Missing $(($BASELINE_TESTS - $TESTS_PASSED)) tests"
  exit 1
fi

echo "✅ PASS: $TESTS_PASSED tests passed (baseline: $BASELINE_TESTS)"
echo "   +$(($TESTS_PASSED - $BASELINE_TESTS)) above baseline"
exit 0
