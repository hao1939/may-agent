#!/usr/bin/env bash
#
# gym-run.sh — Run an agent against a gym scenario and score the result.
#
# Tests an agent (optionally with experimental changes from a .lab/ fork)
# against a scenario with automated scoring.
#
# Usage:
#   scripts/gym-run.sh <scenario> [options]
#
# Options:
#   --agent <name>        Agent to run (default: coder)
#   --lab <fork>          Test a .lab/ fork instead of production agent.
#                         Copies production agents/ and overlays the fork.
#                         If omitted, runs baseline (production agent).
#   --timeout <min>       Timeout in minutes (default: 5)
#
# Examples:
#   # Baseline: run production coder against phantom-fix
#   scripts/gym-run.sh phantom-fix --agent coder
#
#   # Test a fork: Coach forked coder to .lab/coder-fm33-fix with changes
#   scripts/gym-run.sh phantom-fix --agent coder --lab coder-fm33-fix
#
# Output: JSON to stdout with score, checks, session path, and cleanup info.
#
# Temp dirs are preserved for transcript analysis. Caller cleans up via:
#   rm -rf <gym_root>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GYM_DIR="$PROJECT_ROOT/test/gym/scenarios"
AGENTS_REPO="$PROJECT_ROOT/agents"

# ── Parse args ──────────────────────────────────────────────────────

SCENARIO=""
AGENT_NAME="coder"
LAB_FORK=""
TIMEOUT=5

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent)    AGENT_NAME="$2"; shift 2 ;;
    --lab)      LAB_FORK="$2"; shift 2 ;;
    --timeout)  TIMEOUT="$2"; shift 2 ;;
    -*)         echo "Unknown flag: $1" >&2; exit 1 ;;
    *)          SCENARIO="$1"; shift ;;
  esac
done

if [[ -z "$SCENARIO" ]]; then
  echo "Usage: gym-run.sh <scenario> [--agent <name>] [--lab <fork>] [--timeout <min>]" >&2
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

# ── Set up isolated environment ────────────────────────────────────

GYM_ROOT=$(mktemp -d "/tmp/gym-run-XXXXXX")
GYM_STATE="$GYM_ROOT/state"
GYM_WORK="$GYM_ROOT/work"
mkdir -p "$GYM_STATE" "$GYM_WORK"

# Determine agents root:
#   --lab <fork>: copy production agents, overlay .lab/<fork> files
#   (no --lab):   baseline run using production agents/ directly
if [[ -n "$LAB_FORK" ]]; then
  LAB_DIR="$AGENTS_REPO/.lab/$LAB_FORK"
  if [[ ! -d "$LAB_DIR" ]]; then
    echo "Lab fork not found: $LAB_DIR" >&2
    exit 1
  fi
  GYM_AGENTS="$GYM_ROOT/agents-lab"
  cp -r "$AGENTS_REPO" "$GYM_AGENTS"
  rm -rf "$GYM_AGENTS/.lab" "$GYM_AGENTS/.git"
  # Overlay fork files onto the target agent
  cp -r "$LAB_DIR/." "$GYM_AGENTS/$AGENT_NAME/"
else
  # Baseline: use production agents/ directly (read-only — isolated via STATE_DIR)
  GYM_AGENTS="$AGENTS_REPO"
fi

# Verify agent exists
if [[ ! -f "$GYM_AGENTS/$AGENT_NAME/agent.json" ]]; then
  echo "Agent '$AGENT_NAME' not found in: $GYM_AGENTS" >&2
  exit 1
fi

# Copy scenario environment to work dir
cp -r "$SCENARIO_DIR/environment/." "$GYM_WORK/"

# ── Build task ─────────────────────────────────────────────────────

TASK_FILE="$GYM_ROOT/task.md"
cat > "$TASK_FILE" <<EOF
Work in this directory: $GYM_WORK

$(cat "$SCENARIO_DIR/task.md")
EOF

# ── Resolve binary ─────────────────────────────────────────────────

# Use the compiled binary if available, fall back to source.
# MAY_BIN env var overrides both.
if [[ -n "${MAY_BIN:-}" ]]; then
  MAY_CMD=("$MAY_BIN")
elif [[ -x "$PROJECT_ROOT/bundle/may-agent" ]]; then
  MAY_CMD=("$PROJECT_ROOT/bundle/may-agent")
else
  MAY_CMD=(bun "$PROJECT_ROOT/src/app/may.ts")
fi

# ── Run agent ──────────────────────────────────────────────────────

ONESHOT_OUT="$GYM_ROOT/oneshot-result.json"

ONESHOT_EXIT=0
AGENTS_ROOT="$GYM_AGENTS" \
STATE_DIR="$GYM_STATE" \
  "${MAY_CMD[@]}" \
    --oneshot \
    --agent "$AGENT_NAME" \
    --task-file "$TASK_FILE" \
    --timeout="$TIMEOUT" \
    > "$ONESHOT_OUT" 2>"$GYM_ROOT/agent-stderr.log" || ONESHOT_EXIT=$?

# Parse oneshot result
SESSION_ID=""
ONESHOT_STATUS="unknown"
ONESHOT_DURATION=""
if [[ -f "$ONESHOT_OUT" ]]; then
  SESSION_ID=$(python3 -c "import json; print(json.load(open('$ONESHOT_OUT')).get('sessionId',''))" 2>/dev/null || true)
  ONESHOT_STATUS=$(python3 -c "import json; print(json.load(open('$ONESHOT_OUT')).get('status','unknown'))" 2>/dev/null || true)
  ONESHOT_DURATION=$(python3 -c "import json; print(json.load(open('$ONESHOT_OUT')).get('duration',''))" 2>/dev/null || true)
fi

# ── Score ───────────────────────────────────────────────────────────

SCORE_OUT="$GYM_ROOT/score-result.json"
SCORE_EXIT=0
bun "$SCENARIO_DIR/success_criteria.js" "$GYM_WORK" > "$SCORE_OUT" 2>/dev/null || SCORE_EXIT=$?

# ── Build combined result ──────────────────────────────────────────

SESSION_PATH=""
if [[ -n "$SESSION_ID" ]]; then
  for candidate in "$GYM_STATE/sessions/$SESSION_ID" "$GYM_STATE/sessions/history/$SESSION_ID"; do
    if [[ -d "$candidate" ]]; then
      SESSION_PATH="$candidate"
      break
    fi
  done
fi

python3 << PYEOF
import json

try:
    with open("$SCORE_OUT") as f:
        score = json.load(f)
except:
    score = {"passed": False, "checks": [], "summary": "scoring failed"}

result = {
    "scenario": "$SCENARIO",
    "agent": "$AGENT_NAME",
    "lab_fork": "$LAB_FORK" or None,
    "passed": score.get("passed", False),
    "checks": score.get("checks", []),
    "summary": score.get("summary", ""),
    "agent_status": "$ONESHOT_STATUS",
    "duration": "$ONESHOT_DURATION",
    "session_id": "$SESSION_ID",
    "session_path": "$SESSION_PATH",
    "work_dir": "$GYM_WORK",
    "gym_root": "$GYM_ROOT",
}

print(json.dumps(result, indent=2))
PYEOF

exit $SCORE_EXIT
