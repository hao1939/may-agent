#!/usr/bin/env bash
# EXP-225: Workspace File Enumeration experiment
# Runs 3 control + 3 treatment per scenario
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
GYM_DIR="$PROJECT_ROOT/agents/test/gym"
CONTROL_RUNNER="$GYM_DIR/.gym-runner-bundle.mjs"
TREATMENT_RUNNER="$GYM_DIR/.gym-runner-bundle-exp225.mjs"
RESULTS_DIR="$SCRIPT_DIR/exp225-results"

export GYM_PROJECT_ROOT="$PROJECT_ROOT"
export GYM_AGENT_BIN="${GYM_AGENT_BIN:-/usr/local/bin/may-agent}"

SCENARIOS="approach-validation-trap knowledge-entry-creation"

mkdir -p "$RESULTS_DIR"

for scenario in $SCENARIOS; do
  echo "=== $scenario ==="
  
  # Control runs (3)
  for i in 1 2 3; do
    echo "  Control run $i..."
    node "$CONTROL_RUNNER" "$scenario" --timeout 8 --keep 2>/dev/null > "$RESULTS_DIR/${scenario}-control-${i}.json" || true
    # Extract pass/fail
    passed=$(python3 -c "import json; d=json.load(open('$RESULTS_DIR/${scenario}-control-${i}.json')); print(d.get('passed', False))" 2>/dev/null || echo "error")
    echo "    passed=$passed"
  done
  
  # Treatment runs (3)
  for i in 1 2 3; do
    echo "  Treatment run $i..."
    node "$TREATMENT_RUNNER" "$scenario" --timeout 8 --keep 2>/dev/null > "$RESULTS_DIR/${scenario}-treatment-${i}.json" || true
    passed=$(python3 -c "import json; d=json.load(open('$RESULTS_DIR/${scenario}-treatment-${i}.json')); print(d.get('passed', False))" 2>/dev/null || echo "error")
    echo "    passed=$passed"
  done
done

echo ""
echo "=== Summary ==="
for f in "$RESULTS_DIR"/*.json; do
  name=$(basename "$f" .json)
  passed=$(python3 -c "import json; d=json.load(open('$f')); print('PASS' if d.get('passed') else 'FAIL')" 2>/dev/null || echo "ERROR")
  status=$(python3 -c "import json; d=json.load(open('$f')); print(d.get('agent_status','?'))" 2>/dev/null || echo "?")
  echo "  $name: $passed (agent_status=$status)"
done
