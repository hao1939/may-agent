#!/usr/bin/env bash
#
# EXP-050 Runner — Compare baseline vs implement-and-verify
#
# This script runs a gym scenario under two conditions:
#   1. baseline: direct coder call (via gym-run.sh)
#   2. implement-and-verify: coder + shell verification + optional retry
#
# Usage:
#   bash agents/tech-lead/workspace/exp-050-runner.sh <scenario> [verify-command]
#
# Example:
#   bash agents/tech-lead/workspace/exp-050-runner.sh convention-verify-edit \
#     "node -e \"JSON.parse(require('fs').readFileSync('config.json','utf8')); console.log('OK')\""

set -euo pipefail

SCENARIO="${1:?Usage: $0 <scenario> [verify-command]}"
VERIFY_CMD="${2:-}"
TIMEOUT="${3:-3}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
GYM_DIR="$PROJECT_ROOT/test/gym/scenarios/$SCENARIO"
RESULTS_DIR="$SCRIPT_DIR/exp-050-results"
mkdir -p "$RESULTS_DIR"

# Verify scenario exists
if [[ ! -d "$GYM_DIR" ]]; then
  echo "ERROR: Scenario not found: $GYM_DIR" >&2
  exit 1
fi

echo "=== EXP-050: $SCENARIO ==="
echo "Verify command: ${VERIFY_CMD:-<none>}"
echo ""

# ── Run Baseline ─────────────────────────────────────────────────────
echo "--- BASELINE (direct coder) ---"
export PATH="$PROJECT_ROOT/.state/.bun/bin:$PATH"
BASELINE_RESULT=$(scripts/gym-run.sh "$SCENARIO" --agent coder --timeout "$TIMEOUT" 2>/dev/null)
echo "$BASELINE_RESULT" > "$RESULTS_DIR/${SCENARIO}-baseline.json"
BASELINE_PASSED=$(echo "$BASELINE_RESULT" | grep -o '"passed": [a-z]*' | head -1 | awk '{print $2}')
BASELINE_DURATION=$(echo "$BASELINE_RESULT" | grep -o '"duration_ms": [0-9]*' | head -1 | awk '{print $2}')
echo "  Passed: $BASELINE_PASSED, Duration: ${BASELINE_DURATION}ms"

# ── Run implement-and-verify (simulated) ─────────────────────────────
# We can't easily invoke workflow.run() from outside, so we simulate:
# 1. Run coder with enhanced task (includes verify command)
# 2. After coder finishes, run verify command manually
# 3. If verify fails, run coder again with error output (retry phase)
#
# This matches the workflow's behavior faithfully.

if [[ -n "$VERIFY_CMD" ]]; then
  echo ""
  echo "--- TREATMENT (implement-and-verify) ---"
  
  # Create temp environment
  TMPDIR=$(mktemp -d)
  WORKDIR="$TMPDIR/work"
  mkdir -p "$WORKDIR"
  cp -r "$GYM_DIR/environment/"* "$WORKDIR/"
  
  # Read original task
  TASK=$(cat "$GYM_DIR/task.md")
  
  # Create enhanced task (matching workflow's first-attempt format)
  ENHANCED_TASK="$TASK

## Verification
Your code will be verified with:
\`\`\`
$VERIFY_CMD
\`\`\`
Make sure your changes pass this check."

  # Write task file
  TASK_FILE="$TMPDIR/task.md"
  echo "Work in this directory: $WORKDIR" > "$TASK_FILE"
  echo "" >> "$TASK_FILE"
  echo "$ENHANCED_TASK" >> "$TASK_FILE"
  
  # Setup agent sandbox (same as gym runner)
  AGENTS_ROOT="$PROJECT_ROOT/agents"
  STATE_DIR="$TMPDIR/state"
  mkdir -p "$STATE_DIR"
  
  # Copy agent identity to workdir
  AGENT_DEST="$WORKDIR/agents/coder"
  mkdir -p "$WORKDIR/agents"
  cp -r "$AGENTS_ROOT/coder" "$AGENT_DEST"
  
  BINARY="$PROJECT_ROOT/bundle/may-agent"
  START_MS=$(($(date +%s%N) / 1000000))
  
  # Phase 1: Run coder with enhanced task
  echo "  Phase 1: Coder implementing..."
  CODER_RESULT=$("$BINARY" --oneshot --agent coder --task-file "$TASK_FILE" --timeout="$TIMEOUT" 2>/dev/null || true)
  
  # Phase 2: Run verification
  echo "  Phase 2: Verification..."
  cd "$WORKDIR"
  VERIFY_PASSED=false
  VERIFY_OUTPUT=""
  if VERIFY_OUTPUT=$(eval "$VERIFY_CMD" 2>&1); then
    VERIFY_PASSED=true
    echo "  Verification: PASSED"
  else
    echo "  Verification: FAILED"
    echo "  Output: $VERIFY_OUTPUT"
    
    # Phase 3: Retry with error output
    echo "  Phase 3: Retry with error context..."
    
    RETRY_TASK="## Fix Required (attempt 2/2)

The verification command failed after your previous changes. Fix the code so it passes.

### Original Task
$TASK

### Verification Command
\`\`\`
$VERIFY_CMD
\`\`\`

### Verification Output (FAILED)
\`\`\`
$VERIFY_OUTPUT
\`\`\`

Read the error output carefully. Fix the root cause."
    
    RETRY_FILE="$TMPDIR/retry-task.md"
    echo "Work in this directory: $WORKDIR" > "$RETRY_FILE"
    echo "" >> "$RETRY_FILE"
    echo "$RETRY_TASK" >> "$RETRY_FILE"
    
    cd "$WORKDIR"
    "$BINARY" --oneshot --agent coder --task-file "$RETRY_FILE" --timeout="$TIMEOUT" 2>/dev/null || true
    
    # Re-verify
    cd "$WORKDIR"
    if VERIFY_OUTPUT=$(eval "$VERIFY_CMD" 2>&1); then
      VERIFY_PASSED=true
      echo "  Retry verification: PASSED"
    else
      echo "  Retry verification: FAILED"
    fi
  fi
  
  END_MS=$(($(date +%s%N) / 1000000))
  DURATION=$((END_MS - START_MS))
  
  # Score using success_criteria.js
  cd "$PROJECT_ROOT"
  SCORE_RESULT=$(node "$GYM_DIR/success_criteria.js" "$WORKDIR" 2>/dev/null || echo '{"passed": false}')
  
  # Combine results
  TREATMENT_RESULT=$(cat <<EOF
{
  "scenario": "$SCENARIO",
  "condition": "implement-and-verify",
  "verify_command": "$VERIFY_CMD",
  "verify_passed": $VERIFY_PASSED,
  "duration_ms": $DURATION,
  "score": $SCORE_RESULT,
  "work_dir": "$WORKDIR"
}
EOF
)
  echo "$TREATMENT_RESULT" > "$RESULTS_DIR/${SCENARIO}-treatment.json"
  
  TREATMENT_PASSED=$(echo "$SCORE_RESULT" | grep -o '"passed": [a-z]*' | head -1 | awk '{print $2}')
  echo "  Score passed: $TREATMENT_PASSED, Duration: ${DURATION}ms"
  
  # Cleanup (keep for debugging)
  echo "  Work dir preserved: $WORKDIR"
fi

echo ""
echo "Results saved to: $RESULTS_DIR/"
