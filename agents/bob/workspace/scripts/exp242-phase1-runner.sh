#!/usr/bin/env bash
# EXP-242 Phase 1: Sequential Auditor → Primary Agent
# Arm B: Primary fixes value bug → Auditor detects ordering → Primary gets report → fixes ordering
#
# Protocol:
#   1. Run auditor on cascading-fix-trap-v2-exp242-auditor → extract AUDIT-REPORT.md
#   2. Copy base scenario into temp sequential scenario with AUDIT-REPORT.md injected
#   3. Run primary agent on sequential scenario (task says "read AUDIT-REPORT.md")
#   4. Score with base scenario success criteria
#
# Usage: ./exp242-phase1-runner.sh [N_TRIALS] [START_TRIAL]
set -euo pipefail

N=${1:-5}
START=${2:-1}
RESULTS_DIR="agents/bob/workspace/exp242-phase1-results"
RESULTS_FILE="$RESULTS_DIR/runs.jsonl"
GYM="agents/test/gym/run-gym.sh"
SCENARIOS_DIR="agents/gym/scenarios"
BASE_SCENARIO="cascading-fix-trap-v2"
AUDITOR_SCENARIO="cascading-fix-trap-v2-exp242-auditor"
SEQ_SCENARIO="cascading-fix-trap-v2-exp242-sequential"

export GYM_AGENT_BIN=/usr/local/bin/may-agent

mkdir -p "$RESULTS_DIR"

# ── Create the sequential scenario (base + auditor report in env + modified task) ──
create_sequential_scenario() {
  local audit_report="$1"
  local seq_dir="$SCENARIOS_DIR/$SEQ_SCENARIO"
  
  # Copy base scenario
  rm -rf "$seq_dir"
  cp -r "$SCENARIOS_DIR/$BASE_SCENARIO" "$seq_dir"
  
  # Update scenario.json
  cat > "$seq_dir/scenario.json" <<'SCJSON'
{
  "name": "cascading-fix-trap-v2-exp242-sequential",
  "description": "EXP-242 Phase 1 Arm B: Primary agent with auditor report injected",
  "difficulty": "hard",
  "time_limit": 300
}
SCJSON
  
  # Inject the auditor's report into the environment
  cp "$audit_report" "$seq_dir/environment/AUDIT-REPORT.md"
  
  # Modify the task to reference the auditor report
  cat > "$seq_dir/task.md" <<'TASK'
Fix the failing tests in this student grade processing pipeline.

The pipeline reads student grade data from CSV, applies late submission
penalties, computes homework averages (dropping the lowest score),
calculates weighted final grades, and generates a class report.

Some tests are failing — the computed grades don't match expected values.
Investigate the pipeline, find the bugs, and fix them so all tests pass.

**Important**: A structural auditor has already reviewed this codebase and
produced `AUDIT-REPORT.md` in the project root. Read this report — it
contains findings about ordering/sequencing issues that may be relevant.

Run the tests with: `node test/test.js`

Important:
- Do NOT modify the test file (test/test.js) 
- Do NOT modify the data file (data/grades.csv)
- Do NOT modify the policy configuration (src/policy.js)
- The policy defines: homework 40%, midterm 25%, final 35%
TASK

  echo "$seq_dir"
}

BATCH_ID="exp242-p1-$(date +%s)"
echo "# EXP-242 Phase 1 — Sequential Auditor → Primary" >&2
echo "# batch=$BATCH_ID N=$N start=$START" >&2
echo "# Results → $RESULTS_FILE" >&2

# ── Also run baseline (Arm A) for comparison ──
echo "" >&2
echo "═══ ARM A: BASELINE (no auditor) ═══" >&2
for trial in $(seq $START $((START + N - 1))); do
  echo "[$(date +%H:%M:%S)] Arm A trial $trial..." >&2
  
  raw=$(timeout 600 bash "$GYM" "$BASE_SCENARIO" --agent amy --timeout 5 2>/dev/null | jq -c '.' 2>/dev/null | tail -1) || true
  if [ -z "$raw" ] || ! echo "$raw" | jq . >/dev/null 2>&1; then
    raw='{"passed":false,"agent_status":"gym-error","checks":[],"summary":"gym runner failed","duration":"0s"}'
  fi
  
  echo "$raw" | jq -c \
    --arg arm "A-baseline" \
    --argjson trial "$trial" \
    --arg batch_id "$BATCH_ID" \
    --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{arm: $arm, trial: $trial, passed: .passed, agent_status: .agent_status, duration: .duration, summary: .summary, checks: .checks, batch_id: $batch_id, timestamp: $timestamp}' \
    >> "$RESULTS_FILE"
  
  passed=$(echo "$raw" | jq -r '.passed // false')
  echo "  → passed=$passed" >&2
done

