#!/usr/bin/env bash
#
# workflow-experiment-generic.sh — Run any gym scenario as a two-phase workflow
#
# Copies environment from ORIG_SCENARIO, runs phase1-task.md then phase2-task.md
# from WORKFLOW_SCENARIO, scores using ORIG_SCENARIO's success_criteria.js
#
# Usage: scripts/workflow-experiment-generic.sh \
#   --scenario <orig-scenario-name> \
#   --workflow <workflow-scenario-name> \
#   [--agent <name>] [--runs <n>] [--timeout <minutes>]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AGENTS_REPO="$PROJECT_ROOT/app/agents"

SCENARIO_NAME=""
WORKFLOW_NAME=""
AGENT_NAME="amy"
NUM_RUNS=1
TIMEOUT=3

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scenario)   SCENARIO_NAME="$2"; shift 2 ;;
    --workflow)   WORKFLOW_NAME="$2"; shift 2 ;;
    --agent)      AGENT_NAME="$2"; shift 2 ;;
    --runs)       NUM_RUNS="$2"; shift 2 ;;
    --timeout)    TIMEOUT="$2"; shift 2 ;;
    *)            echo "Unknown: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$SCENARIO_NAME" || -z "$WORKFLOW_NAME" ]]; then
  echo "Usage: $0 --scenario <name> --workflow <name> [--agent <name>] [--runs <n>]" >&2
  exit 1
fi

ORIG_SCENARIO_DIR="$PROJECT_ROOT/test/gym/scenarios/$SCENARIO_NAME"
WORKFLOW_DIR="$PROJECT_ROOT/test/gym/scenarios/$WORKFLOW_NAME"

if [[ ! -d "$ORIG_SCENARIO_DIR/environment" ]]; then
  echo "ERROR: $ORIG_SCENARIO_DIR/environment not found" >&2
  exit 1
fi

if [[ ! -f "$WORKFLOW_DIR/phase1-task.md" || ! -f "$WORKFLOW_DIR/phase2-task.md" ]]; then
  echo "ERROR: $WORKFLOW_DIR must contain phase1-task.md and phase2-task.md" >&2
  exit 1
fi

# Resolve binary
if [[ -n "${MAY_BIN:-}" ]]; then
  MAY_CMD=("$MAY_BIN")
elif [[ -x "$PROJECT_ROOT/bundle/may-agent" ]]; then
  MAY_CMD=("$PROJECT_ROOT/bundle/may-agent")
else
  MAY_CMD=(bun "$PROJECT_ROOT/src/app/may.ts")
fi

PASS=0
FAIL=0

for i in $(seq 1 "$NUM_RUNS"); do
  echo "=== Run $i/$NUM_RUNS ==="
  
  GYM_ROOT=$(mktemp -d "/tmp/gym-workflow-XXXXXX")
  GYM_STATE_P1="$GYM_ROOT/state-p1"
  GYM_STATE_P2="$GYM_ROOT/state-p2"
  GYM_WORK="$GYM_ROOT/work"
  mkdir -p "$GYM_STATE_P1" "$GYM_STATE_P2" "$GYM_WORK"
  
  # Copy environment
  cp -r "$ORIG_SCENARIO_DIR/environment/." "$GYM_WORK/"
  
  # Phase 1
  TASK_P1="$GYM_ROOT/task-p1.md"
  cat > "$TASK_P1" <<EOF
Work in this directory: $GYM_WORK

$(cat "$WORKFLOW_DIR/phase1-task.md")
EOF

  echo "  Phase 1: Analysis..."
  P1_OUT="$GYM_ROOT/p1-result.json"
  AGENTS_ROOT="$AGENTS_REPO" \
  STATE_DIR="$GYM_STATE_P1" \
    "${MAY_CMD[@]}" \
      --oneshot \
      --agent "$AGENT_NAME" \
      --task-file "$TASK_P1" \
      --timeout="$TIMEOUT" \
      > "$P1_OUT" 2>"$GYM_ROOT/p1-stderr.log" || true
  
  echo "  Phase 1 complete."
  
  # Phase 2
  TASK_P2="$GYM_ROOT/task-p2.md"
  cat > "$TASK_P2" <<EOF
Work in this directory: $GYM_WORK

$(cat "$WORKFLOW_DIR/phase2-task.md")
EOF

  echo "  Phase 2: Action..."
  P2_OUT="$GYM_ROOT/p2-result.json"
  AGENTS_ROOT="$AGENTS_REPO" \
  STATE_DIR="$GYM_STATE_P2" \
    "${MAY_CMD[@]}" \
      --oneshot \
      --agent "$AGENT_NAME" \
      --task-file "$TASK_P2" \
      --timeout="$TIMEOUT" \
      > "$P2_OUT" 2>"$GYM_ROOT/p2-stderr.log" || true
  
  echo "  Phase 2 complete."
  
  # Score
  SCORE_OUT="$GYM_ROOT/score.json"
  if [[ -f "$ORIG_SCENARIO_DIR/success_criteria.js" ]]; then
    bun "$ORIG_SCENARIO_DIR/success_criteria.js" "$GYM_WORK" > "$SCORE_OUT" 2>/dev/null || true
  elif [[ -f "$ORIG_SCENARIO_DIR/success_criteria.ts" ]]; then
    bun "$ORIG_SCENARIO_DIR/success_criteria.ts" "$GYM_WORK" > "$SCORE_OUT" 2>/dev/null || true
  else
    echo '{"passed": false, "error": "No success_criteria found"}' > "$SCORE_OUT"
  fi
  
  echo "  Score:"
  cat "$SCORE_OUT" 2>/dev/null || echo "  (scoring failed)"
  
  PASSED=$(python3 -c "import json; print(json.load(open('$SCORE_OUT')).get('passed', False))" 2>/dev/null || echo "False")
  
  if [[ "$PASSED" == "True" ]]; then
    echo "  ✅ PASS"
    ((PASS++)) || true
  else
    echo "  ❌ FAIL"
    ((FAIL++)) || true
  fi
  
  echo "  Work dir: $GYM_WORK"
  echo "  Gym root: $GYM_ROOT"
  echo ""
done

echo "=== SUMMARY ==="
echo "Scenario: $SCENARIO_NAME (workflow: $WORKFLOW_NAME)"
echo "Agent: $AGENT_NAME"
echo "Runs: $NUM_RUNS"
echo "Pass: $PASS / $NUM_RUNS"
echo "Fail: $FAIL / $NUM_RUNS"
echo "Pass rate: $(python3 -c "print(f'{$PASS/$NUM_RUNS*100:.0f}%')")"
