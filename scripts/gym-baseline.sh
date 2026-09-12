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
  scenario_list=$("$PROJECT_ROOT/scripts/gym-run.sh" --list "${LIST_ARGS[@]}") || {
    echo "Could not list Gym scenarios." >&2; exit 1;
  }
  while IFS= read -r line; do
    name=$(echo "$line" | awk '{print $1}')
    [ -n "$name" ] && SCENARIOS+=("$name")
  done <<< "$scenario_list"
fi
if [ ${#SCENARIOS[@]} -eq 0 ]; then echo "No Gym scenarios selected." >&2; exit 1; fi

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
  runner_rc=0
  GYM_NO_RECORD=1 timeout 360 "$PROJECT_ROOT/scripts/gym-run.sh" "$scenario" --agent "$AGENT" > "$tmpfile" 2>&1 || runner_rc=$?
  
  # The CLI prints one result object after diagnostics. Parse JSON, not brace
  # counts (braces inside a summary are ordinary text). Never infer a verdict
  # from empty checks or override an explicit failure with passing subchecks.
  result_json=$(python3 -c '
import json, sys
text = open(sys.argv[1]).read()
for offset in [0] + [i + 1 for i, c in enumerate(text) if c == "\n"]:
    if not text[offset:].startswith("{"): continue
    try: d = json.loads(text[offset:])
    except ValueError: continue
    if not isinstance(d, dict) or type(d.get("passed")) is not bool: continue
    if not all(isinstance(d.get(k), str) and d[k].strip() for k in ("scenario", "agent")): continue
    checks = d.get("checks", [])
    if not isinstance(checks, list) or not all(isinstance(c, dict) and type(c.get("passed")) is bool for c in checks): continue
    print(json.dumps(d)); break
' "$tmpfile")
  
  if [ -n "$result_json" ]; then
    # Record to may.db with batch/tag
    echo "$result_json" > "$tmpfile.json"
    record_args=(--result "$tmpfile.json" --batch "$BATCH_ID")
    [ -n "$RUN_TAG" ] && record_args+=(--tag "$RUN_TAG")
    record_rc=0
    record_out=$(bun "$PROJECT_ROOT/scripts/gym-record.ts" "${record_args[@]}" 2>&1) || record_rc=$?
    
    # Check pass/fail
    passed=$(echo "$result_json" | python3 -c "import json,sys; print('true' if json.load(sys.stdin)['passed'] else 'false')")
    checks=$(echo "$result_json" | python3 -c "import json,sys; d=json.load(sys.stdin); cs=d.get('checks',[]); p=sum(1 for c in cs if c.get('passed')); print(f'{p}/{len(cs)}')" 2>/dev/null)
    
    if [ "$record_rc" -ne 0 ] || { [ "$runner_rc" -ne 0 ] && [ "$passed" = "true" ]; }; then
      echo "ERROR (runner exit $runner_rc, recorder exit $record_rc)"
      ERROR=$((ERROR + 1))
    elif [ "$passed" = "true" ]; then
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
[ "$FAIL" -eq 0 ] && [ "$ERROR" -eq 0 ]
