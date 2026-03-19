#!/usr/bin/env bash
#
# Generic adapter for gym runner
#
# Runs scenarios using any command specified via GYM_AGENT_CMD env var.
# The command receives the task via a file. The work directory is set as cwd.
#
# Example:
#   GYM_AGENT_CMD="my-agent --task-file" gym-run.sh phantom-fix --adapter generic
#
# The command is invoked as:
#   cd $WORK_DIR && $GYM_AGENT_CMD $TASK_FILE
#
# Interface contract: same as may-agent.sh adapter.

ADAPTER_NAME="generic"

adapter_setup() {
  local project_root="$1"

  if [[ -z "${GYM_AGENT_CMD:-}" ]]; then
    echo "GYM_AGENT_CMD env var required for generic adapter." >&2
    echo "Example: GYM_AGENT_CMD='my-agent --task-file' gym-run.sh phantom-fix --adapter generic" >&2
    return 1
  fi
}

adapter_run_agent() {
  local task_file="$1"
  local work_dir="$2"
  local timeout="$3"

  local timeout_secs=$((timeout * 60))

  SESSION_ID=""
  AGENT_STATUS="unknown"
  AGENT_DURATION=""
  SESSION_PATH=""

  local exit_code=0
  timeout "${timeout_secs}s" \
    bash -c "cd '$work_dir' && $GYM_AGENT_CMD '$task_file'" \
      > "$GYM_ROOT/agent-stdout.log" 2>"$GYM_ROOT/agent-stderr.log" || exit_code=$?

  if [[ $exit_code -eq 124 ]]; then
    AGENT_STATUS="timeout"
  elif [[ $exit_code -eq 0 ]]; then
    AGENT_STATUS="success"
  else
    AGENT_STATUS="error"
  fi

  return $exit_code
}
