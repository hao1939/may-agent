#!/usr/bin/env bash
# EXP-147 Track B Phase 1: Main Execution Script
# Runs a batch of gym scenarios with context-swap treatment
# Usage: bash batch-run.sh <batch_number> <start_index> <end_index>
#   batch_number: 1, 2, 3, or 4 (for results file naming)
#   start_index: 0-based index into assignment table (inclusive)
#   end_index: 0-based index into assignment table (exclusive)

set -euo pipefail

BATCH="$1"
START="${2:-0}"
END="${3:-40}"

CONTEXT_DIR="agents/shared/knowledge/experiments/EXP-147/raw-data"
RESULTS_FILE="$CONTEXT_DIR/track-b-batch-${BATCH}.jsonl"
ASSIGNMENT_FILE="$CONTEXT_DIR/assignments.jsonl"

# Generate assignment table if not exists
if [ ! -f "$ASSIGNMENT_FILE" ]; then
  echo "Generating assignment table..."
  export PATH=".state/.bun/bin:$PATH"
  .state/.bun/bin/bun -e '
    import { createHash } from "crypto";
    const scenarios = [
      "read-before-edit", "convention-verify-edit", "plan-once-amend",
      "hidden-dependency", "cascading-fix-trap-v2", "stale-approach-fixation",
      "misleading-stacktrace", "contradictory-requirements"
    ];
    const assignments = [];
    for (const s of scenarios) {
      for (let r = 1; r <= 20; r++) {
        const hash = createHash("sha256").update(s + r + "EXP147B-balanced").digest("hex");
        const condition = parseInt(hash.slice(0, 8), 16) % 2 === 0 ? "full" : "scoped";
        assignments.push(JSON.stringify({ scenario: s, run: r, condition }));
      }
    }
    // Interleave: sort by scenario then run (natural order)
    console.log(assignments.join("\n"));
  ' > "$ASSIGNMENT_FILE"
  echo "Generated $(wc -l < "$ASSIGNMENT_FILE") assignments"
fi

echo "=== EXP-147B Batch $BATCH: runs $START to $END ==="
echo "Results: $RESULTS_FILE"

# Process each assignment in range
LINE=0
PASS=0
FAIL=0
ERROR=0

while IFS= read -r assignment; do
  if [ "$LINE" -lt "$START" ]; then
    LINE=$((LINE + 1))
    continue
  fi
  if [ "$LINE" -ge "$END" ]; then
    break
  fi
  
  SCENARIO=$(echo "$assignment" | .state/.bun/bin/bun -e 'const d=JSON.parse(await Bun.stdin.text());console.log(d.scenario)')
  RUN=$(echo "$assignment" | .state/.bun/bin/bun -e 'const d=JSON.parse(await Bun.stdin.text());console.log(d.run)')
  CONDITION=$(echo "$assignment" | .state/.bun/bin/bun -e 'const d=JSON.parse(await Bun.stdin.text());console.log(d.condition)')
  
  echo ""
  echo "--- Run $LINE: $SCENARIO #$RUN ($CONDITION) ---"
  
  # Swap context
  cp agents/bob/context.md agents/bob/context.md.exp147-backup
  if [ "$CONDITION" = "scoped" ]; then
    cp "$CONTEXT_DIR/context-scoped.md" agents/bob/context.md
  else
    cp "$CONTEXT_DIR/context-full.md" agents/bob/context.md
  fi
  
  # Run gym scenario
  START_TIME=$(date +%s)
  GYM_EXIT=0
  GYM_OUTPUT=$(scripts/gym-run.sh "$SCENARIO" --agent bob --timeout 5 2>&1) || GYM_EXIT=$?
  END_TIME=$(date +%s)
  ELAPSED=$((END_TIME - START_TIME))
  
  # Extract pass/fail from output
  PASSED="false"
  if echo "$GYM_OUTPUT" | grep -q "PASSED\|passed.*true\|✅.*PASS"; then
    PASSED="true"
    PASS=$((PASS + 1))
  elif echo "$GYM_OUTPUT" | grep -q "ERROR\|error.*launch\|TIMEOUT"; then
    ERROR=$((ERROR + 1))
  else
    FAIL=$((FAIL + 1))
  fi
  
  # Extract run ID from DB (last inserted)
  RUN_ID=$(.state/.bun/bin/bun -e '
    import {Database} from "bun:sqlite";
    const db = new Database(".state/may.db", {readonly: true});
    const row = db.query("SELECT id FROM gym_runs ORDER BY id DESC LIMIT 1").get();
    console.log(row?.id ?? "unknown");
  ' 2>/dev/null || echo "unknown")
  
  # Record result
  echo "{\"scenario\":\"$SCENARIO\",\"run\":$RUN,\"condition\":\"$CONDITION\",\"passed\":$PASSED,\"elapsed\":$ELAPSED,\"gym_exit\":$GYM_EXIT,\"db_run_id\":\"$RUN_ID\",\"index\":$LINE}" >> "$RESULTS_FILE"
  
  echo "  Result: passed=$PASSED, elapsed=${ELAPSED}s, db_run=$RUN_ID"
  
  # Always restore context
  cp agents/bob/context.md.exp147-backup agents/bob/context.md
  rm -f agents/bob/context.md.exp147-backup
  
  LINE=$((LINE + 1))
done < "$ASSIGNMENT_FILE"

echo ""
echo "=== Batch $BATCH Complete ==="
echo "Processed: $((LINE - START)) runs"
echo "Passed: $PASS, Failed: $FAIL, Errors: $ERROR"
echo "Results saved to: $RESULTS_FILE"
