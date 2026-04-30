#!/usr/bin/env bash
# Regression gate script — runs full vitest suite and outputs pass/fail summary
# Usage: ./run-regression.sh
# Exit code: 0 = all pass, 1 = failures detected

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

echo "═══════════════════════════════════════════════════"
echo "  REGRESSION GATE — ${TIMESTAMP}"
echo "═══════════════════════════════════════════════════"
echo ""

# Run vitest and capture output
OUTPUT=$(cd "$SCRIPT_DIR" && npx vitest run 2>&1)
EXIT_CODE=$?

# Extract summary line (e.g., "Tests  1509 passed (1509)")
TESTS_LINE=$(echo "$OUTPUT" | grep -E "Tests\s+" | tail -1)
FILES_LINE=$(echo "$OUTPUT" | grep -E "Test Files\s+" | tail -1)

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
