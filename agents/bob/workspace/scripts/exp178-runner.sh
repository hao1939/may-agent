#!/usr/bin/env bash
# EXP-178 Real Runner — Difficulty-Adaptive Content-First Guard Pilot
# Usage: ./exp178-runner.sh [N_PER_CELL] [START_TRIAL]
set -euo pipefail

N=${1:-15}
START=${2:-1}
RESULTS_FILE="agents/shared/knowledge/experiments/EXP-178/runs-real.jsonl"
GYM="agents/test/gym/run-gym.sh"

export GYM_AGENT_BIN=/usr/local/bin/may-agent

declare -A SCENARIOS
SCENARIOS[G1-sql]="sql-injection-in-query-builder"
SCENARIOS[G1-cas]="cascading-fix-trap-v2"
SCENARIOS[G2-sql]="sql-injection-in-query-builder-exp178-g2"
SCENARIOS[G2-cas]="cascading-fix-trap-v2-exp178-g2"
SCENARIOS[G3-sql]="sql-injection-in-query-builder-f1"
SCENARIOS[G3-cas]="cascading-fix-trap-v2-f1"
SCENARIOS[G4-sql]="sql-injection-in-query-builder-exp178-g2"
SCENARIOS[G4-cas]="cascading-fix-trap-v2-f1"

BATCH_ID="exp178-real-$(date +%s)"
echo "# EXP-178 Real Run — batch=$BATCH_ID N=$N start=$START" >&2
echo "# Results → $RESULTS_FILE" >&2

for arm in G1 G2 G3 G4; do
  for sc_type in sql cas; do
    key="${arm}-${sc_type}"
    scenario="${SCENARIOS[$key]}"
    sc_label=$( [ "$sc_type" = "sql" ] && echo "sql-injection" || echo "cascading" )
    
    for trial in $(seq $START $((START + N - 1))); do
      echo "[$(date +%H:%M:%S)] Running $arm × $sc_label trial $trial ($scenario)..." >&2
      
      # Run gym — capture stdout; if it's not valid JSON, use fallback
      raw=$(timeout 600 bash "$GYM" "$scenario" --agent amy --timeout 5 2>/dev/null | jq -c '.' 2>/dev/null | tail -1) || true
      if [ -z "$raw" ] || ! echo "$raw" | jq . >/dev/null 2>&1; then
        raw='{"passed":false,"agent_status":"gym-error","checks":[],"summary":"gym runner failed","duration":"0s"}'
      fi
      
      echo "$raw" | jq -c \
        --arg arm "$arm" \
        --arg scenario_type "$sc_label" \
        --arg scenario "$scenario" \
        --argjson trial "$trial" \
        --arg batch_id "$BATCH_ID" \
        --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '{arm: $arm, scenario_type: $scenario_type, scenario: $scenario, trial: $trial, passed: .passed, agent_status: .agent_status, duration: .duration, summary: .summary, checks: .checks, batch_id: $batch_id, timestamp: $timestamp}' \
        >> "$RESULTS_FILE"
      
      passed=$(echo "$raw" | jq -r '.passed // false')
      status=$(echo "$raw" | jq -r '.agent_status // "?"')
      dur=$(echo "$raw" | jq -r '.duration // "?"')
      echo "  → passed=$passed status=$status duration=$dur" >&2
    done
  done
done

echo "" >&2
echo "=== EXP-178 Complete ===" >&2
cat "$RESULTS_FILE" | jq -r '[.arm, .scenario_type, (.passed|tostring)] | join("\t")' | sort | uniq -c >&2
