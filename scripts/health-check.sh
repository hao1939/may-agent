#!/bin/bash
# Health check script: runs BOTH tsc and vitest, reports combined results.
# Purpose: Infrastructure solution for C36 (tech-lead skips vitest when running tsc separately).
# Usage: bash scripts/health-check.sh
# Agents should run this single command instead of separate tsc/vitest calls.

set -o pipefail

TIMEOUT=${1:-120}  # Default 120s per command (tsc ~35s, vitest ~75s)

echo "=== HEALTH CHECK ==="
echo ""

# --- TypeScript compilation ---
echo "--- tsc --noEmit ---"
tsc_output=$(timeout ${TIMEOUT}s npx tsc --noEmit 2>&1)
tsc_exit=$?
if [ $tsc_exit -eq 124 ]; then
  echo "⚠️ tsc: TIMEOUT (>${TIMEOUT}s)"
  tsc_exit=1
fi
if [ $tsc_exit -eq 0 ]; then
  echo "✅ tsc: PASS (no type errors)"
else
  echo "❌ tsc: FAIL (exit $tsc_exit)"
  echo "$tsc_output" | tail -20
fi
echo ""

# --- Vitest ---
echo "--- vitest --run ---"
vitest_output=$(timeout ${TIMEOUT}s npx vitest --run 2>&1)
vitest_exit=$?
if [ $vitest_exit -eq 124 ]; then
  echo "⚠️ vitest: TIMEOUT (>${TIMEOUT}s)"
  vitest_exit=1
fi
if [ $vitest_exit -eq 0 ]; then
  # Extract summary line
  summary=$(echo "$vitest_output" | grep -E "Tests\s+" | tail -1)
  echo "✅ vitest: PASS${summary:+ — $summary}"
else
  echo "❌ vitest: FAIL (exit $vitest_exit)"
  echo "$vitest_output" | grep -E "FAIL|Error|✗|×|expected|received" | head -15
fi
echo ""

# --- Combined verdict ---
echo "=== VERDICT ==="
if [ $tsc_exit -eq 0 ] && [ $vitest_exit -eq 0 ]; then
  echo "✅ BUILD HEALTHY"
  exit 0
else
  echo "❌ BUILD UNHEALTHY"
  [ $tsc_exit -ne 0 ] && echo "  - tsc failed"
  [ $vitest_exit -ne 0 ] && echo "  - vitest failed"
  exit 1
fi
