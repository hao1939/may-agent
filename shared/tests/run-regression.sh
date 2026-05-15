#!/usr/bin/env bash
# Regression gate script — runs the Bun test suite and outputs pass/fail summary
# Usage: ./run-regression.sh
# Exit code: 0 = all pass, 1 = failures detected

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

echo "═══════════════════════════════════════════════════"
echo "  REGRESSION GATE — ${TIMESTAMP}"
echo "═══════════════════════════════════════════════════"
echo ""

# Run Bun tests and capture output
OUTPUT=$(cd "$SCRIPT_DIR/.." && bun run test 2>&1)
EXIT_CODE=$?

# Extract the Bun runner summary lines.
TESTS_LINE=$(echo "$OUTPUT" | grep -E "[0-9]+ pass" | tail -1)
FILES_LINE=$(echo "$OUTPUT" | grep -E "[0-9]+ files?" | tail -1 || true)

echo "$FILES_LINE"
echo "$TESTS_LINE"
echo ""

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ PASS | ${TIMESTAMP} | All tests green"
    echo "═══════════════════════════════════════════════════"
    exit 0
else
    # Show failed tests for debugging
    echo "$OUTPUT" | grep -E "FAIL|AssertionError|Expected|Received" | head -20
    echo ""
    echo "❌ FAIL | ${TIMESTAMP} | Exit code: ${EXIT_CODE}"
    echo "═══════════════════════════════════════════════════"
    exit 1
fi
