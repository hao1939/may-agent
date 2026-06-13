#!/bin/bash
# Regression guard — fails if test count drops below 1500
set -euo pipefail
cd /app/agents
RESULT=$(npx vitest run 2>&1 || true)
PASS=$(echo "$RESULT" | grep -oP '\d+(?= passed)' | tail -1)
FAIL=$(echo "$RESULT" | grep -oP '\d+(?= failed)' | tail -1)
TOTAL=$((${PASS:-0} + ${FAIL:-0}))
echo "Tests: $TOTAL (passed: ${PASS:-0}, failed: ${FAIL:-0})"
if [ "${PASS:-0}" -lt 1500 ]; then
  echo "❌ REGRESSION: only ${PASS:-0} tests passing (minimum: 1500)"
  exit 1
fi
echo "✅ OK: ${PASS:-0} tests passing (minimum: 1500)"
