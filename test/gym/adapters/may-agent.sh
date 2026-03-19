#!/usr/bin/env bash
#
# may-agent adapter for gym runner
#
# Interface contract:
#   TASK_FILE=<path>  — file containing the task prompt
#   WORK_DIR=<path>   — working directory (already populated with environment files)
#   TIMEOUT=<minutes> — timeout in minutes
#   AGENT_NAME=<name> — agent name (default: coder)
#   LAB_FORK=<name>   — optional .lab/ fork name
#
# These are set by the runner before sourcing this adapter.
# The adapter must define: adapter_run_agent()
#   Returns: exit code (0=success, non-zero=error)
#   Side effects: writes $GYM_ROOT/agent-result.json with { sessionId, status, duration }

ADAPTER_NAME="may-agent"

adapter_setup() {
  local project_root="$1"

  # Resolve agents root
  if [[ -n "${LAB_FORK:-}" ]]; then
    local lab_dir="$project_root/agents/.lab/$LAB_FORK"
    if [[ ! -d "$lab_dir" ]]; then
      echo "Lab fork not found: $lab_dir" >&2
      return 1
    fi
    GYM_AGENTS="$GYM_ROOT/agents-lab"
    cp -r "$project_root/agents" "$GYM_AGENTS"
    rm -rf "$GYM_AGENTS/.lab" "$GYM_AGENTS/.git"
    cp -r "$lab_dir/." "$GYM_AGENTS/$AGENT_NAME/"
  else
    GYM_AGENTS="$project_root/agents"
  fi

  # Verify agent exists
  if [[ ! -f "$GYM_AGENTS/$AGENT_NAME/agent.json" ]]; then
    echo "Agent '$AGENT_NAME' not found in: $GYM_AGENTS" >&2
    return 1
  fi

  # Resolve binary (with staleness check)
  if [[ -n "${MAY_BIN:-}" ]]; then
    MAY_CMD=("$MAY_BIN")
  elif [[ -x "$project_root/bundle/may-agent" ]]; then
    local binary="$project_root/bundle/may-agent"
    local stale=false
    if [[ -n "$(find "$project_root/src" -name '*.ts' -newer "$binary" -print -quit 2>/dev/null)" ]]; then
      stale=true
    fi
    if $stale; then
      if command -v bun &>/dev/null; then
        echo "Warning: compiled binary is stale. Using bun." >&2
        MAY_CMD=(bun "$project_root/src/app/may.ts")
      else
        MAY_CMD=("$binary")
      fi
    else
      MAY_CMD=("$binary")
    fi
  elif command -v bun &>/dev/null; then
    MAY_CMD=(bun "$project_root/src/app/may.ts")
  else
    echo "No may-agent binary and no bun available." >&2
    return 1
  fi
}

adapter_run_agent() {
  local task_file="$1"
  local work_dir="$2"
  local timeout="$3"
  local result_file="$GYM_ROOT/agent-result.json"

  local exit_code=0
  AGENTS_ROOT="$GYM_AGENTS" \
  STATE_DIR="$GYM_ROOT/state" \
    "${MAY_CMD[@]}" \
      --oneshot \
      --agent "$AGENT_NAME" \
      --task-file "$task_file" \
      --timeout="$timeout" \
      > "$result_file" 2>"$GYM_ROOT/agent-stderr.log" || exit_code=$?

  # Parse session info from result
  if [[ -f "$result_file" ]]; then
    SESSION_ID=$(python3 -c "import json; print(json.load(open('$result_file')).get('sessionId',''))" 2>/dev/null || true)
    AGENT_STATUS=$(python3 -c "import json; print(json.load(open('$result_file')).get('status','unknown'))" 2>/dev/null || true)
    AGENT_DURATION=$(python3 -c "import json; print(json.load(open('$result_file')).get('duration',''))" 2>/dev/null || true)
  fi

  # Resolve session path
  SESSION_PATH=""
  if [[ -n "${SESSION_ID:-}" ]]; then
    for candidate in "$GYM_ROOT/state/sessions/$SESSION_ID" "$GYM_ROOT/state/sessions/history/$SESSION_ID"; do
      if [[ -d "$candidate" ]]; then
        SESSION_PATH="$candidate"
        break
      fi
    done
  fi

  return $exit_code
}
