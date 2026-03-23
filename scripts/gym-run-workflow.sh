#!/usr/bin/env bash
#
# gym-run-workflow.sh — Run workflow enforcement (two-phase) against a gym scenario
#
# Usage:
#   scripts/gym-run-workflow.sh <scenario> --agent <name> \
#     --phase1 "task for phase 1" --phase2 "task for phase 2"
#
# This runs TWO oneshot sessions against the same work directory:
#   Phase 1: analysis/planning
#   Phase 2: execution
# Then scores the result with success_criteria.js

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure bun is discoverable even when not in system PATH (e.g., container deploys)
for _bun_dir in "$PROJECT_ROOT/.state/.bun/bin" "$HOME/.bun/bin"; do
  [ -x "$_bun_dir/bun" ] && { export PATH="$_bun_dir:$PATH"; break; }
done

GYM_DIR="$PROJECT_ROOT/test/gym/scenarios"
AGENTS_REPO="$PROJECT_ROOT/agents"

SCENARIO=""
AGENT_NAME="coder"
LAB_FORK=""
TIMEOUT=5
PHASE1_TASK=""
PHASE2_TASK=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent)    AGENT_NAME="$2"; shift 2 ;;
    --lab)      LAB_FORK="$2"; shift 2 ;;
    --timeout)  TIMEOUT="$2"; shift 2 ;;
    --phase1)   PHASE1_TASK="$2"; shift 2 ;;
    --phase2)   PHASE2_TASK="$2"; shift 2 ;;
    -*)         echo "Unknown flag: $1" >&2; exit 1 ;;
    *)          SCENARIO="$1"; shift ;;
  esac
done

if [[ -z "$SCENARIO" || -z "$PHASE1_TASK" || -z "$PHASE2_TASK" ]]; then
  echo "Usage: gym-run-workflow.sh <scenario> --agent <name> --phase1 '...' --phase2 '...'" >&2
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

GYM_ROOT=$(mktemp -d "/tmp/gym-wf-XXXXXX")
GYM_STATE="$GYM_ROOT/state"
GYM_WORK="$GYM_ROOT/work"
mkdir -p "$GYM_STATE" "$GYM_WORK"

# Agent resolution
if [[ -n "$LAB_FORK" ]]; then
  LAB_DIR="$AGENTS_REPO/.lab/$LAB_FORK"
  if [[ ! -d "$LAB_DIR" ]]; then
    echo "Lab fork not found: $LAB_DIR" >&2
    exit 1
  fi
  GYM_AGENTS="$GYM_ROOT/agents-lab"
  cp -r "$AGENTS_REPO" "$GYM_AGENTS"
  rm -rf "$GYM_AGENTS/.lab" "$GYM_AGENTS/.git"
  cp -r "$LAB_DIR/." "$GYM_AGENTS/$AGENT_NAME/"
else
  GYM_AGENTS="$AGENTS_REPO"
fi

if [[ ! -f "$GYM_AGENTS/$AGENT_NAME/agent.json" ]]; then
  echo "Agent '$AGENT_NAME' not found in: $GYM_AGENTS" >&2
  exit 1
fi

# Copy scenario environment to work dir
cp -r "$SCENARIO_DIR/environment/." "$GYM_WORK/"

# Resolve binary (with staleness check)
if [[ -n "${MAY_BIN:-}" ]]; then
  MAY_CMD=("$MAY_BIN")
elif [[ -x "$PROJECT_ROOT/bundle/may-agent" ]]; then
  BINARY="$PROJECT_ROOT/bundle/may-agent"
  STALE=false
  if [[ -n "$(find "$PROJECT_ROOT/src" -name '*.ts' -newer "$BINARY" -print -quit 2>/dev/null)" ]]; then
    STALE=true
  fi
  if $STALE; then
    echo "⚠️  Compiled binary is stale (source is newer). Using bun instead." >&2
    MAY_CMD=(bun "$PROJECT_ROOT/src/app/may.ts")
  else
    MAY_CMD=("$BINARY")
  fi
else
  MAY_CMD=(bun "$PROJECT_ROOT/src/app/may.ts")
fi

# ── Phase 1: Analysis ──────────────────────────────────────────────

PHASE1_FILE="$GYM_ROOT/phase1-task.md"
cat > "$PHASE1_FILE" <<EOF
Work in this directory: $GYM_WORK

$PHASE1_TASK
EOF

PHASE1_OUT="$GYM_ROOT/phase1-result.json"
PHASE1_EXIT=0
AGENTS_ROOT="$GYM_AGENTS" \
STATE_DIR="$GYM_STATE" \
  "${MAY_CMD[@]}" \
    --oneshot \
    --agent "$AGENT_NAME" \
    --task-file "$PHASE1_FILE" \
    --timeout="$TIMEOUT" \
    > "$PHASE1_OUT" 2>"$GYM_ROOT/phase1-stderr.log" || PHASE1_EXIT=$?

