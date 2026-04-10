#!/usr/bin/env bash
# EXP-108 Phase 2 Experiment Runner
# Runs 18 gym runs (3 scenarios × 2 arms × 3 reps)
# 
# Key difference from generic runner: 
# - Uses --agent bob (since "coder" is not registered in current binary)
# - For treatment arm: injects adversarial-self-review skill into S2 context
set -euo pipefail

EXPERIMENT_DIR="/app/agents/shared/knowledge/experiments/EXP-108"
RESULTS_FILE="$EXPERIMENT_DIR/phase2-results.jsonl"
LOG_FILE="$EXPERIMENT_DIR/phase2-runs.log"
SKILL_FILE="/app/agents/.lab/exp108-adversarial-skill/coder/skills/adversarial-self-review.md"
SCENARIOS_DIR="/app/agents/gym/scenarios/multi-session"
AGENT="bob"  # "coder" not registered in current binary; bob is the closest equivalent

scenarios=(
  "phase-boundary-violation"
  "instruction-override-drift"
  "unresolved-failure-chain"
)

echo "# EXP-108 Phase 2 — $(date -u)" | tee -a "$LOG_FILE"
echo "# Agent: $AGENT | 18 runs: 3 scenarios × 2 arms × 3 reps" | tee -a "$LOG_FILE"

inject_skill() {
  local scenario_dir="$SCENARIOS_DIR/$1"
  local context_file="$scenario_dir/session-2/context.md"
  local backup_file="$context_file.bak"
  
  # Backup original context
  cp "$context_file" "$backup_file"
  
  # Prepend skill content to session-2 context
  local skill_content
  skill_content=$(cat "$SKILL_FILE")
  {
    echo "$skill_content"
    echo ""
    echo "---"
    echo ""
    cat "$backup_file"
  } > "$context_file"
}

restore_context() {
  local scenario_dir="$SCENARIOS_DIR/$1"
  local context_file="$scenario_dir/session-2/context.md"
  local backup_file="$context_file.bak"
  
  if [ -f "$backup_file" ]; then
    mv "$backup_file" "$context_file"
  fi
}

# Cleanup function to restore all contexts on exit
cleanup() {
  for scenario in "${scenarios[@]}"; do
    restore_context "$scenario"
  done
}
trap cleanup EXIT

run_count=0
for scenario in "${scenarios[@]}"; do
  for arm in "control" "treatment"; do
    for rep in 1 2 3; do
      run_count=$((run_count + 1))
      echo "" | tee -a "$LOG_FILE"
      echo "=== Run $run_count/18: $scenario | $arm | rep $rep — $(date -u) ===" | tee -a "$LOG_FILE"
      
      # For treatment: inject skill into session-2 context
      if [ "$arm" = "treatment" ]; then
        inject_skill "$scenario"
      fi
      
      # Run the gym scenario
      result=$(cd /app && GYM_AGENT_BIN=/app/bundle/may-agent bash test/gym/run-gym.sh \
        "multi-session/$scenario" \
        --agent "$AGENT" \
        --keep \
        --timeout 10 \
        2>>"$LOG_FILE") || {
        echo "FAILED: $scenario $arm rep $rep" | tee -a "$LOG_FILE"
        echo "{\"scenario\":\"multi-session/$scenario\",\"arm\":\"$arm\",\"rep\":$rep,\"experiment\":\"EXP-108\",\"agent\":\"$AGENT\",\"error\":true}" >> "$RESULTS_FILE"
        # Restore context if treatment
        if [ "$arm" = "treatment" ]; then
          restore_context "$scenario"
        fi
        continue
      }
      
      # Restore context after treatment run
      if [ "$arm" = "treatment" ]; then
        restore_context "$scenario"
      fi
      
      # Annotate result with arm/rep info and append
      echo "$result" | python3 -c "
import sys, json
data = json.load(sys.stdin)
data['arm'] = '$arm'
data['rep'] = $rep
data['experiment'] = 'EXP-108'
print(json.dumps(data))
" >> "$RESULTS_FILE" 2>>"$LOG_FILE" || {
        # Fallback: just dump raw result
        echo "$result" >> "$RESULTS_FILE"
      }
      
      echo "Done: $scenario | $arm | rep $rep (run $run_count/18)" | tee -a "$LOG_FILE"
    done
  done
done

echo "" | tee -a "$LOG_FILE"
echo "=== All $run_count runs complete — $(date -u) ===" | tee -a "$LOG_FILE"
echo "Results in: $RESULTS_FILE"
