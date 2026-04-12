#!/usr/bin/env bash
#
# EXP-147 Track B Phase 1 Runner
# Runs gym scenarios with context swapping based on assignment table
#
# Usage: bash run-batch.sh <scenario> <output_jsonl>
#
set -euo pipefail

SCENARIO="$1"
OUTPUT_FILE="$2"
ASSIGNMENT_TABLE="agents/shared/knowledge/experiments/EXP-147/raw-data/assignment-table.json"
CONTEXT_FULL="agents/shared/knowledge/experiments/EXP-147/raw-data/context-full.md"
CONTEXT_SCOPED="agents/shared/knowledge/experiments/EXP-147/raw-data/context-scoped.md"
CONTEXT_TARGET="agents/bob/context.md"
CONTEXT_BACKUP="agents/bob/context.md.bak"

export PATH=".state/.bun/bin:$PATH"

# Backup original context
cp "$CONTEXT_TARGET" "$CONTEXT_BACKUP"

# Extract assignments for this scenario
ASSIGNMENTS=$(.state/.bun/bin/bun -e "
  const data = JSON.parse(require('fs').readFileSync('$ASSIGNMENT_TABLE', 'utf8'));
  const filtered = data.assignments.filter(a => a.scenario === '$SCENARIO');
  filtered.forEach(a => console.log(JSON.stringify({run: a.run_number, condition: a.condition})));
")

RUN_INDEX=0
while IFS= read -r assignment; do
  RUN_NUM=$(echo "$assignment" | .state/.bun/bin/bun -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.run)")
  CONDITION=$(echo "$assignment" | .state/.bun/bin/bun -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.condition)")
  
  # Swap context
  if [ "$CONDITION" = "scoped" ]; then
    cp "$CONTEXT_SCOPED" "$CONTEXT_TARGET"
  else
    cp "$CONTEXT_FULL" "$CONTEXT_TARGET"
  fi
  
  echo "--- Run $RUN_NUM/$SCENARIO condition=$CONDITION ---"
  
  # Run gym scenario and capture result
  START_TIME=$(date +%s)
  RESULT=$(scripts/gym-run.sh "$SCENARIO" --agent bob 2>&1) || true
  END_TIME=$(date +%s)
  ELAPSED=$((END_TIME - START_TIME))
  
  # Parse pass/fail from output
  PASSED=$(echo "$RESULT" | grep -oP '"passed":\s*(true|false)' | head -1 | grep -oP 'true|false')
  DB_RUN_ID=$(echo "$RESULT" | grep -oP '"run_id":\s*\d+' | head -1 | grep -oP '\d+' || echo "unknown")
  
  if [ -z "$PASSED" ]; then
    # Try alternate parsing
    if echo "$RESULT" | grep -q "PASS\|✓\|passed.*true"; then
      PASSED="true"
    else
      PASSED="false"
    fi
  fi
  
  # Write JSONL record
  echo "{\"scenario\":\"$SCENARIO\",\"run\":$RUN_NUM,\"condition\":\"$CONDITION\",\"passed\":$PASSED,\"elapsed\":$ELAPSED,\"db_run_id\":\"$DB_RUN_ID\",\"index\":$RUN_INDEX}" >> "$OUTPUT_FILE"
  
  RUN_INDEX=$((RUN_INDEX + 1))
  echo "  Result: passed=$PASSED elapsed=${ELAPSED}s"
  
done <<< "$ASSIGNMENTS"

# Restore original context
cp "$CONTEXT_BACKUP" "$CONTEXT_TARGET"
rm -f "$CONTEXT_BACKUP"

echo "=== $SCENARIO complete: $RUN_INDEX runs recorded to $OUTPUT_FILE ==="
