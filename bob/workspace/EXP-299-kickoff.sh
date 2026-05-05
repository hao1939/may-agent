#!/usr/bin/env bash
# EXP-299: Obstacle Persistence — Automated Run Script
# Hypothesis: H-215 — obstacle-persistence skill reduces OBSTACLE_PIVOT by ≥40%
# 
# Usage: bash agents/bob/workspace/EXP-299-kickoff.sh [control|treatment|both]
set -euo pipefail

PHASE="${1:-both}"
GYM_RUNNER="agents/test/gym/run-gym.sh"
CONTROL_SCENARIO="cascading-fix-trap-v3"
TREATMENT_SCENARIO="cascading-fix-trap-v3-exp299-treatment"
TRIALS=20
TIMEOUT=10  # minutes

CONTROL_DIR=".state/experiments/exp299-control"
TREATMENT_DIR=".state/experiments/exp299-treatment"

export GYM_AGENT_BIN="${GYM_AGENT_BIN:-/usr/local/bin/may-agent}"

mkdir -p "$CONTROL_DIR" "$TREATMENT_DIR"

run_trials() {
  local label="$1" dir="$2" scenario="$3"
  echo "=== Running $TRIALS $label trials on $scenario ==="
  for i in $(seq 1 $TRIALS); do
    echo "--- $label trial $i/$TRIALS ---"
    mkdir -p "$dir/trial-$i"
    bash "$GYM_RUNNER" "$scenario" --agent coder --timeout "$TIMEOUT" \
      2>&1 | tee "$dir/trial-$i.log" || true
  done
  echo "=== $label complete: $TRIALS trials in $dir ==="
}

if [ "$PHASE" = "control" ] || [ "$PHASE" = "both" ]; then
  run_trials "CONTROL" "$CONTROL_DIR" "$CONTROL_SCENARIO"
fi

if [ "$PHASE" = "treatment" ] || [ "$PHASE" = "both" ]; then
  run_trials "TREATMENT" "$TREATMENT_DIR" "$TREATMENT_SCENARIO"
fi

echo ""
echo "Done. Analyze results with:"
echo "  grep -l 'PASS\|pass' $CONTROL_DIR/trial-*.log | wc -l"
echo "  grep -l 'PASS\|pass' $TREATMENT_DIR/trial-*.log | wc -l"
