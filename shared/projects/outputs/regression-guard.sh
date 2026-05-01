#!/bin/bash
# Regression Guard - Fails if test count drops below 1500
# Usage: bash regression-guard.sh
# Exit 0 = OK, Exit 1 = regression detected

set -euo pipefail

cd /app

echo "Running test suite..."
RESULT=$(npx vitest run 2>&1) || true

# Extract test count from vitest output
COUNT=$(echo "$RESULT" | grep -oP '\d+(?= tests?)' | tail -1)

if [ -z "$COUNT" ]; then
  echo "ERROR: Could not parse test count from vitest output"
  echo "$RESULT" | tail -20
  exit 2
fi

MINIMUM=1500

if [ "$COUNT" -lt "$MINIMUM" ]; then
  echo "🚨 REGRESSION: only $COUNT tests passing (minimum $MINIMUM)"
  echo "Delta: -$(($MINIMUM - $COUNT)) tests"
  exit 1
fi

echo "✅ OK: $COUNT tests passing (minimum: $MINIMUM)"
exit 0
