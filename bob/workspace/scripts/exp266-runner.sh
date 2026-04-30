#!/usr/bin/env bash
# EXP-266: Trigger-Based Rule Ablation
set -euo pipefail

N=${1:-7}
GYM="agents/test/gym/run-gym.sh"
CONTEXT="agents/coder/context.md"
RESULTS="agents/shared/knowledge/experiments/EXP-266-runs.jsonl"
export GYM_AGENT_BIN=/usr/local/bin/may-agent

# Backup
cp "$CONTEXT" "${CONTEXT}.bak-exp266"

run_cell() {
  local arm="$1" scenario="$2"
  for trial in $(seq 1 "$N"); do
    echo "[$(date +%H:%M:%S)] $arm × $scenario trial $trial" >&2
    raw=$(timeout 300 bash "$GYM" "$scenario" --agent amy --timeout 4 2>/dev/null | jq -c '.' 2>/dev/null | tail -1) || true
    if [ -z "$raw" ] || ! echo "$raw" | jq . >/dev/null 2>&1; then
      raw='{"passed":false,"agent_status":"gym-error","checks":[],"summary":"gym runner failed","duration":"0s"}'
    fi
    echo "$raw" | jq -c \
      --arg arm "$arm" --arg scenario "$scenario" --argjson trial "$trial" \
      --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      '{arm:$arm, scenario:$scenario, trial:$trial, passed:.passed, summary:.summary, checks:.checks, timestamp:$ts}' \
      >> "$RESULTS"
    passed=$(echo "$raw" | jq -r '.passed // false')
    echo "  → passed=$passed" >&2
  done
}

echo "=== BASELINE ===" >&2
run_cell "baseline" "sycophants-dilemma"
run_cell "baseline" "verification-contradiction"

echo "=== TREATMENT A: Remove Rule 2 ===" >&2
# Remove Rule 2 (lines 46-52 approx — from "### Rule 2" to before "### Rule 3")
python3 -c "
import re
with open('$CONTEXT') as f: text = f.read()
# Remove Rule 2 section
text = re.sub(r'### Rule 2:.*?(?=### Rule 3:)', '', text, flags=re.DOTALL)
with open('$CONTEXT','w') as f: f.write(text)
"
run_cell "no-rule2" "sycophants-dilemma"

echo "=== TREATMENT B: Remove Rule 3 ===" >&2
# Restore and remove Rule 3
cp "${CONTEXT}.bak-exp266" "$CONTEXT"
python3 -c "
import re
with open('$CONTEXT') as f: text = f.read()
text = re.sub(r'### Rule 3:.*?(?=### Rule 4:)', '', text, flags=re.DOTALL)
with open('$CONTEXT','w') as f: f.write(text)
"
run_cell "no-rule3" "verification-contradiction"

# Restore
cp "${CONTEXT}.bak-exp266" "$CONTEXT"
rm "${CONTEXT}.bak-exp266"

echo "" >&2
echo "=== RESULTS SUMMARY ===" >&2
for arm in baseline no-rule2 no-rule3; do
  for sc in sycophants-dilemma verification-contradiction; do
    total=$(grep "$arm" "$RESULTS" | grep "$sc" | wc -l)
    if [ "$total" -gt 0 ]; then
      passed=$(grep "$arm" "$RESULTS" | grep "$sc" | jq -r '.passed' | grep -c true || true)
      echo "$arm × $sc: $passed/$total ($(( passed * 100 / total ))%)" >&2
    fi
  done
done
