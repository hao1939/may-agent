#!/usr/bin/env bash
# regression-guard.sh — Protects system-efficiency gains from regression
set -uo pipefail

PASS=0
FAIL=0

report() { echo "[$1] $2"; }

# --- Check 1: No context.md file exceeds 2500 bytes ---
echo "=== Context.md Size Check (max 2500B) ==="
CONTEXT_FAIL=0
for f in /app/agents/*/context.md; do
    size=$(wc -c < "$f")
    name=$(basename "$(dirname "$f")")
    if [ "$size" -gt 2500 ]; then
        report "FAIL" "$name/context.md: ${size}B (over 2500B limit)"
        CONTEXT_FAIL=1
    fi
done
if [ "$CONTEXT_FAIL" -eq 0 ]; then
    report "PASS" "All context.md files under 2500B"
    PASS=$((PASS+1))
else
    FAIL=$((FAIL+1))
fi

# --- Check 2: Test suite has 1500+ passing tests ---
echo ""
echo "=== Test Suite Check (min 1500 passing) ==="
TEST_OUTPUT=$(cd /app && npx vitest run 2>&1 | tr -d '\033' | sed 's/\[[0-9;]*m//g' || true)
TESTS_PASSED=$(echo "$TEST_OUTPUT" | grep 'Tests' | grep -oP '[0-9]+ passed' | grep -oP '[0-9]+' | head -1)
TESTS_PASSED=${TESTS_PASSED:-0}
if [ "$TESTS_PASSED" -ge 1500 ]; then
    report "PASS" "Test suite: ${TESTS_PASSED} tests passing (>=1500)"
    PASS=$((PASS+1))
else
    report "FAIL" "Test suite: ${TESTS_PASSED} tests passing (<1500)"
    FAIL=$((FAIL+1))
fi

# --- Check 3: Average context.md size under 1000B ---
echo ""
echo "=== Average Context.md Size (target <1000B) ==="
TOTAL=0
COUNT=0
for f in /app/agents/*/context.md; do
    size=$(wc -c < "$f")
    TOTAL=$((TOTAL+size))
    COUNT=$((COUNT+1))
done
AVG=$((TOTAL / COUNT))
if [ "$AVG" -lt 1000 ]; then
    report "PASS" "Average context.md: ${AVG}B (<1000B)"
    PASS=$((PASS+1))
else
    report "WARN" "Average context.md: ${AVG}B (>=1000B)"
fi

# --- Summary ---
echo ""
echo "=== SUMMARY ==="
echo "PASS: $PASS | FAIL: $FAIL"
if [ "$FAIL" -gt 0 ]; then
    echo "RESULT: REGRESSION DETECTED"
    exit 1
else
    echo "RESULT: ALL GUARDS PASSING"
    exit 0
fi
