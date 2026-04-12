#!/usr/bin/env bash
#
# EXP-147 Track B Phase 1 — Run remaining scenarios
# Processes a JSONL file of {scenario, run, condition} assignments
#
set -euo pipefail

INPUT_FILE="$1"
OUTPUT_FILE="$2"

CONTEXT_FULL="agents/shared/knowledge/experiments/EXP-147/raw-data/context-full.md"
CONTEXT_SCOPED="agents/shared/knowledge/experiments/EXP-147/raw-data/context-scoped.md"
CONTEXT_TARGET="agents/bob/context.md"
CONTEXT_BACKUP="agents/bob/context.md.exp147bak"

export PATH=".state/.bun/bin:$PATH"

# Backup original context
cp "$CONTEXT_TARGET" "$CONTEXT_BACKUP"

trap 'cp "$CONTEXT_BACKUP" "$CONTEXT_TARGET"; rm -f "$CONTEXT_BACKUP"; echo "Context restored on exit"' EXIT

RUN_INDEX=0
TOTAL=$(wc -l < "$INPUT_FILE")

while IFS= read -r line; do
  SCENARIO=$(echo "$line" | bun -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).scenario)")
  RUN_NUM=$(echo "$line" | bun -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).run))")
  CONDITION=$(echo "$line" | bun -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).condition)")
  
  RUN_INDEX=$((RUN_INDEX + 1))
  
  # Swap context
  if [ "$CONDITION" = "scoped" ]; then
    cp "$CONTEXT_SCOPED" "$CONTEXT_TARGET"
  else
    cp "$CONTEXT_FULL" "$CONTEXT_TARGET"
  fi
  
  echo "[$RUN_INDEX/$TOTAL] $SCENARIO #$RUN_NUM condition=$CONDITION"
  
  # Run gym scenario
  START_TIME=$(date +%s)
  RESULT=$(scripts/gym-run.sh "$SCENARIO" --agent bob 2>&1) || true
  END_TIME=$(date +%s)
  ELAPSED=$((END_TIME - START_TIME))
  
  # Parse pass/fail
  PASSED=$(echo "$RESULT" | grep -oP '"passed":\s*(true|false)' | head -1 | grep -oP 'true|false' || true)
  
  if [ -z "$PASSED" ]; then
    if echo "$RESULT" | grep -q "PASS\|✓\|passed.*true"; then
      PASSED="true"
    else
      PASSED="false"
    fi
  fi
  
  # Write result
  echo "{\"scenario\":\"$SCENARIO\",\"run\":$RUN_NUM,\"condition\":\"$CONDITION\",\"passed\":$PASSED,\"elapsed\":$ELAPSED}" >> "$OUTPUT_FILE"
  echo "  => passed=$PASSED elapsed=${ELAPSED}s"
  
done < "$INPUT_FILE"

echo "=== All $RUN_INDEX runs complete ==="
