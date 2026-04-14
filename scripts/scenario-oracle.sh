#!/usr/bin/env bash
#
# scenario-oracle.sh — Auto-generate expected outputs for gym scenarios.
#
# Problem: Coach spends ~32 tool calls per scenario manually computing expected
# outputs (checksums, pipeline results, test counts, file content patterns).
# This script automates that by running an agent against the scenario and
# capturing the "gold" state of the solved environment.
#
# Usage:
#   scripts/scenario-oracle.sh <scenario-name> [options]
#   scripts/scenario-oracle.sh hidden-dependency
#   scripts/scenario-oracle.sh cascading-fix-trap --agent coder --timeout 5
#   scripts/scenario-oracle.sh hidden-dependency --skip-agent  # use pre-solved env
#
# Options:
#   --agent <name>       Agent to run (default: coder)
#   --timeout <min>      Timeout in minutes (default: from scenario.json or 5)
#   --skip-agent         Don't run agent — assume environment is already solved
#                        (useful when you've manually fixed the code)
#   --work-dir <path>    Use this directory as the solved environment
#                        (implies --skip-agent)
#   --output <path>      Write oracle report to this file (default: stdout)
#   --verbose            Show agent run output
#
# Output:
#   JSON report with:
#     - file_snapshots: key files and their content/hashes after fix
#     - test_results: stdout/stderr/exit code from running tests
#     - command_outputs: results of running scenario commands
#     - computed_values: extracted values (checksums, numeric results, etc.)
#     - criteria_skeleton: a starter success_criteria.js template
#
# The report gives coach all the "expected values" needed to write
# success_criteria.js without manual computation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure bun is discoverable
for _bun_dir in "$PROJECT_ROOT/.state/.bun/bin" "$HOME/.bun/bin"; do
  [ -x "$_bun_dir/bun" ] && { export PATH="$_bun_dir:$PATH"; break; }
done

# ── Argument parsing ────────────────────────────────────────────────────

SCENARIO=""
AGENT="coder"
TIMEOUT=""
SKIP_AGENT=0
WORK_DIR=""
OUTPUT=""
VERBOSE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent)    AGENT="$2"; shift 2 ;;
    --timeout)  TIMEOUT="$2"; shift 2 ;;
    --skip-agent) SKIP_AGENT=1; shift ;;
    --work-dir) WORK_DIR="$2"; SKIP_AGENT=1; shift 2 ;;
    --output)   OUTPUT="$2"; shift 2 ;;
    --verbose)  VERBOSE=1; shift ;;
    --help|-h)
      head -36 "$0" | tail -33
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
    *)
      SCENARIO="$1"; shift ;;
  esac
done

if [ -z "$SCENARIO" ]; then
  echo "Usage: scripts/scenario-oracle.sh <scenario-name> [options]" >&2
  echo "Run with --help for details." >&2
  exit 1
fi

SCENARIOS_DIR="$PROJECT_ROOT/agents/gym/scenarios"
SCENARIO_DIR="$SCENARIOS_DIR/$SCENARIO"

if [ ! -d "$SCENARIO_DIR" ]; then
  echo "Error: scenario directory not found: $SCENARIO_DIR" >&2
  exit 1
fi

if [ ! -d "$SCENARIO_DIR/environment" ]; then
  echo "Error: no environment/ directory in scenario: $SCENARIO" >&2
  exit 1
fi

# ── Step 1: Get a solved environment ────────────────────────────────────

if [ -n "$WORK_DIR" ]; then
  SOLVED_DIR="$WORK_DIR"
  echo "Using provided work directory: $SOLVED_DIR" >&2
elif [ "$SKIP_AGENT" -eq 1 ]; then
  SOLVED_DIR=$(mktemp -d "${TMPDIR:-/tmp}/oracle-XXXXXX")
  cp -r "$SCENARIO_DIR/environment/." "$SOLVED_DIR/"
  echo "Copied environment to: $SOLVED_DIR" >&2
  echo "Note: --skip-agent used. Environment is in its original (buggy) state." >&2
else
  echo "Running agent '$AGENT' against scenario '$SCENARIO'..." >&2

  TIMEOUT_ARGS=""
  if [ -n "$TIMEOUT" ]; then
    TIMEOUT_ARGS="--timeout $TIMEOUT"
  fi

  _tmpout=$(mktemp)
  _exit=0

  if [ "$VERBOSE" -eq 1 ]; then
    GYM_NO_RECORD=1 bun "$PROJECT_ROOT/test/gym/gym-runner.ts" "$SCENARIO" \
      --agent "$AGENT" $TIMEOUT_ARGS 2>&1 | tee "$_tmpout" || _exit=$?
  else
    GYM_NO_RECORD=1 bun "$PROJECT_ROOT/test/gym/gym-runner.ts" "$SCENARIO" \
      --agent "$AGENT" $TIMEOUT_ARGS > "$_tmpout" 2>&1 || _exit=$?
  fi

  # Extract work_dir from gym runner JSON output
  SOLVED_DIR=$(grep -oP '"work_dir"\s*:\s*"\K[^"]+' "$_tmpout" | head -1 || true)

  if [ -z "$SOLVED_DIR" ] || [ ! -d "$SOLVED_DIR" ]; then
    echo "Error: could not extract work_dir from gym run output." >&2
    echo "Gym runner output:" >&2
    cat "$_tmpout" >&2
    rm -f "$_tmpout"
    exit 1
  fi

  rm -f "$_tmpout"
  echo "Agent run complete. Solved environment: $SOLVED_DIR" >&2
fi

# ── Step 2: Analyze the solved environment ──────────────────────────────

_oracle_output=$(node "$SCRIPT_DIR/scenario-oracle-analyze.mjs" "$SOLVED_DIR" "$SCENARIO_DIR" "$SCENARIO")

# ── Step 3: Output ──────────────────────────────────────────────────────

if [ -n "$OUTPUT" ]; then
  echo "$_oracle_output" > "$OUTPUT"
  echo "Oracle report written to: $OUTPUT" >&2
  
  # Also extract and save the skeleton separately
  _skeleton_path="${OUTPUT%.json}-criteria-skeleton.js"
  echo "$_oracle_output" | node -e "
    const chunks = [];
    process.stdin.on('data', d => chunks.push(d));
    process.stdin.on('end', () => {
      try {
        const data = JSON.parse(chunks.join(''));
        process.stdout.write(data.criteria_skeleton || '// No skeleton generated');
      } catch(e) { process.stdout.write('// Parse error: ' + e.message); }
    });
  " > "$_skeleton_path" 2>/dev/null
  echo "Criteria skeleton written to: $_skeleton_path" >&2
else
  echo "$_oracle_output"
fi
