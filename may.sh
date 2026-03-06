#!/bin/bash
# may.sh — manage may-agent instances
#
# Usage:
#   ./may.sh                      Start default instance (interactive, with --cron)
#   ./may.sh start [name]         Start instance in background (tmux, with --cron)
#   ./may.sh list                 List all instances
#   ./may.sh stop [name]          Stop an instance (SIGTERM)
#   ./may.sh send [name] "msg"    Send message to instance via socket
#   ./may.sh log [name]           Attach to instance's tmux session
#
# Environment:
#   STATE_DIR     State directory (default: .state)

set -e
cd "$(dirname "$0")"
# Source env file
[ -f .env ] && export $(grep -v "^#" .env | xargs)

STATE_DIR="${STATE_DIR:-.state}"
AGENT="${AGENT:-may}"

# ── Helpers ──────────────────────────────────────────────────────────────

sock_path() {
  local name="$1"
  if [ -z "$name" ] || [ "$name" = "default" ]; then
    echo "${STATE_DIR}/${AGENT}.sock"
  else
    echo "${STATE_DIR}/${AGENT}.${name}.sock"
  fi
}

pid_path() {
  local name="$1"
  if [ -z "$name" ] || [ "$name" = "default" ]; then
    echo "${STATE_DIR}/${AGENT}.pid"
  else
    echo "${STATE_DIR}/${AGENT}.${name}.pid"
  fi
}

tmux_name() {
  local name="$1"
  if [ -z "$name" ] || [ "$name" = "default" ]; then
    echo "may"
  else
    echo "may-${name}"
  fi
}

is_alive() {
  local pf="$1"
  [ -f "$pf" ] && kill -0 "$(cat "$pf")" 2>/dev/null
}

cleanup_stale() {
  local pf="$1"
  local sock_file="$2"
  if [ -f "$pf" ] && ! kill -0 "$(cat "$pf")" 2>/dev/null; then
    echo "Cleaning up stale PID file: $pf"
    rm -f "$pf" "$sock_file" 2>/dev/null
  fi
}

# ── Commands ─────────────────────────────────────────────────────────────

cmd_run() {
  # Interactive foreground run (default instance, with restart loop)
  # --cron enables cron jobs; only the main instance should have this
  local instance="${1:-}"
  export INSTANCE="$instance"
  while true; do
    echo "[$(date)] Starting may-agent (instance: ${instance:-default})..."
    npx tsx run/may.ts --cron
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
      echo "[$(date)] Clean exit."
      break
    fi
    echo "[$(date)] Crashed with exit code $EXIT_CODE. Restarting in 3s..."
    sleep 3
  done
}

cmd_start() {
  local name="${1:-}"
  local tmux_session
  tmux_session=$(tmux_name "$name")
  local pf
  pf=$(pid_path "$name")

  # Check if already running
  if is_alive "$pf"; then
    local pid
    pid=$(cat "$pf")
    echo "Instance '${name:-default}' is already running (PID $pid)."
    echo "Use: ./may.sh stop ${name:-default}"
    exit 1
  fi

  # Clean up stale files
  cleanup_stale "$pf" "$(sock_path "$name")"

  # Build the command
  local cmd="INSTANCE='${name}'"
  [ -n "$AGENT" ] && cmd="$cmd AGENT=$AGENT"
  # Pass through all .env vars to tmux
  if [ -f .env ]; then
    while IFS="=" read -r key val; do
      case "$key" in "#"*|"") continue;; esac
      cmd="$cmd $key=$val"
    done < .env
  fi
  [ -n "$STATE_DIR" ] && [ "$STATE_DIR" != ".state" ] && cmd="$cmd STATE_DIR=$STATE_DIR"
  cmd="$cmd npx tsx run/may.ts --cron"

  # Start in tmux
  if tmux has-session -t "$tmux_session" 2>/dev/null; then
    tmux kill-session -t "$tmux_session"
  fi
  tmux new-session -d -s "$tmux_session" "$cmd"
  echo "Started instance '${name:-default}' in tmux session '$tmux_session'."
  echo "  Attach: ./may.sh log ${name:-default}"
  echo "  Stop:   ./may.sh stop ${name:-default}"
}

