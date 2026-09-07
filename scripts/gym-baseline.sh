#!/usr/bin/env bash
# gym-baseline.sh — Run gym scenarios and record results to may.db
#
# Usage:
#   scripts/gym-baseline.sh --tier smoke --agent coder
#   scripts/gym-baseline.sh --tier standard --agent coder --tag "baseline"
#   scripts/gym-baseline.sh --scenario hasty-fix --agent coder
#   scripts/gym-baseline.sh --run-all --agent coder

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure bun on PATH (host dev runs only; in the container image bun is
# already at /usr/local/bin/bun and on PATH for free).
if [ -x "$HOME/.bun/bin/bun" ]; then
  export PATH="$HOME/.bun/bin:$PATH"
fi

AGENT="coder"
SCENARIOS=()
LIST_ARGS=()
RUN_TAG=""

# Generate unique batch ID for this run
BATCH_ID="$(date +%s)_$(openssl rand -hex 4)"

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent) AGENT="$2"; shift 2 ;;
    --scenario) SCENARIOS+=("$2"); shift 2 ;;
    --tag) RUN_TAG="$2"; shift 2 ;;
    --tier|--category) LIST_ARGS+=("$1" "$2"); shift 2 ;;
    --run-all) LIST_ARGS+=("--run-all"); shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# If no specific scenario, get list from gym runner
if [ ${#SCENARIOS[@]} -eq 0 ]; then
  if [ ${#LIST_ARGS[@]} -eq 0 ]; then
    echo "Usage: gym-baseline.sh --tier smoke --agent coder"
    exit 1
  fi
  while IFS= read -r line; do
    name=$(echo "$line" | awk '{print $1}')
    [ -n "$name" ] && SCENARIOS+=("$name")
  done < <("$PROJECT_ROOT/scripts/gym-run.sh" --list "${LIST_ARGS[@]}" 2>&1)
fi

echo "=== Gym Baseline: ${#SCENARIOS[@]} scenarios, agent=$AGENT, batch=$BATCH_ID ==="
echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
[ -n "$RUN_TAG" ] && echo "Tag: $RUN_TAG"
echo ""

PASS=0
FAIL=0
ERROR=0

for scenario in "${SCENARIOS[@]}"; do
  printf "%-45s " "$scenario"
  
  # Run scenario, capture all output
  tmpfile=$(mktemp /tmp/gym-XXXXXX.txt)
  GYM_NO_RECORD=1 timeout 360 "$PROJECT_ROOT/scripts/gym-run.sh" "$scenario" --agent "$AGENT" > "$tmpfile" 2>&1 || true
  
  # Extract JSON result (last valid JSON object in output)
  result_json=$(python3 -c "
import json
text = open('$tmpfile').read()
depth = 0; start = -1; end = -1
for i in range(len(text)-1, -1, -1):
    if text[i] == '}':
        if depth == 0: end = i
        depth += 1
    elif text[i] == '{':
        depth -= 1
        if depth == 0:
            start = i
            break
if start >= 0:
    try:
        d = json.loads(text[start:end+1])
        print(json.dumps(d))
    except: pass
" 2>/dev/null)
  
  if [ -n "$result_json" ]; then
    # Record to may.db with batch/tag
    echo "$result_json" > "$tmpfile.json"
    record_args=(--result "$tmpfile.json" --batch "$BATCH_ID")
    [ -n "$RUN_TAG" ] && record_args+=(--tag "$RUN_TAG")
    record_out=$(bun "$PROJECT_ROOT/scripts/gym-record.ts" "${record_args[@]}" 2>&1)
    
    # Check pass/fail
    passed=$(echo "$result_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print('true' if d.get('passed') or all(c.get('passed') for c in d.get('checks',[])) else 'false')" 2>/dev/null)
    checks=$(echo "$result_json" | python3 -c "import json,sys; d=json.load(sys.stdin); cs=d.get('checks',[]); p=sum(1 for c in cs if c.get('passed')); print(f'{p}/{len(cs)}')" 2>/dev/null)
    
    if [ "$passed" = "true" ]; then
      echo "✅ PASS ($checks)"
      PASS=$((PASS + 1))
    else
      echo "❌ FAIL ($checks)"
      FAIL=$((FAIL + 1))
    fi
    rm -f "$tmpfile.json"
  else
    echo "⚠️  ERROR (no result)"
    ERROR=$((ERROR + 1))
  fi
  rm -f "$tmpfile"
done

echo ""
echo "=== Results: $PASS pass, $FAIL fail, $ERROR error (${#SCENARIOS[@]} total) ==="
echo "Finished: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Results saved to .state/may.db (batch: $BATCH_ID)"
