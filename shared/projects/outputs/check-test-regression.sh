#!/bin/bash
# Test Regression Detection Script
# Fails if test count drops below the minimum threshold (1400)
# Usage: bash check-test-regression.sh [min_tests]

set -euo pipefail

MIN_TESTS="${1:-1400}"
TEST_DIR="/app/agents/shared"

echo "=== Test Regression Check ==="
echo "Minimum required tests: $MIN_TESTS"
echo "Running test suite in: $TEST_DIR"
echo ""

# Run vitest and capture output
OUTPUT=$(cd "$TEST_DIR" && npx vitest run 2>&1) || true

# Parse test count from vitest output
# Vitest outputs lines like: "Tests  1423 passed (1423)"
PASSED=$(echo "$OUTPUT" | grep -oP 'Tests\s+\K\d+(?=\s+passed)' || echo "0")
FAILED=$(echo "$OUTPUT" | grep -oP '\d+(?=\s+failed)' || echo "0")
TOTAL=$((PASSED + FAILED))

echo "Results:"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Total:  $TOTAL"
echo ""

# Check for test failures first
if [ "$FAILED" -gt 0 ]; then
    echo "❌ REGRESSION: $FAILED test(s) failing!"
    echo "$OUTPUT" | grep -A2 "FAIL" | head -30
    exit 1
fi

# Check minimum count
if [ "$TOTAL" -lt "$MIN_TESTS" ]; then
    echo "❌ REGRESSION: Test count ($TOTAL) below minimum ($MIN_TESTS)"
    echo "   Delta: -$((MIN_TESTS - TOTAL)) tests"
    exit 1
fi

echo "✅ PASS: $TOTAL tests (threshold: $MIN_TESTS)"
exit 0
