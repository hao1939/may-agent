#!/usr/bin/env bash
# test-regression-guard.sh — Fails if test count or file count regresses below thresholds.
set -euo pipefail

MIN_TESTS=1500
MIN_FILES=90

echo "=== Test Regression Guard ==="
echo "Thresholds: >= $MIN_TESTS tests, >= $MIN_FILES test files"
echo ""

# Run vitest with JSON reporter, capture output
JSON_OUTPUT=$(npx vitest run --reporter=json 2>/dev/null || true)

# Parse results from JSON
TEST_COUNT=$(echo "$JSON_OUTPUT" | grep -o '"numTotalTests":[0-9]*' | head -1 | cut -d: -f2)
FILE_COUNT=$(echo "$JSON_OUTPUT" | grep -o '"numTotalTestSuites":[0-9]*' | head -1 | cut -d: -f2)

if [ -z "$TEST_COUNT" ] || [ -z "$FILE_COUNT" ]; then
  echo "FAIL: Could not parse test results from vitest JSON output."
  echo "Raw output (last 20 lines):"
  echo "$JSON_OUTPUT" | tail -20
  exit 1
fi

echo "Results: $TEST_COUNT tests across $FILE_COUNT files"
echo ""

FAILED=0

if [ "$TEST_COUNT" -lt "$MIN_TESTS" ]; then
  echo "REGRESSION: Test count $TEST_COUNT is below minimum $MIN_TESTS"
  FAILED=1
fi

if [ "$FILE_COUNT" -lt "$MIN_FILES" ]; then
  echo "REGRESSION: File count $FILE_COUNT is below minimum $MIN_FILES"
  FAILED=1
fi

if [ "$FAILED" -ne 0 ]; then
  echo ""
  echo "=== REGRESSION DETECTED — fix before merging ==="
  exit 1
fi

echo "=== All thresholds met. No regression. ==="
exit 0
