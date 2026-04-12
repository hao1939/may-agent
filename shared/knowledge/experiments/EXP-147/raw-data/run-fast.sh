#!/usr/bin/env bash
#
# Fast EXP-147 runner — processes JSONL input without bun for JSON parsing
# Uses grep/sed for field extraction (much faster per-iteration)
#
set -euo pipefail

INPUT_FILE="$1"
OUTPUT_FILE="$2"
BATCH_SIZE="${3:-74}"  # How many to run (default: all)

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
  [ $RUN_INDEX -ge $BATCH_SIZE ] && break
  
  # Fast JSON field extraction with grep/sed
  SCENARIO=$(echo "$line" | grep -oP '"scenario"\s*:\s*"[^"]*"' | sed 's/.*"\([^"]*\)"/\1/')
  RUN_NUM=$(echo "$line" | grep -oP '"run"\s*:\s*[0-9]+' | grep -oP '[0-9]+$')
  CONDITION=$(echo "$line" | grep -oP '"condition"\s*:\s*"[^"]*"' | sed 's/.*"\([^"]*\)"/\1/')
  
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
  PASSED="false"
  if echo "$RESULT" | grep -qP '"passed":\s*true'; then
    PASSED="true"
  elif echo "$RESULT" | grep -q "PASS\|✓"; then
    PASSED="true"
  fi
  
  # Write result
  echo "{\"scenario\":\"$SCENARIO\",\"run\":$RUN_NUM,\"condition\":\"$CONDITION\",\"passed\":$PASSED,\"elapsed\":$ELAPSED}" >> "$OUTPUT_FILE"
  echo "  => passed=$PASSED elapsed=${ELAPSED}s"
  
done < "$INPUT_FILE"

echo "=== Completed $RUN_INDEX runs ==="
