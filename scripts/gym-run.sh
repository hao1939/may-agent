#!/usr/bin/env bash
#
# gym-run.sh — Run an agent against a gym scenario and score the result.
#
# Decoupled runner: uses adapters to invoke different agent runtimes.
# The runner handles: scenario setup, task construction, scoring, result output.
# The adapter handles: invoking the specific agent binary.
#
# Usage:
#   scripts/gym-run.sh <scenario> [options]
#   scripts/gym-run.sh --list [--tier <tier>] [--category <cat>] [--tag <tag>]
#
# Options:
#   --adapter <name>      Adapter to use: may-agent (default), claude-code, generic
#   --agent <name>        Agent name, passed to adapter (default: coder)
#   --lab <fork>          Lab fork name, passed to may-agent adapter
#   --timeout <min>       Timeout in minutes (default: from scenario.json or 5)
#   --tier <tier>         Filter: smoke, standard, full
#   --category <cat>      Filter: bug-fixing, integrity, judgment, etc.
#   --tag <tag>           Filter: ability, behavior, workflow
#   --list                List scenarios matching filters (don't run)
#   --run-all             Run all scenarios matching filters
#
# Output: JSON to stdout with score, checks, session path, and cleanup info.
#
# Examples:
#   # Run with may-agent (default)
#   scripts/gym-run.sh phantom-fix --agent coder
#
#   # Run with Claude Code
#   scripts/gym-run.sh phantom-fix --adapter claude-code
#
#   # Run with generic command
#   GYM_AGENT_CMD="my-agent --task" scripts/gym-run.sh phantom-fix --adapter generic
#
#   # List smoke-tier scenarios
#   scripts/gym-run.sh --list --tier smoke
#
#   # Run all ability scenarios
#   scripts/gym-run.sh --run-all --tag ability --agent coder

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GYM_DIR="$PROJECT_ROOT/test/gym/scenarios"
ADAPTERS_DIR="$PROJECT_ROOT/test/gym/adapters"

# ── Parse args ──────────────────────────────────────────────────────

SCENARIO=""
ADAPTER="may-agent"
AGENT_NAME="coder"
LAB_FORK=""
TIMEOUT=""
FILTER_TIER=""
FILTER_CATEGORY=""
FILTER_TAG=""
LIST_MODE=false
RUN_ALL=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --adapter)   ADAPTER="$2"; shift 2 ;;
    --agent)     AGENT_NAME="$2"; shift 2 ;;
    --lab)       LAB_FORK="$2"; shift 2 ;;
    --timeout)   TIMEOUT="$2"; shift 2 ;;
    --tier)      FILTER_TIER="$2"; shift 2 ;;
    --category)  FILTER_CATEGORY="$2"; shift 2 ;;
    --tag)       FILTER_TAG="$2"; shift 2 ;;
    --list)      LIST_MODE=true; shift ;;
    --run-all)   RUN_ALL=true; shift ;;
    -*)          echo "Unknown flag: $1" >&2; exit 1 ;;
    *)           SCENARIO="$1"; shift ;;
  esac
done

# ── Scenario filtering ──────────────────────────────────────────────

scenario_matches_filters() {
  local scenario_dir="$1"
  local meta="$scenario_dir/scenario.json"

  # If no scenario.json, only match if no filters set
  if [[ ! -f "$meta" ]]; then
    [[ -z "$FILTER_TIER" && -z "$FILTER_CATEGORY" && -z "$FILTER_TAG" ]]
    return $?
  fi

  if [[ -n "$FILTER_TIER" ]]; then
    local tier
    tier=$(python3 -c "import json; print(json.load(open('$meta')).get('tier',''))" 2>/dev/null)
    # smoke includes smoke; standard includes smoke+standard; full includes all
    case "$FILTER_TIER" in
      smoke)    [[ "$tier" == "smoke" ]] || return 1 ;;
      standard) [[ "$tier" == "smoke" || "$tier" == "standard" ]] || return 1 ;;
      full)     ;; # everything matches
      *)        [[ "$tier" == "$FILTER_TIER" ]] || return 1 ;;
    esac
  fi

  if [[ -n "$FILTER_CATEGORY" ]]; then
    local cats
    cats=$(python3 -c "import json; print(' '.join(json.load(open('$meta')).get('categories',[])))" 2>/dev/null)
    [[ " $cats " == *" $FILTER_CATEGORY "* ]] || return 1
  fi

  if [[ -n "$FILTER_TAG" ]]; then
    local tags
    tags=$(python3 -c "import json; print(' '.join(json.load(open('$meta')).get('tags',[])))" 2>/dev/null)
    [[ " $tags " == *" $FILTER_TAG "* ]] || return 1
  fi

  return 0
}

