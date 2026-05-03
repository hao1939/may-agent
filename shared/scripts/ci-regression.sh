#!/usr/bin/env bash
# CI Regression Guard Script
# Runs the full vitest test suite and fails if test count < 1600 or any failures exist.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== CI Regression Guard ==="
echo "Running vitest suite in $SHARED_DIR..."

cd "$SHARED_DIR"

# Run vitest and capture output
OUTPUT=$(npx vitest run 2>&1) || true

echo "$OUTPUT"

# Parse summary line - vitest outputs like "Tests  25 passed (25)"
# or "Tests  2 failed | 23 passed (25)"
PASSED=$(echo "$OUTPUT" | grep -oP 'Tests\s+(\d+ failed \| )?(\d+) passed' | grep -oP '\d+ passed' | grep -oP '\d+' || echo "0")
FAILED=$(echo "$OUTPUT" | grep -oP '\d+ failed' | head -1 | grep -oP '\d+' || echo "0")
TOTAL=$((PASSED + FAILED))

echo ""
echo "=== Summary ==="
echo "Total tests: $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $FAILED"

# Gate: fail if failures > 0
if [ "$FAILED" -gt 0 ]; then
  echo "❌ REGRESSION: $FAILED test(s) failed"
  exit 1
fi

# Gate: fail if test count < 1600
if [ "$TOTAL" -lt 1600 ]; then
  echo "⚠️  WARNING: Test count ($TOTAL) is below minimum threshold (1600)"
  echo "   This may indicate tests were accidentally deleted."
  exit 1
fi

echo "✅ All gates passed: $TOTAL tests, 0 failures"
exit 0
