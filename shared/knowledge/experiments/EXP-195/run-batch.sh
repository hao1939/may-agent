#!/usr/bin/env bash
# EXP-195 Batch Runner — 3 scenarios × 10 trials = 30 runs
# Tests whether relational-bug-recognition skill improves pass rate on cascading-fix-trap-v2
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
RESULTS_JSONL="$SCRIPT_DIR/results.jsonl"
LOG_FILE="$SCRIPT_DIR/batch.log"

mkdir -p "$RESULTS_DIR"
> "$RESULTS_JSONL"

export GYM_AGENT_BIN="${GYM_AGENT_BIN:-/usr/local/bin/may-agent}"
export GYM_PROJECT_ROOT="/app/agents"

RUNNER="/app/agents/test/gym/.gym-runner-bundle.mjs"

SCENARIOS=(
  "cascading-fix-trap-v2-exp195-skill"
  "cascading-fix-trap-v2-exp195-inline"
  "cascading-fix-trap-v2-exp195-direct"
)

TRIALS=10
AGENT="coder"
TIMEOUT=5
BATCH_ID="EXP-195-$(date +%Y%m%dT%H%M%S)"

echo "=== EXP-195 Batch Run ===" | tee "$LOG_FILE"
echo "Batch ID: $BATCH_ID" | tee -a "$LOG_FILE"
echo "Scenarios: ${SCENARIOS[*]}" | tee -a "$LOG_FILE"
echo "Trials per scenario: $TRIALS" | tee -a "$LOG_FILE"
echo "Agent: $AGENT, Timeout: ${TIMEOUT}min" | tee -a "$LOG_FILE"
echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

TOTAL=0
PASSED=0

for scenario in "${SCENARIOS[@]}"; do
  scenario_pass=0
  for trial in $(seq 1 $TRIALS); do
    TOTAL=$((TOTAL + 1))
    echo "[${TOTAL}/30] ${scenario} trial ${trial}/${TRIALS}..." | tee -a "$LOG_FILE"
    
    # Run gym scenario
    result_file="$RESULTS_DIR/${scenario}_trial${trial}.json"
    set +e
    output=$(node "$RUNNER" "$scenario" --agent "$AGENT" --timeout "$TIMEOUT" 2>&1)
    exit_code=$?
    set -e
    
    echo "$output" > "$result_file"
    
    # Extract pass/fail from JSON output
    if echo "$output" | grep -q '"passed": true'; then
      passed_str="PASS"
      PASSED=$((PASSED + 1))
      scenario_pass=$((scenario_pass + 1))
    else
      passed_str="FAIL"
    fi
    
    # Extract duration
    duration=$(echo "$output" | grep -o '"duration": "[^"]*"' | head -1 | cut -d'"' -f4)
    
    echo "  → ${passed_str} (${duration:-?})" | tee -a "$LOG_FILE"
    
    # Append JSONL with batch metadata
    echo "$output" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    data['_batch_id'] = '$BATCH_ID'
    data['_trial'] = $trial
    print(json.dumps(data))
except:
    print(json.dumps({'scenario': '$scenario', 'trial': $trial, 'passed': False, 'error': 'parse_failed', '_batch_id': '$BATCH_ID'}))
" >> "$RESULTS_JSONL" 2>/dev/null || true
    
  done
  echo "  ${scenario}: ${scenario_pass}/${TRIALS} passed" | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"
done

echo "=== SUMMARY ===" | tee -a "$LOG_FILE"
echo "Total: ${PASSED}/${TOTAL} passed" | tee -a "$LOG_FILE"
echo "Finished: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG_FILE"

# Per-scenario summary
echo "" | tee -a "$LOG_FILE"
for scenario in "${SCENARIOS[@]}"; do
  count=$(grep -c "\"passed\": true" "$RESULTS_DIR/${scenario}"_trial*.json 2>/dev/null || echo 0)
  echo "${scenario}: ${count}/${TRIALS}" | tee -a "$LOG_FILE"
done