# ── ARM B: Sequential (auditor → primary) ──
echo "" >&2
echo "═══ ARM B: SEQUENTIAL (auditor → primary) ═══" >&2
for trial in $(seq $START $((START + N - 1))); do
  echo "[$(date +%H:%M:%S)] Arm B trial $trial — Step 1: Running auditor..." >&2
  
  # Step 1: Run auditor
  auditor_raw=$(timeout 600 bash "$GYM" "$AUDITOR_SCENARIO" --agent amy --timeout 5 2>/dev/null | jq -c '.' 2>/dev/null | tail -1) || true
  if [ -z "$auditor_raw" ] || ! echo "$auditor_raw" | jq . >/dev/null 2>&1; then
    auditor_raw='{"passed":false,"agent_status":"gym-error","checks":[]}'
  fi
  
  auditor_detected=$(echo "$auditor_raw" | jq -r '[.checks[]? | select(.name == "ordering-bug-detected" and .passed == true)] | length > 0')
  echo "  Auditor detected ordering bug: $auditor_detected" >&2
  
  # Find the auditor's AUDIT-REPORT.md in /tmp
  audit_report=""
  for d in /tmp/gym-${AUDITOR_SCENARIO}-*/; do
    if [ -d "$d" ]; then
      for f in "$d/AUDIT-REPORT.md" "$d/environment/AUDIT-REPORT.md"; do
        if [ -f "$f" ]; then
          audit_report="$f"
        fi
      done
    fi
  done
  
  if [ -z "$audit_report" ] || [ ! -f "$audit_report" ]; then
    echo "  ⚠️  No AUDIT-REPORT.md found, using fallback report" >&2
    # Create a generic auditor report based on Phase 0 findings
    audit_report="/tmp/exp242-fallback-audit-report.md"
    cat > "$audit_report" <<'FALLBACK'
# Structural Audit Report

## Finding 1: Pipeline Ordering Bug (CRITICAL)

**File**: `src/pipeline.js`  
**Issue**: The `normalize()` function is called BEFORE `applyPenalties()`.

This is incorrect. Late penalties should be applied to raw scores BEFORE normalization.
Current order: normalize → penalize (WRONG)
Correct order: penalize → normalize

The normalization step scales scores to a 0-100 range. If penalties are applied after
normalization, the penalty amounts are wrong because they're being subtracted from
normalized values rather than raw values.

## Finding 2: Threshold Comparison

**File**: Check grade boundary comparisons — look for `>` that should be `>=`.
FALLBACK
  fi
  
  echo "  Using audit report: $audit_report" >&2
  
  # Step 2: Create sequential scenario with auditor report
  seq_dir=$(create_sequential_scenario "$audit_report")
  echo "  Sequential scenario created at: $seq_dir" >&2
  
  # Step 3: Run primary agent on sequential scenario  
  echo "  Step 2: Running primary with auditor report..." >&2
  primary_raw=$(timeout 600 bash "$GYM" "$SEQ_SCENARIO" --agent amy --timeout 5 2>/dev/null | jq -c '.' 2>/dev/null | tail -1) || true
  if [ -z "$primary_raw" ] || ! echo "$primary_raw" | jq . >/dev/null 2>&1; then
    primary_raw='{"passed":false,"agent_status":"gym-error","checks":[],"summary":"gym runner failed","duration":"0s"}'
  fi
  
  echo "$primary_raw" | jq -c \
    --arg arm "B-sequential" \
    --argjson trial "$trial" \
    --arg batch_id "$BATCH_ID" \
    --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg auditor_detected "$auditor_detected" \
    '{arm: $arm, trial: $trial, passed: .passed, agent_status: .agent_status, duration: .duration, summary: .summary, checks: .checks, auditor_detected: $auditor_detected, batch_id: $batch_id, timestamp: $timestamp}' \
    >> "$RESULTS_FILE"
  
  passed=$(echo "$primary_raw" | jq -r '.passed // false')
  echo "  → passed=$passed" >&2
  
  # Cleanup temp dirs to avoid stale reports
  rm -rf /tmp/gym-${AUDITOR_SCENARIO}-* 2>/dev/null || true
  rm -rf /tmp/gym-${SEQ_SCENARIO}-* 2>/dev/null || true
done

echo "" >&2
echo "═══ SUMMARY ═══" >&2
echo "Results in: $RESULTS_FILE" >&2
if [ -f "$RESULTS_FILE" ]; then
  a_pass=$(grep '"A-baseline"' "$RESULTS_FILE" | grep -c '"passed":true' || echo 0)
  a_total=$(grep -c '"A-baseline"' "$RESULTS_FILE" || echo 0)
  b_pass=$(grep '"B-sequential"' "$RESULTS_FILE" | grep -c '"passed":true' || echo 0)
  b_total=$(grep -c '"B-sequential"' "$RESULTS_FILE" || echo 0)
  echo "Arm A (baseline): $a_pass/$a_total passed" >&2
  echo "Arm B (sequential): $b_pass/$b_total passed" >&2
fi
