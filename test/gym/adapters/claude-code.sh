#!/usr/bin/env bash
#
# Claude Code adapter for gym runner
#
# Runs scenarios using `claude` CLI in non-interactive mode.
# Requires: claude CLI installed and authenticated.
#
# Interface contract: same as may-agent.sh adapter.

ADAPTER_NAME="claude-code"

adapter_setup() {
  local project_root="$1"

  if ! command -v claude &>/dev/null; then
    echo "claude CLI not found. Install: https://docs.anthropic.com/en/docs/claude-code" >&2
    return 1
  fi
}

adapter_run_agent() {
  local task_file="$1"
  local work_dir="$2"
  local timeout="$3"
  local result_file="$GYM_ROOT/agent-result.json"

  local task
  task=$(cat "$task_file")

  local timeout_secs=$((timeout * 60))

  local exit_code=0
  timeout "${timeout_secs}s" \
    claude -p "$task" \
      --dangerously-skip-permissions \
      --output-format json \
      --max-turns 50 \
      > "$result_file" 2>"$GYM_ROOT/agent-stderr.log" || exit_code=$?

  # Parse claude output
  SESSION_ID=""
  AGENT_STATUS="unknown"
  AGENT_DURATION=""
  SESSION_PATH=""

  if [[ $exit_code -eq 124 ]]; then
    AGENT_STATUS="timeout"
  elif [[ $exit_code -eq 0 ]]; then
    AGENT_STATUS="success"
  else
    AGENT_STATUS="error"
  fi

  return $exit_code
}
