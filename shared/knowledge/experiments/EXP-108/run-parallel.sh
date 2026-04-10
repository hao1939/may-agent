#!/usr/bin/env bash
# EXP-108 Phase 2 - Parallel batch runner
# Runs control and treatment arms, 3 reps each, for all 3 scenarios
# Parallelizes across scenarios (3 concurrent runs)
set -euo pipefail

export GYM_AGENT_BIN=/app/bundle/may-agent
EXPERIMENT_DIR="/app/agents/shared/knowledge/experiments/EXP-108"
RESULTS_DIR="$EXPERIMENT_DIR/phase2-raw-results"
SKILL_FILE="/app/agents/.lab/exp108-adversarial-skill/coder/skills/adversarial-self-review.md"
SCENARIOS_DIR="/app/agents/gym/scenarios/multi-session"
AGENT="bob"

mkdir -p "$RESULTS_DIR"

run_single() {
  local scenario=$1
  local arm=$2
  local rep=$3
  local result_file="$RESULTS_DIR/${scenario}_${arm}_rep${rep}.json"
  local log_file="$RESULTS_DIR/${scenario}_${arm}_rep${rep}.log"
  
  echo "[$(date -u)] START: $scenario $arm rep$rep" >> "$log_file"
  
  local context_file="$SCENARIOS_DIR/$scenario/session-2/context.md"
  local backup_file="$context_file.${arm}_rep${rep}.bak"
  
  # For treatment: inject skill
  if [ "$arm" = "treatment" ]; then
    cp "$context_file" "$backup_file"
    {
      cat "$SKILL_FILE"
      echo ""
      echo "---"
      echo ""
      cat "$backup_file"
    } > "$context_file"
  fi
  
  # Run
  local result
  result=$(cd /app && bash test/gym/run-gym.sh \
    "multi-session/$scenario" \
    --agent "$AGENT" \
    --timeout 10 \
    2>>"$log_file") || result='{"error":true}'
  
  # Restore
  if [ "$arm" = "treatment" ] && [ -f "$backup_file" ]; then
    mv "$backup_file" "$context_file"
  fi
  
  # Annotate and save
  echo "$result" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
except:
    data = {'error': True, 'raw': sys.stdin.read()}
data['arm'] = '$arm'
data['rep'] = $rep
data['experiment'] = 'EXP-108'
data['scenario_short'] = '$scenario'
print(json.dumps(data))
" > "$result_file" 2>>"$log_file" || echo "$result" > "$result_file"
  
  echo "[$(date -u)] DONE: $scenario $arm rep$rep" >> "$log_file"
}

# Run one scenario's full set sequentially (control and treatment can't run in parallel
# because they modify the same context.md file)
run_scenario_set() {
  local scenario=$1
  for arm in control treatment; do
    for rep in 1 2 3; do
      run_single "$scenario" "$arm" "$rep"
    done
  done
}

echo "=== EXP-108 Phase 2 Starting — $(date -u) ==="
echo "Running 3 scenarios in parallel, each with 6 runs (3 control + 3 treatment)"

# Run all 3 scenarios in parallel
run_scenario_set "phase-boundary-violation" &
PID1=$!
run_scenario_set "instruction-override-drift" &
PID2=$!
run_scenario_set "unresolved-failure-chain" &
PID3=$!

echo "PIDs: $PID1 $PID2 $PID3"
echo "Waiting for all to complete..."

wait $PID1
echo "phase-boundary-violation DONE"
wait $PID2
echo "instruction-override-drift DONE"
wait $PID3
echo "unresolved-failure-chain DONE"

echo "=== EXP-108 Phase 2 Complete — $(date -u) ==="
echo "Results in: $RESULTS_DIR"
ls -la "$RESULTS_DIR"/*.json 2>/dev/null | wc -l
echo " result files created"