cmd_stop() {
  local name="${1:-}"
  local pf
  pf=$(pid_path "$name")

  if ! is_alive "$pf"; then
    echo "Instance '${name:-default}' is not running."
    cleanup_stale "$pf" "$(sock_path "$name")"
    exit 1
  fi

  local pid
  pid=$(cat "$pf")
  echo "Stopping instance '${name:-default}' (PID $pid)..."
  kill "$pid"
  # Wait up to 10s for graceful shutdown
  for i in $(seq 1 10); do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Stopped."
      rm -f "$pf"
      return
    fi
    sleep 1
  done
  echo "Force killing..."
  kill -9 "$pid" 2>/dev/null
  rm -f "$pf"
}

cmd_list() {
  echo "Instances:"
  local found=0
  for pf in "${STATE_DIR}"/${AGENT}*.pid; do
    [ -f "$pf" ] || continue
    found=1
    local name
    name=$(basename "$pf" .pid)
    name="${name#${AGENT}.}"
    [ "$name" = "$AGENT" ] && name="default"
    if is_alive "$pf"; then
      local pid
      pid=$(cat "$pf")
      echo "  ✅ ${name} (PID $pid)"
    else
      echo "  ❌ ${name} (stale)"
    fi
  done
  if [ $found -eq 0 ]; then
    echo "  (none)"
  fi
}

cmd_send() {
  local name=""
  local message=""

  if [ $# -ge 2 ]; then
    name="$1"
    shift
    message="$*"
  elif [ $# -eq 1 ]; then
    message="$1"
  else
    echo "Usage: ./may.sh send [name] \"message\""
    exit 1
  fi

  local sock
  sock=$(sock_path "$name")
  if [ ! -S "$sock" ]; then
    echo "Socket not found: $sock"
    echo "Is instance '${name:-default}' running?"
    exit 1
  fi

  echo "{\"type\":\"input\",\"message\":$(printf '%s' "$message" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}" | socat - UNIX-CONNECT:"$sock"
}

cmd_log() {
  local name="${1:-}"
  local tmux_session
  tmux_session=$(tmux_name "$name")
  if tmux has-session -t "$tmux_session" 2>/dev/null; then
    tmux attach-session -t "$tmux_session"
  else
    echo "No tmux session '$tmux_session' found."
    echo "Start one with: ./may.sh start ${name:-default}"
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────


cmd_task() {
  # Parse args
  local agent="$AGENT"
  local name=""
  local task_file=""
  local task_msg=""

  while [ $# -gt 0 ]; do
    case "$1" in
      --agent) agent="$2"; shift 2 ;;
      --name)  name="$2"; shift 2 ;;
      --file)  task_file="$2"; shift 2 ;;
      *)       task_msg="$1"; shift ;;
    esac
  done

  if [ -z "$task_msg" ] && [ -z "$task_file" ]; then
    echo "Usage: ./may.sh task [--agent <agent>] [--name <name>] [--file <file>] "task message""
    exit 1
  fi

  # Auto-generate instance name if not provided
  if [ -z "$name" ]; then
    name="task-$(date +%s)-$$"
  fi

  local instance_name="job-${name}"
  echo "Starting task instance: ${instance_name} (agent: ${agent})"

  # Run in background, detached
  if [ -n "$task_file" ]; then
    AGENT="$agent" INSTANCE="$instance_name" STATE_DIR="$STATE_DIR" \
      nohup npx tsx run/may.ts --task-file "$task_file" > "${STATE_DIR}/${instance_name}.log" 2>&1 &
  else
    AGENT="$agent" INSTANCE="$instance_name" STATE_DIR="$STATE_DIR" \
      nohup npx tsx run/may.ts --task "$task_msg" > "${STATE_DIR}/${instance_name}.log" 2>&1 &
  fi

  local pid=$!
  echo "PID: $pid"
  echo "Logs: ${STATE_DIR}/${instance_name}.log"
  echo "Identity: ${STATE_DIR}/${instance_name}/identity.json"
}

