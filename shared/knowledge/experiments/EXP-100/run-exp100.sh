#!/usr/bin/env bash
#
# EXP-100: Complexity-Induced Verification Collapse — Run Script
#
# Runs all 12 gym scenarios (3 arms × 2 scenarios × 2 repetitions)
# and collects results for analysis.
#
# Usage:
#   bash agents/shared/knowledge/experiments/EXP-100/run-exp100.sh [--arm A|B|C] [--dry-run]
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
RUN_GYM="$PROJECT_ROOT/scripts/gym-run.sh"
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)

# Parse args
ARM_FILTER=""
DRY_RUN=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --arm) ARM_FILTER="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

mkdir -p "$RESULTS_DIR"

# ── Scenario definitions ──────────────────────────────────────────────

# Arm A: Baseline
ARM_A_SCENARIOS=(
  "compound-edit-verification"
  "multi-file-verify-gap"
)

# Arm B: Scaffolding
ARM_B_SCENARIOS=(
  "compound-edit-verification-scaffolded"
  "multi-file-verify-gap-scaffolded"
)

# Arm C: Forced Checkpoint
ARM_C_SCENARIOS=(
  "compound-edit-verification-checkpoint"
  "multi-file-verify-gap-checkpoint"
)

REPS=2
AGENT="coder"
TIMEOUT=5

# ── Run function ──────────────────────────────────────────────────────

run_scenario() {
  local arm="$1"
  local scenario="$2"
  local rep="$3"
  local result_file="$RESULTS_DIR/${arm}_${scenario}_rep${rep}_${TIMESTAMP}.json"

  echo "─── Arm ${arm} | ${scenario} | Rep ${rep} ───"

  if $DRY_RUN; then
    echo "  [DRY RUN] Would run: $RUN_GYM $scenario --agent $AGENT --timeout $TIMEOUT"
    echo "  [DRY RUN] Output to: $result_file"
    return 0
  fi

  # Run the scenario and capture output
  local output
  if output=$("$RUN_GYM" "$scenario" --agent "$AGENT" --timeout "$TIMEOUT" 2>&1); then
    echo "$output" > "$result_file"
    echo "  ✓ Completed → $result_file"
  else
    echo "$output" > "$result_file"
    echo "  ✗ Failed (exit code $?) → $result_file"
  fi

  # Extract pass/fail from JSON output
  local passed
  passed=$(echo "$output" | grep -o '"passed":[^,}]*' | head -1 || echo '"passed":unknown')
  echo "  Result: $passed"
  echo ""
}

# ── Execute runs ──────────────────────────────────────────────────────

echo "╔══════════════════════════════════════════════╗"
echo "║  EXP-100: CIVC Interventional Test           ║"
echo "║  ${TIMESTAMP}                                ║"
echo "║  12 runs (3 arms × 2 scenarios × 2 reps)    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

total=0
run_arm() {
  local arm_name="$1"
  shift
  local scenarios=("$@")

  if [[ -n "$ARM_FILTER" && "$ARM_FILTER" != "$arm_name" ]]; then
    echo "⏩ Skipping Arm $arm_name (filter: --arm $ARM_FILTER)"
    echo ""
    return
  fi

  echo "═══ ARM ${arm_name} ═══"
  for scenario in "${scenarios[@]}"; do
    for rep in $(seq 1 $REPS); do
      run_scenario "$arm_name" "$scenario" "$rep"
      total=$((total + 1))
    done
  done
}

run_arm "A" "${ARM_A_SCENARIOS[@]}"
run_arm "B" "${ARM_B_SCENARIOS[@]}"
run_arm "C" "${ARM_C_SCENARIOS[@]}"

echo "═══════════════════════════════════════════════"
echo "Complete: $total runs executed"
echo "Results in: $RESULTS_DIR/"
echo ""
echo "Next step: Run analysis with:"
echo "  node $SCRIPT_DIR/analyze-results.js"
