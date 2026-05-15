#!/usr/bin/env bash
# Test Gate: Regression guard for the curated Bun app health suite
# Exits non-zero if any test fails

set -euo pipefail

cd "$(dirname "$0")/.."

echo "🧪 Running test gate..."
echo "========================"

set +e
OUTPUT=$(cd .. && bun run test 2>&1)
EXIT_CODE=$?
set -e

# Extract summary line
SUMMARY=$(echo "$OUTPUT" | grep -E "[0-9]+ pass" | tail -1 || echo "No summary found")
echo "$SUMMARY"

if [ "${EXIT_CODE}" -ne 0 ]; then
  echo ""
  echo "❌ TEST GATE FAILED"
  echo "Failing tests:"
  echo "$OUTPUT" | grep "FAIL" | head -20
  exit 1
fi

echo ""
echo "✅ TEST GATE PASSED"
exit 0
