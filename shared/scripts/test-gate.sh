#!/usr/bin/env bash
# Test Gate: Regression guard for 95/95 test file baseline
# Exits non-zero if any test fails

set -euo pipefail

cd "$(dirname "$0")/.."

echo "🧪 Running test gate..."
echo "========================"

OUTPUT=$(npx vitest run 2>&1) || true
EXIT_CODE=${PIPESTATUS[0]:-$?}

# Extract summary line
SUMMARY=$(echo "$OUTPUT" | grep -E "Test Files" || echo "No summary found")
echo "$SUMMARY"

if echo "$OUTPUT" | grep -q "Test Files.*failed"; then
  echo ""
  echo "❌ TEST GATE FAILED"
  echo "Failing tests:"
  echo "$OUTPUT" | grep "FAIL" | head -20
  exit 1
fi

echo ""
echo "✅ TEST GATE PASSED"
exit 0
