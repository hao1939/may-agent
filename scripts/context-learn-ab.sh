#!/usr/bin/env bash
#
# context-learn-ab.sh — A/B comparison for context learning scenarios.
#
# Runs each scenario TWICE:
#   A) with learn_between_phases: true (context.md populated between phases)
#   B) with learn_between_phases: false (no context learning)
#
# Compares: pass/fail, ops count, error count.
#
# Usage: scripts/context-learn-ab.sh [scenario-name]
#   If no scenario given, runs all context-proof-* scenarios.

set -euo pipefail
cd "$(dirname "$0")/.."

SCENARIOS_DIR="agents/gym/scenarios"
RESULTS_DIR="/tmp/context-learn-ab-$(date +%s)"
mkdir -p "$RESULTS_DIR"

# Collect scenarios
if [ $# -gt 0 ]; then
  SCENARIOS=("$@")
else
  SCENARIOS=()
  for d in "$SCENARIOS_DIR"/context-proof-*; do
    [ -d "$d" ] && SCENARIOS+=("$(basename "$d")")
  done
fi

echo "=== Context Learning A/B Comparison ==="
echo "Results: $RESULTS_DIR"
echo "Scenarios: ${SCENARIOS[*]}"
echo ""

for sc in "${SCENARIOS[@]}"; do
  echo "━━━ $sc ━━━"
  
  # Run A: WITH context learning
  echo -n "  [A] WITH context:    "
  timeout 420 scripts/gym-run.sh "$sc" --agent coder > "$RESULTS_DIR/${sc}-A.log" 2>&1 || true
  A_RESULT=$(python3 -c "
import json
with open('$RESULTS_DIR/${sc}-A.log') as f:
    text = f.read()
d = json.loads(text[text.index('{'):])
passed = sum(1 for c in d['checks'] if c['passed'])
total = len(d['checks'])
ops = d.get('checks', [{}])[-1].get('detail', '')
print(f'{\"PASS\" if d[\"passed\"] else \"FAIL\"} ({passed}/{total}) {d[\"duration_ms\"]//1000}s')
" 2>/dev/null || echo "ERROR")
  echo "$A_RESULT"
  
  # Temporarily disable learn_between_phases for run B
  SCENARIO_JSON="$SCENARIOS_DIR/$sc/scenario.json"
  cp "$SCENARIO_JSON" "$RESULTS_DIR/${sc}-scenario-backup.json"
  python3 -c "
import json
with open('$SCENARIO_JSON') as f: d = json.load(f)
d['learn_between_phases'] = False
with open('$SCENARIO_JSON', 'w') as f: json.dump(d, f, indent=2)
"
  
  # Run B: WITHOUT context learning
  echo -n "  [B] WITHOUT context: "
  timeout 420 scripts/gym-run.sh "$sc" --agent coder > "$RESULTS_DIR/${sc}-B.log" 2>&1 || true
  B_RESULT=$(python3 -c "
import json
with open('$RESULTS_DIR/${sc}-B.log') as f:
    text = f.read()
d = json.loads(text[text.index('{'):])
passed = sum(1 for c in d['checks'] if c['passed'])
total = len(d['checks'])
print(f'{\"PASS\" if d[\"passed\"] else \"FAIL\"} ({passed}/{total}) {d[\"duration_ms\"]//1000}s')
" 2>/dev/null || echo "ERROR")
  echo "$B_RESULT"
  
  # Restore scenario.json
  cp "$RESULTS_DIR/${sc}-scenario-backup.json" "$SCENARIO_JSON"
  
  # Compare details
  echo "  ── Detail comparison ──"
  python3 -c "
import json

def load(path):
    with open(path) as f:
        text = f.read()
    return json.loads(text[text.index('{'):])

a = load('$RESULTS_DIR/${sc}-A.log')
b = load('$RESULTS_DIR/${sc}-B.log')

a_checks = {c['name']: c for c in a.get('checks', [])}
b_checks = {c['name']: c for c in b.get('checks', [])}

all_names = list(dict.fromkeys(list(a_checks.keys()) + list(b_checks.keys())))
for name in all_names:
    ac = a_checks.get(name, {})
    bc = b_checks.get(name, {})
    a_pass = '✅' if ac.get('passed') else '❌'
    b_pass = '✅' if bc.get('passed') else '❌'
    delta = ''
    if ac.get('passed') != bc.get('passed'):
        if ac.get('passed') and not bc.get('passed'):
            delta = ' ← CONTEXT HELPED'
        else:
            delta = ' ← CONTEXT HURT'
    print(f'    {a_pass}/{b_pass} {name}{delta}')

a_dur = a.get('duration_ms', 0) // 1000
b_dur = b.get('duration_ms', 0) // 1000
print(f'    Duration: {a_dur}s (with) vs {b_dur}s (without)')
" 2>/dev/null || echo "    (comparison failed)"
  echo ""
done

echo "=== Summary ==="
echo "Results saved to: $RESULTS_DIR"
