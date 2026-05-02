#!/bin/bash
# regression-guard.sh - Prevents system regression by monitoring key metrics

OUTPUTS_DIR="/app/agents/shared/projects/outputs"
MAX_FILES=1500

count=$(ls "$OUTPUTS_DIR" | wc -l)

if [ "$count" -gt "$MAX_FILES" ]; then
  echo "REGRESSION ALERT: outputs/ has $count files (threshold: $MAX_FILES)"
  exit 1
else
  echo "OK: outputs/ has $count files (threshold: $MAX_FILES)"
  exit 0
fi