PHASE1_SESSION=$(python3 -c "import json; print(json.load(open('$PHASE1_OUT')).get('sessionId',''))" 2>/dev/null || true)
echo "Phase 1 complete (session: $PHASE1_SESSION, exit: $PHASE1_EXIT)" >&2

# ── Phase 2: Execution ─────────────────────────────────────────────

PHASE2_FILE="$GYM_ROOT/phase2-task.md"
cat > "$PHASE2_FILE" <<EOF
Work in this directory: $GYM_WORK

$PHASE2_TASK
EOF

PHASE2_OUT="$GYM_ROOT/phase2-result.json"
PHASE2_EXIT=0
AGENTS_ROOT="$GYM_AGENTS" \
STATE_DIR="$GYM_STATE" \
  "${MAY_CMD[@]}" \
    --oneshot \
    --agent "$AGENT_NAME" \
    --task-file "$PHASE2_FILE" \
    --timeout="$TIMEOUT" \
    > "$PHASE2_OUT" 2>"$GYM_ROOT/phase2-stderr.log" || PHASE2_EXIT=$?

PHASE2_SESSION=$(python3 -c "import json; print(json.load(open('$PHASE2_OUT')).get('sessionId',''))" 2>/dev/null || true)
PHASE2_DURATION=$(python3 -c "import json; print(json.load(open('$PHASE2_OUT')).get('duration',''))" 2>/dev/null || true)
echo "Phase 2 complete (session: $PHASE2_SESSION, exit: $PHASE2_EXIT)" >&2

# ── Locate transcripts ─────────────────────────────────────────────

# Combine both phase transcripts into a single file for scorers
COMBINED_TRANSCRIPT="$GYM_ROOT/combined-transcript.jsonl"
for SESS_ID in "$PHASE1_SESSION" "$PHASE2_SESSION"; do
  if [[ -n "$SESS_ID" ]]; then
    for candidate in "$GYM_STATE/sessions/$SESS_ID" "$GYM_STATE/sessions/history/$SESS_ID"; do
      if [[ -d "$candidate" && -f "$candidate/session.jsonl" ]]; then
        cat "$candidate/session.jsonl" >> "$COMBINED_TRANSCRIPT"
        break
      fi
    done
  fi
done
TRANSCRIPT_PATH=""
if [[ -f "$COMBINED_TRANSCRIPT" ]]; then
  TRANSCRIPT_PATH="$COMBINED_TRANSCRIPT"
fi

# ── Score ───────────────────────────────────────────────────────────
# Pass transcript path as second argument (backward compatible).

SCORE_OUT="$GYM_ROOT/score-result.json"
SCORE_EXIT=0
node "$SCENARIO_DIR/success_criteria.js" "$GYM_WORK" "$TRANSCRIPT_PATH" > "$SCORE_OUT" 2>/dev/null || SCORE_EXIT=$?

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
    "agent": "$AGENT_NAME",
    "lab_fork": "$LAB_FORK" or None,
    "method": "workflow-enforcement",
    "passed": score.get("passed", False),
    "checks": score.get("checks", []),
    "summary": score.get("summary", ""),
    "duration": "$PHASE2_DURATION",
    "session_id": "$PHASE2_SESSION",
    "phase1_session": "$PHASE1_SESSION",
    "phase2_session": "$PHASE2_SESSION",
    "transcript_path": "$TRANSCRIPT_PATH",
    "work_dir": "$GYM_WORK",
    "gym_root": "$GYM_ROOT",
}

print(json.dumps(result, indent=2))
PYEOF

# ── Record to SQLite ──────────────────────────────────────────────

GYM_RECORD="$SCRIPT_DIR/gym-record.ts"
if [[ -f "$GYM_RECORD" ]] && command -v bun &>/dev/null && [[ -f "$SCORE_OUT" ]]; then
  python3 -c "
import json
try:
    with open('$SCORE_OUT') as f:
        score = json.load(f)
except:
    score = {'passed': False, 'checks': [], 'summary': 'scoring failed'}
result = {
    'scenario': '$SCENARIO',
    'agent': '$AGENT_NAME',
    'lab_fork': '$LAB_FORK' or None,
    'passed': score.get('passed', False),
    'checks': score.get('checks', []),
    'summary': score.get('summary', ''),
    'duration': '$PHASE2_DURATION',
    'session_id': '$PHASE2_SESSION',
    'method': 'workflow-enforcement',
}
print(json.dumps(result))
" | bun "$GYM_RECORD" 2>/dev/null || echo "⚠️  Failed to record gym result to SQLite" >&2
fi

exit $SCORE_EXIT
