#!/usr/bin/env bash
# Regression guard script - runs test suite and outputs CI-friendly summary
# Exit 0 on all-pass, exit 1 on any failure

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_DIR" || exit 1

echo "=== Regression Guard ==="
echo "Running test suite in: $PROJECT_DIR"
echo ""

OUTPUT=$(bun run test 2>&1)
EXIT_CODE=$?

# Parse counts from the curated Bun runner output.
PASSED=$(echo "$OUTPUT" | grep -oE '\b[0-9]+ pass\b' | tail -1 | grep -oE '[0-9]+')
FAILED=$(echo "$OUTPUT" | grep -oE '\b[0-9]+ fail\b' | tail -1 | grep -oE '[0-9]+')
SKIPPED=0
PASSED=${PASSED:-0}
FAILED=${FAILED:-0}
TOTAL=$((PASSED + FAILED))

echo "=== Summary ==="
echo "Total: $TOTAL | Passed: $PASSED | Failed: $FAILED | Skipped: $SKIPPED"

if [ "$EXIT_CODE" -ne 0 ] || [ "$FAILED" -gt 0 ]; then
    echo "STATUS: FAIL ❌"
    echo ""
    echo "Failed test output:"
    echo "$OUTPUT" | grep -A 5 "FAIL"
    exit 1
else
    echo "STATUS: PASS ✅"
    exit 0
fi
