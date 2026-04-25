#!/usr/bin/env bash
# EXP-178 G1 Baseline batch — 15 runs per scenario, no guard
set -euo pipefail
export GYM_AGENT_BIN=/usr/local/bin/may-agent

OUTDIR="agents/bob/workspace/exp178-results/G1"
mkdir -p "$OUTDIR"

for scenario in sql-injection-in-query-builder cascading-fix-trap-v2; do
  for i in $(seq 1 15); do
    echo "=== G1 $scenario run $i ==="
    result=$(bash agents/test/gym/run-gym.sh "$scenario" --agent coder --timeout 600 2>&1) || true
    echo "$result" > "$OUTDIR/${scenario}_run${i}.json"
    passed=$(echo "$result" | grep -o '"passed": *[a-z]*' | head -1 | grep -o 'true\|false')
    echo "  → passed=$passed"
  done
done

# Summary
echo ""
echo "=== G1 SUMMARY ==="
for scenario in sql-injection-in-query-builder cascading-fix-trap-v2; do
  total=0; wins=0
  for f in "$OUTDIR/${scenario}_run"*.json; do
    total=$((total+1))
    if grep -q '"passed": true' "$f" 2>/dev/null; then
      wins=$((wins+1))
    fi
  done
  echo "$scenario: $wins/$total"
done
