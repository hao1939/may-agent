#!/usr/bin/env bash
# EXP-108 Phase 2 batch runner
# Runs 18 gym runs (3 scenarios × 2 arms × 3 reps) and collects results
set -euo pipefail

RESULTS_FILE="/app/agents/shared/knowledge/experiments/EXP-108/phase2-results.jsonl"
LOG_FILE="/app/agents/shared/knowledge/experiments/EXP-108/phase2-runs.log"

scenarios=(
  "multi-session/phase-boundary-violation"
  "multi-session/instruction-override-drift"
  "multi-session/unresolved-failure-chain"
)

echo "# EXP-108 Phase 2 Batch Run — $(date -u)" | tee -a "$LOG_FILE"
echo "# 18 runs: 3 scenarios × 2 arms × 3 reps" | tee -a "$LOG_FILE"

run_count=0
for scenario in "${scenarios[@]}"; do
  for arm in "control" "treatment"; do
    for rep in 1 2 3; do
      run_count=$((run_count + 1))
      echo "" | tee -a "$LOG_FILE"
      echo "=== Run $run_count/18: $scenario | $arm | rep $rep ===" | tee -a "$LOG_FILE"
      
      if [ "$arm" = "treatment" ]; then
        lab_flag="--lab exp108-adversarial-skill"
      else
        lab_flag=""
      fi
      
      # Run and capture stdout (JSON result)
      result=$(cd /app && bash scripts/gym-run.sh "$scenario" --agent coder $lab_flag --timeout 8 2>>"$LOG_FILE") || {
        echo "FAILED: $scenario $arm rep $rep" | tee -a "$LOG_FILE"
        echo "{\"scenario\":\"$scenario\",\"arm\":\"$arm\",\"rep\":$rep,\"error\":true}" >> "$RESULTS_FILE"
        continue
      }
      
      # Annotate result with arm/rep info and append
      echo "$result" | python3 -c "
import sys, json
data = json.load(sys.stdin)
data['arm'] = '$arm'
data['rep'] = $rep
data['experiment'] = 'EXP-108'
print(json.dumps(data))
" >> "$RESULTS_FILE" 2>>"$LOG_FILE" || echo "$result" >> "$RESULTS_FILE"
      
      echo "Done: $scenario | $arm | rep $rep" | tee -a "$LOG_FILE"
    done
  done
done

echo "" | tee -a "$LOG_FILE"
echo "=== All $run_count runs complete — $(date -u) ===" | tee -a "$LOG_FILE"
echo "Results in: $RESULTS_FILE"
