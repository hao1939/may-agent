#!/usr/bin/env bash
# EXP-277 Phase 3: Run V-targeted scenarios (Arm A)
# Goal: Measure weakness exposure rate on 5 verification-axis scenarios
set -euo pipefail

N=${1:-5}  # trials per scenario
GYM="agents/test/gym/run-gym.sh"
RESULTS=".state/experiments/exp277-results.jsonl"
export GYM_AGENT_BIN=/usr/local/bin/may-agent

SCENARIOS=(
  "silent-regression-verify"
  "fabricated-path-claim"
  "stale-snapshot-override"
  "partial-success-mirage"
  "unverifiable-claim-honesty"
)

echo "=== EXP-277 Phase 3: Arm A (V-targeted) ===" >&2
echo "Trials per scenario: $N" >&2
echo "Results: $RESULTS" >&2

for scenario in "${SCENARIOS[@]}"; do
  echo "" >&2
  echo "--- $scenario ---" >&2
  for trial in $(seq 1 "$N"); do
    echo "[$(date +%H:%M:%S)] $scenario trial $trial/$N" >&2
    raw=$(timeout 600 bash "$GYM" "$scenario" --timeout 4 2>/dev/null | jq -c '.' 2>/dev/null | tail -1) || true
    if [ -z "$raw" ] || ! echo "$raw" | jq . >/dev/null 2>&1; then
      raw='{"passed":false,"agent_status":"gym-error","checks":[],"summary":"gym runner failed","duration":"0s"}'
    fi
    echo "$raw" | jq -c \
      --arg arm "V-targeted" --arg scenario "$scenario" --argjson trial "$trial" \
      --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      '{arm:$arm, scenario:$scenario, trial:$trial, passed:.passed, summary:.summary, checks:.checks, timestamp:$ts}' \
      >> "$RESULTS"
    passed=$(echo "$raw" | jq -r '.passed // false')
    echo "  → passed=$passed" >&2
  done
done

echo "" >&2
echo "=== Summary ===" >&2
total=$(wc -l < "$RESULTS")
passed=$(jq -r 'select(.passed==true)' "$RESULTS" | wc -l)
echo "Total trials: $total" >&2
echo "Passed: $passed" >&2
echo "Failure rate (weakness exposure): $(echo "scale=0; ($total - $passed) * 100 / $total" | bc)%" >&2

echo "" >&2
echo "Per-scenario:" >&2
for scenario in "${SCENARIOS[@]}"; do
  sc_total=$(jq -r "select(.scenario==\"$scenario\")" "$RESULTS" | wc -l)
  sc_passed=$(jq -r "select(.scenario==\"$scenario\" and .passed==true)" "$RESULTS" | wc -l)
  echo "  $scenario: $sc_passed/$sc_total passed ($(echo "scale=0; ($sc_total - $sc_passed) * 100 / $sc_total" | bc)% failure)" >&2
done
