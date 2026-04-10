#!/usr/bin/env bash
# EXP-116 Phase 2 Batch Runner
# Runs all 36 trials: 5 arms × 2 scenarios × 3 reps + clean-handoff controls
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/phase2-raw"
RESULTS_JSONL="$SCRIPT_DIR/phase2-results.jsonl"
LOG_FILE="$SCRIPT_DIR/phase2-runs.log"

mkdir -p "$RESULTS_DIR"

# Clear previous results
> "$RESULTS_JSONL"

export GYM_AGENT_BIN="${GYM_AGENT_BIN:-/app/may-agent-bin}"

# EXP-116 scenario mapping
# Arm → scenario variant suffix mapping
declare -A SCENARIO_SUFFIX
SCENARIO_SUFFIX[baseline]=""
SCENARIO_SUFFIX[arm_a]="-adversarial"
SCENARIO_SUFFIX[arm_b]="-machine-verified"
SCENARIO_SUFFIX[arm_c]="-combined"
SCENARIO_SUFFIX[arm_d]="-combined-guard"

# Main scenarios (multi-session)
SCENARIOS=("kb-integration-failure" "ghost-deliverable-chain")
ARMS=("baseline" "arm_a" "arm_b" "arm_c" "arm_d")
REPS=3

# Clean-handoff scenarios (single-session, run via standard gym runner)
CLEAN_ARMS=("baseline" "arm_c")

echo "# EXP-116 Phase 2 Batch Run — $(date -u)" | tee "$LOG_FILE"
echo "# 36 trials total" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

run_count=0
total_runs=36

for scenario in "${SCENARIOS[@]}"; do
  for arm in "${ARMS[@]}"; do
    suffix="${SCENARIO_SUFFIX[$arm]}"
    full_scenario="multi-session/${scenario}${suffix}"
    
    for rep in $(seq 1 $REPS); do
      run_count=$((run_count + 1))
      run_id="${scenario}${suffix}_${arm}_rep${rep}"
      echo "" | tee -a "$LOG_FILE"
      echo "=== Run $run_count/$total_runs: $full_scenario | $arm | rep $rep ===" | tee -a "$LOG_FILE"
      
      result_file="$RESULTS_DIR/${run_id}.json"
      
      # Run multi-session scenario
      if result=$(bash "$SCRIPT_DIR/run-exp116.sh" "$full_scenario" --agent bob --timeout 5 2>>"$LOG_FILE"); then
        echo "$result" > "$result_file"
      else
        echo "$result" > "$result_file" 2>/dev/null || true
      fi
      
      # Annotate with arm/rep metadata and append to JSONL
      python3 -c "
import json, sys
try:
    with open('$result_file') as f:
        data = json.load(f)
except:
    data = {'scenario': '$full_scenario', 'passed': False, 'checks': [], 'summary': 'Failed to parse result', 'agent_status': 'error'}
data['arm'] = '$arm'
data['rep'] = $rep
data['experiment'] = 'EXP-116'
data['run_id'] = '$run_id'
# Also save annotated version
with open('$result_file', 'w') as f:
    json.dump(data, f, indent=2)
print(json.dumps(data))
" >> "$RESULTS_JSONL" 2>>"$LOG_FILE"
      
      # Quick status
      passed=$(python3 -c "import json; print(json.load(open('$result_file')).get('passed', False))" 2>/dev/null || echo "error")
      checks=$(python3 -c "import json; d=json.load(open('$result_file')); cs=d.get('checks',[]); print(f\"{sum(1 for c in cs if c.get('passed'))}/{len(cs)}\")" 2>/dev/null || echo "?/?")
      echo "  Result: passed=$passed checks=$checks" | tee -a "$LOG_FILE"
    done
  done
done

# Clean-handoff scenarios (use standard gym runner, not multi-session)
echo "" | tee -a "$LOG_FILE"
echo "=== Clean-Handoff Scenarios ===" | tee -a "$LOG_FILE"

# Check if clean-handoff variants exist as standard gym scenarios
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
GYM_DIR="$PROJECT_ROOT/agents/gym/scenarios"

for arm in "${CLEAN_ARMS[@]}"; do
  suffix="${SCENARIO_SUFFIX[$arm]}"
  clean_scenario="multi-session/clean-handoff${suffix}"
  
  for rep in $(seq 1 $REPS); do
    run_count=$((run_count + 1))
    run_id="clean-handoff${suffix}_${arm}_rep${rep}"
    echo "" | tee -a "$LOG_FILE"
    echo "=== Run $run_count/$total_runs: $clean_scenario | $arm | rep $rep ===" | tee -a "$LOG_FILE"
    
    result_file="$RESULTS_DIR/${run_id}.json"
    
    # Run via multi-session runner (clean-handoff also has session-1/session-2 structure)
    if result=$(bash "$SCRIPT_DIR/run-exp116.sh" "$clean_scenario" --agent bob --timeout 5 2>>"$LOG_FILE"); then
      echo "$result" > "$result_file"
    else
      echo "$result" > "$result_file" 2>/dev/null || true
    fi
    
    # Annotate
    python3 -c "
import json, sys
try:
    with open('$result_file') as f:
        data = json.load(f)
except:
    data = {'scenario': '$clean_scenario', 'passed': False, 'checks': [], 'summary': 'Failed to parse result', 'agent_status': 'error'}
data['arm'] = '$arm'
data['rep'] = $rep
data['experiment'] = 'EXP-116'
data['run_id'] = '$run_id'
with open('$result_file', 'w') as f:
    json.dump(data, f, indent=2)
print(json.dumps(data))
" >> "$RESULTS_JSONL" 2>>"$LOG_FILE"
    
    passed=$(python3 -c "import json; print(json.load(open('$result_file')).get('passed', False))" 2>/dev/null || echo "error")
    checks=$(python3 -c "import json; d=json.load(open('$result_file')); cs=d.get('checks',[]); print(f\"{sum(1 for c in cs if c.get('passed'))}/{len(cs)}\")" 2>/dev/null || echo "?/?")
    echo "  Result: passed=$passed checks=$checks" | tee -a "$LOG_FILE"
  done
done

echo "" | tee -a "$LOG_FILE"
echo "=== All $run_count runs complete — $(date -u) ===" | tee -a "$LOG_FILE"
echo "Results in: $RESULTS_JSONL" | tee -a "$LOG_FILE"
echo "Raw results in: $RESULTS_DIR/" | tee -a "$LOG_FILE"