# ── List mode ───────────────────────────────────────────────────────

if $LIST_MODE; then
  for scenario_dir in "$GYM_DIR"/*/; do
    [[ -d "$scenario_dir" ]] || continue
    name=$(basename "$scenario_dir")
    if scenario_matches_filters "$scenario_dir"; then
      local_meta="$scenario_dir/scenario.json"
      if [[ -f "$local_meta" ]]; then
        tier=$(python3 -c "import json; print(json.load(open('$local_meta')).get('tier','?'))" 2>/dev/null)
        cats=$(python3 -c "import json; print(','.join(json.load(open('$local_meta')).get('categories',[])))" 2>/dev/null)
        printf "%-40s tier=%-10s categories=%s\n" "$name" "$tier" "$cats"
      else
        printf "%-40s (no metadata)\n" "$name"
      fi
    fi
  done
  exit 0
fi

# ── Run-all mode ────────────────────────────────────────────────────

if $RUN_ALL; then
  scenarios=()
  for scenario_dir in "$GYM_DIR"/*/; do
    [[ -d "$scenario_dir" ]] || continue
    name=$(basename "$scenario_dir")
    if scenario_matches_filters "$scenario_dir"; then
      scenarios+=("$name")
    fi
  done

  if [[ ${#scenarios[@]} -eq 0 ]]; then
    echo "No scenarios match filters." >&2
    exit 1
  fi

  echo "Running ${#scenarios[@]} scenarios..." >&2
  results=()
  pass_count=0
  fail_count=0

  for name in "${scenarios[@]}"; do
    echo "── $name ──" >&2
    result=$("$0" "$name" --adapter "$ADAPTER" --agent "$AGENT_NAME" \
      ${LAB_FORK:+--lab "$LAB_FORK"} \
      ${TIMEOUT:+--timeout "$TIMEOUT"} 2>/dev/null) || true
    passed=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('passed',False))" 2>/dev/null || echo "False")
    if [[ "$passed" == "True" ]]; then
      echo "  PASS" >&2
      ((pass_count++))
    else
      echo "  FAIL" >&2
      ((fail_count++))
    fi
    results+=("$result")
  done

  # Summary
  total=$((pass_count + fail_count))
  echo "" >&2
  echo "Results: $pass_count/$total passed ($((pass_count * 100 / total))%)" >&2

  # Output all results as JSON array
  printf '[\n'
  for i in "${!results[@]}"; do
    echo "${results[$i]}"
    [[ $i -lt $((${#results[@]} - 1)) ]] && echo ","
  done
  printf ']\n'
  exit 0
fi

# ── Single scenario mode ────────────────────────────────────────────

if [[ -z "$SCENARIO" ]]; then
  echo "Usage: gym-run.sh <scenario> [options]" >&2
  echo "       gym-run.sh --list [--tier <t>] [--category <c>] [--tag <t>]" >&2
  echo "       gym-run.sh --run-all [--tier <t>] [--category <c>] [--tag <t>]" >&2
  echo "" >&2
  echo "Available scenarios:" >&2
  ls "$GYM_DIR" 2>/dev/null | sed 's/^/  /' >&2
  exit 1
fi

SCENARIO_DIR="$GYM_DIR/$SCENARIO"
for required in "$SCENARIO_DIR" "$SCENARIO_DIR/task.md" "$SCENARIO_DIR/success_criteria.js" "$SCENARIO_DIR/environment"; do
  if [[ ! -e "$required" ]]; then
    echo "Missing: $required" >&2
    exit 1
  fi
done

# Read scenario metadata
SCENARIO_META="$SCENARIO_DIR/scenario.json"
IS_WORKFLOW=false
if [[ -f "$SCENARIO_META" ]]; then
  IS_WORKFLOW=$(python3 -c "import json; print(str(json.load(open('$SCENARIO_META')).get('workflow',False)).lower())" 2>/dev/null || echo "false")
  if [[ -z "$TIMEOUT" ]]; then
    TIMEOUT=$(python3 -c "import json; print(json.load(open('$SCENARIO_META')).get('timeout',5))" 2>/dev/null || echo "5")
  fi
fi
TIMEOUT="${TIMEOUT:-5}"

# ── Set up isolated environment ────────────────────────────────────

GYM_ROOT=$(mktemp -d "/tmp/gym-run-XXXXXX")
export GYM_ROOT
GYM_WORK="$GYM_ROOT/work"
mkdir -p "$GYM_ROOT/state" "$GYM_WORK"

# Copy scenario environment to work dir
cp -r "$SCENARIO_DIR/environment/." "$GYM_WORK/"

# ── Load adapter ───────────────────────────────────────────────────

ADAPTER_FILE="$ADAPTERS_DIR/$ADAPTER.sh"
if [[ ! -f "$ADAPTER_FILE" ]]; then
  echo "Adapter not found: $ADAPTER_FILE" >&2
  echo "Available adapters:" >&2
  ls "$ADAPTERS_DIR"/*.sh 2>/dev/null | xargs -n1 basename | sed 's/\.sh$//' | sed 's/^/  /' >&2
  exit 1
fi

# Export variables the adapter needs
export AGENT_NAME LAB_FORK TIMEOUT

# Source adapter (defines adapter_setup and adapter_run_agent)
# shellcheck source=/dev/null
source "$ADAPTER_FILE"

# Initialize adapter
adapter_setup "$PROJECT_ROOT" || exit 1

# ── Initialize result variables ────────────────────────────────────

SESSION_ID=""
AGENT_STATUS="unknown"
AGENT_DURATION=""
SESSION_PATH=""

# ── Run agent ──────────────────────────────────────────────────────

if [[ "$IS_WORKFLOW" == "true" ]]; then
  # Multi-phase: split task.md on "---" separator
  FULL_TASK=$(cat "$SCENARIO_DIR/task.md")
  PHASE1_TASK=$(echo "$FULL_TASK" | awk '/^---$/{exit} {print}')
  PHASE2_TASK=$(echo "$FULL_TASK" | awk 'found{print} /^---$/{found=1}')

  # Phase 1
  PHASE1_FILE="$GYM_ROOT/phase1-task.md"
  cat > "$PHASE1_FILE" <<EOF
Work in this directory: $GYM_WORK

$PHASE1_TASK
EOF
  echo "Phase 1..." >&2
  adapter_run_agent "$PHASE1_FILE" "$GYM_WORK" "$TIMEOUT" || true
  PHASE1_SESSION="${SESSION_ID:-}"
  echo "Phase 1 complete (session: $PHASE1_SESSION)" >&2

  # Phase 2
  PHASE2_FILE="$GYM_ROOT/phase2-task.md"
  cat > "$PHASE2_FILE" <<EOF
Work in this directory: $GYM_WORK

$PHASE2_TASK
EOF
  echo "Phase 2..." >&2
  adapter_run_agent "$PHASE2_FILE" "$GYM_WORK" "$TIMEOUT" || true
  PHASE2_SESSION="${SESSION_ID:-}"
  echo "Phase 2 complete (session: $PHASE2_SESSION)" >&2

else
  # Single-phase
  TASK_FILE="$GYM_ROOT/task.md"
  cat > "$TASK_FILE" <<EOF
Work in this directory: $GYM_WORK

$(cat "$SCENARIO_DIR/task.md")
EOF
  adapter_run_agent "$TASK_FILE" "$GYM_WORK" "$TIMEOUT" || true
fi

# ── Score ───────────────────────────────────────────────────────────

SCORE_OUT="$GYM_ROOT/score-result.json"
SCORE_EXIT=0
node "$SCENARIO_DIR/success_criteria.js" "$GYM_WORK" > "$SCORE_OUT" 2>/dev/null || SCORE_EXIT=$?

# ── Build combined result ──────────────────────────────────────────

python3 << PYEOF
import json

try:
    with open("$SCORE_OUT") as f:
        score = json.load(f)
except:
    score = {"passed": False, "checks": [], "summary": "scoring failed"}

result = {
    "scenario": "$SCENARIO",
    "adapter": "$ADAPTER",
    "agent": "$AGENT_NAME",
    "lab_fork": "$LAB_FORK" or None,
    "workflow": $( [[ "$IS_WORKFLOW" == "true" ]] && echo "True" || echo "False" ),
    "passed": score.get("passed", False),
    "checks": score.get("checks", []),
    "summary": score.get("summary", ""),
    "agent_status": "${AGENT_STATUS:-unknown}",
    "duration": "${AGENT_DURATION:-}",
    "session_id": "${SESSION_ID:-}",
    "session_path": "${SESSION_PATH:-}",
    "work_dir": "$GYM_WORK",
    "gym_root": "$GYM_ROOT",
}

print(json.dumps(result, indent=2))
PYEOF

exit $SCORE_EXIT
