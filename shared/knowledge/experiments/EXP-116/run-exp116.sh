#!/usr/bin/env bash
# EXP-116 Multi-Session Gym Runner
# Runs multi-session scenarios by handling S1→S2 handoff manually
# Each scenario has session-1/ and session-2/ subdirectories with task.md, context.md, environment/
#
# Usage: bash run-exp116.sh <scenario> [--agent <name>] [--timeout <min>]
# Example: bash run-exp116.sh multi-session/kb-integration-failure --agent bob --timeout 8

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
SCENARIOS_DIR="$PROJECT_ROOT/agents/gym/scenarios"

# Parse args
SCENARIO=""
AGENT="bob"
TIMEOUT_MIN=8

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent) AGENT="$2"; shift 2 ;;
    --timeout) TIMEOUT_MIN="$2"; shift 2 ;;
    *) SCENARIO="$1"; shift ;;
  esac
done

if [ -z "$SCENARIO" ]; then
  echo "Usage: $0 <scenario> [--agent <name>] [--timeout <min>]" >&2
  exit 1
fi

SCENARIO_DIR="$SCENARIOS_DIR/$SCENARIO"

if [ ! -d "$SCENARIO_DIR" ]; then
  echo "ERROR: Scenario directory not found: $SCENARIO_DIR" >&2
  exit 1
fi

# Verify multi-session structure
if [ ! -d "$SCENARIO_DIR/session-1" ] || [ ! -d "$SCENARIO_DIR/session-2" ]; then
  echo "ERROR: Not a multi-session scenario (no session-1/ or session-2/)" >&2
  exit 1
fi

# Auto-detect agent binary
AGENT_BIN="${GYM_AGENT_BIN:-}"
if [ -z "$AGENT_BIN" ]; then
  if [ -x "$PROJECT_ROOT/bundle/may-agent" ]; then
    AGENT_BIN="$PROJECT_ROOT/bundle/may-agent"
  elif [ -x "/app/may-agent-bin" ]; then
    AGENT_BIN="/app/may-agent-bin"
  fi
fi

if [ -z "$AGENT_BIN" ] || [ ! -x "$AGENT_BIN" ]; then
  echo "ERROR: No agent binary found. Set GYM_AGENT_BIN." >&2
  exit 1
fi

TIMEOUT_SEC=$((TIMEOUT_MIN * 60))
START_TIME=$(date +%s)

# Create work directories
WORK_BASE=$(mktemp -d /tmp/exp116-XXXXXX)
S1_WORK="$WORK_BASE/session-1"
S2_WORK="$WORK_BASE/session-2"
mkdir -p "$S1_WORK" "$S2_WORK"

cleanup() {
  rm -rf "$WORK_BASE"
}
trap cleanup EXIT

# ── SESSION 1 ─────────────────────────────────────────────────────────

echo "=== Session 1 ===" >&2

# Copy S1 environment
if [ -d "$SCENARIO_DIR/session-1/environment" ]; then
  cp -r "$SCENARIO_DIR/session-1/environment/." "$S1_WORK/"
fi

# Build S1 task (prepend context if exists)
S1_TASK=""
if [ -f "$SCENARIO_DIR/session-1/context.md" ]; then
  S1_TASK="$(cat "$SCENARIO_DIR/session-1/context.md")"$'\n\n---\n\n'
fi
S1_TASK="$S1_TASK$(cat "$SCENARIO_DIR/session-1/task.md")"

# Write task file
echo "$S1_TASK" > "$S1_WORK/_gym_task.md"

# Run agent for S1
S1_STATUS="completed"
S1_STDOUT=""
S1_START=$(date +%s)
if S1_STDOUT=$("$AGENT_BIN" --oneshot --agent "$AGENT" --task-file "$S1_WORK/_gym_task.md" --work-dir "$S1_WORK" 2>&1); then
  S1_STATUS="completed"
else
  S1_STATUS="error"
fi
S1_END=$(date +%s)
S1_DURATION=$((S1_END - S1_START))
echo "Session 1: $S1_STATUS (${S1_DURATION}s)" >&2

# Save S1 transcript
echo "$S1_STDOUT" > "$S1_WORK/_transcript.txt"

# ── HANDOFF: S1 → S2 ─────────────────────────────────────────────────

echo "=== Handoff ===" >&2

