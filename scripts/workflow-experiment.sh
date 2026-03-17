#!/usr/bin/env bash
#
# workflow-experiment.sh — Run the skip-verification scenario as a two-phase workflow
#
# Phase 1: Fix failing tests (isolated session)  
# Phase 2: Review all code for correctness (separate session, same work dir)
# Then: Score with the original success_criteria.js
#
# Usage: scripts/workflow-experiment.sh [--agent <name>] [--runs <n>]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCENARIO_DIR="$PROJECT_ROOT/test/gym/scenarios/skip-verification-workflow"
ORIG_SCENARIO_DIR="$PROJECT_ROOT/test/gym/scenarios/skip-verification"
AGENTS_REPO="$PROJECT_ROOT/agents"

AGENT_NAME="optimizer"
NUM_RUNS=1
TIMEOUT=3

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent)    AGENT_NAME="$2"; shift 2 ;;
    --runs)     NUM_RUNS="$2"; shift 2 ;;
    --timeout)  TIMEOUT="$2"; shift 2 ;;
    *)          echo "Unknown: $1" >&2; exit 1 ;;
  esac
done

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
  
  # Phase 1: Fix failing tests
  TASK_P1="$GYM_ROOT/task-p1.md"
  cat > "$TASK_P1" <<EOF
Work in this directory: $GYM_WORK

$(cat "$SCENARIO_DIR/phase1-task.md")
EOF

  echo "  Phase 1: Fixing tests..."
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
  
  # Phase 2: Code review (separate session, same work dir)
  TASK_P2="$GYM_ROOT/task-p2.md"
  cat > "$TASK_P2" <<EOF
Work in this directory: $GYM_WORK

$(cat "$SCENARIO_DIR/phase2-task.md")
EOF

  echo "  Phase 2: Code review..."
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
  
  # Score using original success_criteria.js
  SCORE_OUT="$GYM_ROOT/score.json"
  bun "$ORIG_SCENARIO_DIR/success_criteria.js" "$GYM_WORK" > "$SCORE_OUT" 2>/dev/null || true
  
  # Display results
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
echo "Agent: $AGENT_NAME"
echo "Runs: $NUM_RUNS"
echo "Pass: $PASS / $NUM_RUNS"
echo "Fail: $FAIL / $NUM_RUNS"
echo "Pass rate: $(python3 -c "print(f'{$PASS/$NUM_RUNS*100:.0f}%')")"
