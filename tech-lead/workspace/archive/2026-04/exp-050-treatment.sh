#!/usr/bin/env bash
#
# EXP-050 Treatment Runner — Run gym scenarios through implement-and-verify workflow
#
# Usage: bash agents/tech-lead/workspace/exp-050-treatment.sh <scenario>
#
# This script:
# 1. Sets up the gym environment (copies files)
# 2. Creates a task that tells tech-lead to use implement-and-verify workflow
# 3. Runs may-agent --oneshot --agent tech-lead
# 4. Scores the result with success_criteria.js

set -euo pipefail
export PATH=".state/.bun/bin:$PATH"

SCENARIO="${1:?Usage: $0 <scenario-name>}"
GYM_DIR="agents/gym/scenarios/$SCENARIO"
RESULTS_DIR="/tmp/exp050-treatment"
mkdir -p "$RESULTS_DIR"

# Validate scenario exists
if [ ! -d "$GYM_DIR" ]; then
  echo "ERROR: Scenario not found: $GYM_DIR" >&2
  exit 1
fi

# Create isolated working directory
WORK_DIR=$(mktemp -d /tmp/exp050-work-XXXXXX)
GYM_ROOT=$(mktemp -d /tmp/exp050-gym-XXXXXX)

# Copy environment
cp -r "$GYM_DIR/environment/"* "$WORK_DIR/"

# Create state dir for may-agent
STATE_DIR="$GYM_ROOT/state"
mkdir -p "$STATE_DIR/sessions"

# Get the original task
ORIG_TASK=$(cat "$GYM_DIR/task.md" | sed "s|{{env_dir}}|$WORK_DIR|g")

# Determine verify command based on scenario
VERIFY_CMD=""
if [ -f "$WORK_DIR/package.json" ]; then
  HAS_TEST=$(python3 -c "
import json
with open('$WORK_DIR/package.json') as f:
    d = json.load(f)
scripts = d.get('scripts', {})
if 'test' in scripts:
    print(scripts['test'])
" 2>/dev/null)
  if [ -n "$HAS_TEST" ]; then
    VERIFY_CMD="cd $WORK_DIR && npm install --silent 2>/dev/null; npm test"
  fi
fi

# For scenarios without a test command, use a simple file-existence check
if [ -z "$VERIFY_CMD" ]; then
  VERIFY_CMD="echo 'No executable verification available — shell check skipped'"
fi

# Create the task for tech-lead: use implement-and-verify workflow
TASK_FILE="$GYM_ROOT/task.md"
cat > "$TASK_FILE" << TASK_EOF
Use the implement-and-verify workflow to complete this coding task.

Run this command:
workflow.run("implement-and-verify", task)

Where the task is:

---
Work in this directory: $WORK_DIR

$ORIG_TASK

verifyCommand: $VERIFY_CMD
---

IMPORTANT: Use the workflow tool with action "run", name "implement-and-verify", and the task text above (everything between the --- markers). Do NOT do the work yourself — delegate via the workflow.
TASK_EOF

echo "Scenario: $SCENARIO"
echo "Work dir: $WORK_DIR"
echo "Verify cmd: $VERIFY_CMD"
echo "Task file: $TASK_FILE"
echo ""

# Set up agents sandbox so may-agent can find agent configs
AGENTS_SANDBOX="$GYM_ROOT/agents-sandbox"
mkdir -p "$AGENTS_SANDBOX"
# Symlink agent dirs
for agent_dir in agents/*/; do
  agent_name=$(basename "$agent_dir")
  if [ "$agent_name" != "gym" ] && [ "$agent_name" != "_archetypes" ]; then
    ln -sf "$(pwd)/$agent_dir" "$AGENTS_SANDBOX/$agent_name"
  fi
done
# Also link archetypes and shared
ln -sf "$(pwd)/agents/_archetypes" "$AGENTS_SANDBOX/_archetypes"
ln -sf "$(pwd)/agents/shared" "$AGENTS_SANDBOX/shared"

# Run may-agent as tech-lead
START_MS=$(date +%s%3N 2>/dev/null || python3 -c "import time; print(int(time.time()*1000))")

echo "Running may-agent --oneshot --agent tech-lead..."
RESULT=$(bundle/may-agent --oneshot \
  --agent "tech-lead" \
  --task-file "$TASK_FILE" \
  --timeout=5 \
  2>/dev/null) || true

END_MS=$(date +%s%3N 2>/dev/null || python3 -c "import time; print(int(time.time()*1000))")
DURATION_MS=$((END_MS - START_MS))

echo "Duration: ${DURATION_MS}ms"
echo "Result: $RESULT"

# Score the result
echo ""
echo "Scoring..."
SCORE_RESULT=$(cd "$WORK_DIR" && node -e "
const criteria = require('$(pwd)/$GYM_DIR/success_criteria.js');
const path = require('path');
const result = criteria.evaluate('$WORK_DIR', '$GYM_ROOT');
console.log(JSON.stringify(result, null, 2));
" 2>&1) || true

echo "$SCORE_RESULT"

# Save results
cat > "$RESULTS_DIR/$SCENARIO.json" << EOF
{
  "scenario": "$SCENARIO",
  "condition": "implement-and-verify",
  "duration_ms": $DURATION_MS,
  "work_dir": "$WORK_DIR",
  "gym_root": "$GYM_ROOT",
  "verify_command": "$(echo "$VERIFY_CMD" | sed 's/"/\\"/g')",
  "score": $SCORE_RESULT
}
EOF

echo ""
echo "Results saved to: $RESULTS_DIR/$SCENARIO.json"
