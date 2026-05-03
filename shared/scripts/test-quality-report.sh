#!/usr/bin/env bash
# test-quality-report.sh — Run vitest with coverage and report quality metrics
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "=== Test Quality Report ==="
echo "Running vitest with coverage..."
echo ""

# Run tests with coverage, capture output
OUTPUT=$(npx vitest run --coverage 2>&1) || true

echo "$OUTPUT" | tail -80

echo ""
echo "=== Coverage Summary ==="

# Extract coverage summary lines (look for the table with %)
echo "$OUTPUT" | grep -E '^\s*(All files|[a-zA-Z/]+)\s*\|' | while IFS= read -r line; do
  echo "$line"
done

echo ""
echo "=== Untested Files (0% coverage) ==="
ZERO_COV=$(echo "$OUTPUT" | grep -E '\|\s*0\s*\|' | grep -v 'All files' || true)
ZERO_COUNT=0
if [ -n "$ZERO_COV" ]; then
  echo "$ZERO_COV"
  ZERO_COUNT=$(echo "$ZERO_COV" | wc -l | tr -d ' ')
else
  echo "(none)"
fi

echo ""
echo "=== Metrics ==="

# Extract total coverage % from "All files" line
TOTAL_COV=$(echo "$OUTPUT" | grep 'All files' | head -1 | awk -F'|' '{gsub(/[ ]+/,"",$2); print $2}')
echo "Total line coverage: ${TOTAL_COV:-unknown}%"
echo "Files with 0% coverage: $ZERO_COUNT"

# Extract test counts from vitest output
TEST_LINE=$(echo "$OUTPUT" | grep -E 'Tests\s+[0-9]' | tail -1)
echo "Test summary: ${TEST_LINE:-unknown}"

echo ""
echo "=== Done ==="
