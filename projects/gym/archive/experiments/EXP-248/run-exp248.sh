#!/usr/bin/env bash
# EXP-248: Belief-State Externalization vs Verification Gravity Wells
#
# Scenarios: fm33-verify-broken, compound-edit-verification, partial-verification-trap
# Arms: A (baseline), B (+ belief externalization context)
# N: 5 per scenario per arm = 30 total trials
#
# Usage: bash agents/gym/experiments/EXP-248/run-exp248.sh [arm] [scenario]
#   arm: "baseline" or "treatment" (default: both)
#   scenario: specific scenario name (default: all three)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GYM_RUNNER="agents/test/gym/run-gym.sh"
RESULTS_DIR="$SCRIPT_DIR/results"
CONTEXT_FILE="$SCRIPT_DIR/belief-externalization-context.md"

SCENARIOS=("fm33-verify-broken" "compound-edit-verification" "partial-verification-trap")
TRIALS_PER=5

export GYM_AGENT_BIN=/usr/local/bin/may-agent

mkdir -p "$RESULTS_DIR/arm-a" "$RESULTS_DIR/arm-b"

run_arm() {
  local arm=$1
  local scenario=$2
  local n=$3
  local outdir="$RESULTS_DIR/arm-${arm}"
  
  echo "=== Running Arm $arm | Scenario: $scenario | N=$n ==="
  
  for i in $(seq 1 $n); do
    echo "  Trial $i/$n..."
    if [ "$arm" = "b" ]; then
      # Treatment: inject belief externalization context
      bash "$GYM_RUNNER" "$scenario" --timeout 5 --inject-context "$CONTEXT_FILE" \
        > "$outdir/${scenario}-trial-${i}.log" 2>&1 || true
    else
      # Baseline: no extra context
      bash "$GYM_RUNNER" "$scenario" --timeout 5 \
        > "$outdir/${scenario}-trial-${i}.log" 2>&1 || true
    fi
  done
}

ARM_FILTER="${1:-both}"
SCENARIO_FILTER="${2:-all}"

for scenario in "${SCENARIOS[@]}"; do
  if [ "$SCENARIO_FILTER" != "all" ] && [ "$SCENARIO_FILTER" != "$scenario" ]; then
    continue
  fi
  
  if [ "$ARM_FILTER" = "both" ] || [ "$ARM_FILTER" = "baseline" ]; then
    run_arm "a" "$scenario" "$TRIALS_PER"
  fi
  
  if [ "$ARM_FILTER" = "both" ] || [ "$ARM_FILTER" = "treatment" ]; then
    run_arm "b" "$scenario" "$TRIALS_PER"
  fi
done

echo ""
echo "=== EXP-248 Complete ==="
echo "Results in: $RESULTS_DIR"
echo "Arm A (baseline): $(ls $RESULTS_DIR/arm-a/*.log 2>/dev/null | wc -l) trials"
echo "Arm B (treatment): $(ls $RESULTS_DIR/arm-b/*.log 2>/dev/null | wc -l) trials"
