#!/usr/bin/env bash
# Regression guard script - runs test suite and outputs CI-friendly summary
# Exit 0 on all-pass, exit 1 on any failure

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR" || exit 1

echo "=== Regression Guard ==="
echo "Running test suite in: $PROJECT_DIR"
echo ""

OUTPUT=$(npx vitest run 2>&1)
EXIT_CODE=$?

# Parse counts from vitest output
PASSED=$(echo "$OUTPUT" | grep -oP 'Tests\s+\K\d+(?=\s+passed)' | head -1)
FAILED=$(echo "$OUTPUT" | grep -oP '\d+(?=\s+failed)' | head -1)
SKIPPED=$(echo "$OUTPUT" | grep -oP '\d+(?=\s+skipped)' | head -1)
PASSED=${PASSED:-0}
FAILED=${FAILED:-0}
SKIPPED=${SKIPPED:-0}
TOTAL=$((PASSED + FAILED + SKIPPED))

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
