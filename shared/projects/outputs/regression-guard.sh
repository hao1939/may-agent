#!/usr/bin/env bash
# Regression Guard — protects the test baseline from silent breakage
# Baseline: 1565 tests across 91 files, 0 failures
# Usage: bash regression-guard.sh [--strict]

set -euo pipefail

BASELINE_TESTS=1565
BASELINE_FILES=91
STRICT="${1:-}"
TEST_DIR="/app/agents/shared"

echo "=== Regression Guard ==="
echo "Baseline: ${BASELINE_TESTS} tests across ${BASELINE_FILES} files"
echo ""

# Run vitest and capture output
OUTPUT=$(cd "$TEST_DIR" && npx vitest run 2>&1) || true

# Extract counts from vitest output
PASS_COUNT=$(echo "$OUTPUT" | grep -oP 'Tests\s+\K\d+(?=\s+passed)' || echo "0")
FAIL_COUNT=$(echo "$OUTPUT" | grep -oP 'Tests\s+\K\d+(?=\s+failed)' || echo "0")
FILE_COUNT=$(echo "$OUTPUT" | grep -oP 'Test Files\s+\K\d+(?=\s+passed)' || echo "0")
FILE_FAIL=$(echo "$OUTPUT" | grep -oP 'Test Files\s+\K\d+(?=\s+failed)' || echo "0")

TOTAL_TESTS=$((PASS_COUNT + FAIL_COUNT))
TOTAL_FILES=$((FILE_COUNT + FILE_FAIL))

echo "Results: ${PASS_COUNT} passed, ${FAIL_COUNT} failed (${TOTAL_TESTS} total)"
echo "Files:   ${FILE_COUNT} passed, ${FILE_FAIL} failed (${TOTAL_FILES} total)"
echo ""

EXIT=0

# Check for failures
if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "❌ FAIL: ${FAIL_COUNT} test(s) failed"
  EXIT=1
fi

if [ "$FILE_FAIL" -gt 0 ]; then
  echo "❌ FAIL: ${FILE_FAIL} file(s) failed"
  EXIT=1
fi

# Check for regression in counts
if [ "$TOTAL_TESTS" -lt "$BASELINE_TESTS" ]; then
  echo "⚠️  WARNING: Test count dropped from ${BASELINE_TESTS} to ${TOTAL_TESTS} (delta: -$((BASELINE_TESTS - TOTAL_TESTS)))"
  if [ "$STRICT" = "--strict" ]; then
    EXIT=1
  fi
fi

if [ "$TOTAL_FILES" -lt "$BASELINE_FILES" ]; then
  echo "⚠️  WARNING: File count dropped from ${BASELINE_FILES} to ${TOTAL_FILES}"
  if [ "$STRICT" = "--strict" ]; then
    EXIT=1
  fi
fi

# Report improvements
if [ "$TOTAL_TESTS" -gt "$BASELINE_TESTS" ]; then
  echo "✅ IMPROVED: Test count grew from ${BASELINE_TESTS} to ${TOTAL_TESTS} (+$((TOTAL_TESTS - BASELINE_TESTS)))"
fi

if [ "$EXIT" -eq 0 ]; then
  echo ""
  echo "✅ REGRESSION GUARD PASSED"
else
  echo ""
  echo "❌ REGRESSION GUARD FAILED"
fi

exit $EXIT
