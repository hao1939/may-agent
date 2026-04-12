#!/usr/bin/env bash
#
# EXP-147 Track B: Run specific (scenario, run, condition) tuples from an input JSONL
# Usage: bash run-targeted-batch.sh <input.jsonl> <output.jsonl> [max_runs]
#
set -euo pipefail

INPUT_FILE="$1"
OUTPUT_FILE="$2"
MAX_RUNS="${3:-999}"

CONTEXT_FULL="agents/shared/knowledge/experiments/EXP-147/raw-data/context-full.md"
CONTEXT_SCOPED="agents/shared/knowledge/experiments/EXP-147/raw-data/context-scoped.md"
CONTEXT_TARGET="agents/bob/context.md"
CONTEXT_BACKUP="agents/bob/context.md.bak"

export PATH=".state/.bun/bin:$PATH"

# Backup original context
cp "$CONTEXT_TARGET" "$CONTEXT_BACKUP"
trap 'cp "$CONTEXT_BACKUP" "$CONTEXT_TARGET"; rm -f "$CONTEXT_BACKUP"' EXIT

COUNT=0
PASSED_COUNT=0
FAILED_COUNT=0

while IFS= read -r line; do
  if [ $COUNT -ge $MAX_RUNS ]; then
    echo "=== Reached max_runs=$MAX_RUNS, stopping ==="
    break
  fi

  SCENARIO=$(echo "$line" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['scenario'])")
  RUN_NUM=$(echo "$line" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['run'])")
  CONDITION=$(echo "$line" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['condition'])")

  # Swap context
  if [ "$CONDITION" = "scoped" ]; then
    cp "$CONTEXT_SCOPED" "$CONTEXT_TARGET"
  else
    cp "$CONTEXT_FULL" "$CONTEXT_TARGET"
  fi

  echo "--- [$((COUNT+1))] $SCENARIO run=$RUN_NUM condition=$CONDITION ---"

  START_TIME=$(date +%s)
  RESULT=$(scripts/gym-run.sh "$SCENARIO" --agent bob 2>&1) || true
  END_TIME=$(date +%s)
  ELAPSED=$((END_TIME - START_TIME))

  # Parse pass/fail
  PASSED=$(echo "$RESULT" | grep -oP '"passed":\s*(true|false)' | head -1 | grep -oP 'true|false') || true
  if [ -z "$PASSED" ]; then
    if echo "$RESULT" | grep -q "PASS\|✓\|passed.*true"; then
      PASSED="true"
    else
      PASSED="false"
    fi
  fi

  echo "{\"scenario\":\"$SCENARIO\",\"run\":$RUN_NUM,\"condition\":\"$CONDITION\",\"passed\":$PASSED,\"elapsed\":$ELAPSED}" >> "$OUTPUT_FILE"

  if [ "$PASSED" = "true" ]; then
    PASSED_COUNT=$((PASSED_COUNT + 1))
  else
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi

  COUNT=$((COUNT + 1))
  echo "  Result: passed=$PASSED elapsed=${ELAPSED}s (total: $COUNT done, $PASSED_COUNT pass, $FAILED_COUNT fail)"

done < "$INPUT_FILE"

echo "=== Batch complete: $COUNT runs, $PASSED_COUNT passed, $FAILED_COUNT failed ==="
