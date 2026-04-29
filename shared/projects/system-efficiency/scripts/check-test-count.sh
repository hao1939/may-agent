#!/bin/bash
# Regression protection: verify test count stays above threshold
THRESHOLD=500

COUNT=$(npx vitest run --reporter=json 2>/dev/null | tail -1 | jq '.numTotalTests')

if [ -z "$COUNT" ] || [ "$COUNT" = "null" ]; then
  echo "ERROR: Could not determine test count"
  exit 1
fi

if [ "$COUNT" -ge "$THRESHOLD" ]; then
  echo "PASS: $COUNT tests (threshold: $THRESHOLD)"
  exit 0
else
  echo "FAIL: Only $COUNT tests (threshold: $THRESHOLD)"
  exit 1
fi