cmd_ps() {
  echo "Running instances:"
  echo ""
  local found=0
  for identity in "${STATE_DIR}"/*/identity.json; do
    [ -f "$identity" ] || continue
    found=1
    local status agent instance pid started task duration
    status=$(python3 -c "import json; d=json.load(open('$identity')); print(d.get('status','?'))" 2>/dev/null || echo "?")
    agent=$(python3 -c "import json; d=json.load(open('$identity')); print(d.get('agent','?'))" 2>/dev/null || echo "?")
    instance=$(python3 -c "import json; d=json.load(open('$identity')); print(d.get('instance','?'))" 2>/dev/null || echo "?")
    pid=$(python3 -c "import json; d=json.load(open('$identity')); print(d.get('pid','?'))" 2>/dev/null || echo "?")
    started=$(python3 -c "import json; d=json.load(open('$identity')); print(d.get('startedAt','?')[:19])" 2>/dev/null || echo "?")
    task=$(python3 -c "import json; d=json.load(open('$identity')); t=d.get('task',''); print(t[:60] if t else '-')" 2>/dev/null || echo "-")
    duration=$(python3 -c "import json; d=json.load(open('$identity')); print(d.get('duration',''))" 2>/dev/null || echo "")

    # Check if actually alive
    local alive="dead"
    if kill -0 "$pid" 2>/dev/null; then alive="alive"; fi

    local icon="❓"
    if [ "$status" = "running" ] && [ "$alive" = "alive" ]; then icon="🟢"
    elif [ "$status" = "running" ] && [ "$alive" = "dead" ]; then icon="💀"
    elif [ "$status" = "done" ]; then icon="✅"
    elif [ "$status" = "error" ]; then icon="❌"
    fi

    printf "  %s %-25s %-10s pid=%-7s %s  %s\n" "$icon" "$instance" "$agent" "$pid" "$started" "$task"
    [ -n "$duration" ] && [ "$status" != "running" ] && printf "     duration: %s\n" "$duration"
  done
  if [ $found -eq 0 ]; then
    echo "  (no instances found)"
  fi
}

cmd_logs() {
  local name="${1:-}"
  if [ -z "$name" ]; then
    echo "Usage: ./may.sh logs <instance-name>"
    exit 1
  fi

  # Check for log file
  local logfile="${STATE_DIR}/${name}.log"
  if [ -f "$logfile" ]; then
    tail -f "$logfile"
  else
    # Try session JSONL
    local session_dir="${STATE_DIR}/sessions"
    local sid
    sid=$(python3 -c "import json; d=json.load(open('${STATE_DIR}/${name}/identity.json')); print(d.get('sessionId',''))" 2>/dev/null || echo "")
    if [ -n "$sid" ] && [ -f "${session_dir}/${sid}/session.jsonl" ]; then
      tail -f "${session_dir}/${sid}/session.jsonl"
    else
      echo "No logs found for instance '${name}'"
      echo "Checked: ${logfile}"
      [ -n "$sid" ] && echo "Checked: ${session_dir}/${sid}/session.jsonl"
      exit 1
    fi
  fi
}

case "${1:-}" in
  start)
    shift
    cmd_start "$@"
    ;;
  stop)
    shift
    cmd_stop "$@"
    ;;
  list)
    cmd_list
    ;;
  send)
    shift
    cmd_send "$@"
    ;;
  log)
    shift
    cmd_log "$@"
    ;;
  task)
    shift
    cmd_task "$@"
    ;;
  ps)
    cmd_ps
    ;;
  logs)
    shift
    cmd_logs "$@"
    ;;
  help|--help|-h)
    echo "Usage: ./may.sh [command] [args]"
    echo ""
    echo "Commands:"
    echo "  (no command)        Start default instance interactively (with --cron)"
    echo "  start [name]        Start instance in background (tmux, with --cron)"
    echo "  stop [name]         Stop an instance"
    echo "  list                List tmux instances"
    echo "  ps                  List all instances (from identity.json)"
    echo "  task [opts] \"msg\"  Run a task in a dedicated instance"
    echo "  logs <instance>     Tail instance logs"
    echo "  send [name] \"msg\"   Send message to instance"
    echo "  log [name]          Attach to instance's tmux session"
    echo ""
    echo "If name is omitted, 'default' is used."
    echo "Cron jobs (--cron) are always enabled for the main instance."
    echo "Sub-agents spawned by the system never get --cron."
    echo ""
    echo "Examples:"
    echo "  ./may.sh                          # interactive default"
    echo "  ./may.sh start dev                # background 'dev' instance"
    echo "  ./may.sh start                    # background default instance"
    echo "  ./may.sh list                     # show all instances"
    echo "  ./may.sh send dev 'run tests'     # send message to 'dev'"
    echo "  ./may.sh log dev                  # attach to 'dev' tmux"
    echo "  ./may.sh stop dev                 # stop 'dev'"
    ;;
  *)
    # No subcommand or unrecognized — run interactively
    cmd_run "$@"
    ;;
esac