# Copy S2 environment first (this is the "ground truth" state)
if [ -d "$SCENARIO_DIR/session-2/environment" ]; then
  cp -r "$SCENARIO_DIR/session-2/environment/." "$S2_WORK/"
fi

# Check scenario.json for artifacts_out from S1
ARTIFACTS_OUT=$(python3 -c "
import json, sys
try:
    with open('$SCENARIO_DIR/scenario.json') as f:
        data = json.load(f)
    sessions = data.get('sessions', [])
    if sessions:
        arts = sessions[0].get('artifacts_out', [])
        print(' '.join(arts))
except:
    print('')
" 2>/dev/null || echo "")

if [ -n "$ARTIFACTS_OUT" ]; then
  for art in $ARTIFACTS_OUT; do
    # Copy S1 artifacts to S2 work dir
    if [ -e "$S1_WORK/$art" ]; then
      if [ -d "$S1_WORK/$art" ]; then
        mkdir -p "$S2_WORK/$art"
        cp -r "$S1_WORK/$art/." "$S2_WORK/$art/"
      else
        cp "$S1_WORK/$art" "$S2_WORK/$art"
      fi
      echo "  Copied artifact: $art" >&2
    fi
  done
fi

# ── SESSION 2 ─────────────────────────────────────────────────────────

echo "=== Session 2 ===" >&2

# Build S2 task (prepend context if exists)
S2_TASK=""
if [ -f "$SCENARIO_DIR/session-2/context.md" ]; then
  S2_TASK="$(cat "$SCENARIO_DIR/session-2/context.md")"$'\n\n---\n\n'
fi
S2_TASK="$S2_TASK$(cat "$SCENARIO_DIR/session-2/task.md")"

# Write task file
echo "$S2_TASK" > "$S2_WORK/_gym_task.md"

# Run agent for S2
S2_STATUS="completed"
S2_STDOUT=""
S2_START=$(date +%s)
if S2_STDOUT=$("$AGENT_BIN" --oneshot --agent "$AGENT" --task-file "$S2_WORK/_gym_task.md" --work-dir "$S2_WORK" 2>&1); then
  S2_STATUS="completed"
else
  S2_STATUS="error"
fi
S2_END=$(date +%s)
S2_DURATION=$((S2_END - S2_START))
echo "Session 2: $S2_STATUS (${S2_DURATION}s)" >&2

# Save S2 transcript
echo "$S2_STDOUT" > "$S2_WORK/_transcript.txt"

# ── SCORING ───────────────────────────────────────────────────────────

echo "=== Scoring ===" >&2

CRITERIA="$SCENARIO_DIR/success_criteria.js"
TOTAL_DURATION=$(( $(date +%s) - START_TIME ))

if [ ! -f "$CRITERIA" ]; then
  cat <<EOF
{
  "scenario": "$SCENARIO",
  "agent": "$AGENT",
  "passed": false,
  "checks": [],
  "summary": "No success_criteria.js found",
  "agent_status": "error",
  "duration": "${TOTAL_DURATION}s",
  "s1_duration": "${S1_DURATION}s",
  "s2_duration": "${S2_DURATION}s",
  "s1_status": "$S1_STATUS",
  "s2_status": "$S2_STATUS"
}
EOF
  exit 1
fi

# Run criteria against S2 work dir (which has the final state)
CRITERIA_OUTPUT=$(node "$CRITERIA" "$S2_WORK" "$S2_WORK/_transcript.txt" 2>/dev/null) || true

# Parse the JSON result and augment with metadata
python3 -c "
import json, sys

criteria_raw = '''$CRITERIA_OUTPUT'''
try:
    # Find last JSON object in output
    import re
    matches = list(re.finditer(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', criteria_raw, re.DOTALL))
    if matches:
        result = json.loads(matches[-1].group())
    else:
        result = {'passed': False, 'checks': [], 'summary': 'No JSON from criteria'}
except:
    result = {'passed': False, 'checks': [], 'summary': 'Failed to parse criteria output'}

result['scenario'] = '$SCENARIO'
result['agent'] = '$AGENT'
result['duration'] = '${TOTAL_DURATION}s'
result['s1_duration'] = '${S1_DURATION}s'
result['s2_duration'] = '${S2_DURATION}s'
result['s1_status'] = '$S1_STATUS'
result['s2_status'] = '$S2_STATUS'
result['agent_status'] = '$S2_STATUS'
print(json.dumps(result, indent=2))
"
