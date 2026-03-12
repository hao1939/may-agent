#!/bin/bash
# may.sh — manage may-agent instances
#
# Usage:
#   ./may.sh [name] [flags]       Start interactive instance (foreground)
#   ./may.sh start [name] [flags] Start background instance (tmux)
#   ./may.sh stop [name]          Stop an instance
#   ./may.sh restart [name]       Hot-reload an instance
#   ./may.sh list                 List all instances
#   ./may.sh logs [name]          Tail logs
#   ./may.sh attach [name]        Attach to tmux session
#   ./may.sh send [name] "msg"    Send message to instance
#   ./may.sh task [opts] "msg"    Run a one-off task
#
# Flags (run/start):
#   --cron       Enable cron jobs (default: disabled)
#   --telegram   Enable Telegram bot (default: disabled)
#
# Environment:
#   STATE_DIR     State directory (default: .state)
#   INSTANCE      Instance name (default: default)

set -e
cd "$(dirname "$0")"
[ -f .env ] && export $(grep -v "^#" .env | xargs)

STATE_DIR="${STATE_DIR:-.state}"
AGENT="${AGENT:-may}"

# ── Helpers ──────────────────────────────────────────────────────────────

sock_path() {
  local name="${1:-default}"
  echo "${STATE_DIR}/instances/${name}/${AGENT}.sock"
}

pid_path() {
  local name="${1:-default}"
  echo "${STATE_DIR}/instances/${name}/${AGENT}.pid"
}

tmux_name() {
  local name="${1:-default}"
  if [ "$name" = "default" ]; then echo "may"; else echo "may-${name}"; fi
}

is_alive() {
  local pf="$1"
  [ -f "$pf" ] && kill -0 "$(cat "$pf")" 2>/dev/null
}

cleanup_stale() {
  local pf="$1"
  local sock_file="$2"
  if [ -f "$pf" ] && ! kill -0 "$(cat "$pf")" 2>/dev/null; then
    rm -f "$pf" "$sock_file" 2>/dev/null
  fi
}

parse_flags() {
  local args=("$@")
  local flags=""
  local name=""
  
  for arg in "${args[@]}"; do
    if [[ "$arg" == --* ]]; then
      flags="$flags $arg"
    elif [ -z "$name" ]; then
      name="$arg"
    fi
  done
  
  # Return space-separated: "name flags"
  echo "${name:-default} $flags"
}

# ── Commands ─────────────────────────────────────────────────────────────

cmd_run() {
  # Interactive foreground run
  # Usage: ./may.sh [name] [--flags]
  read -r name extra_args <<< "$(parse_flags "$@")"

  # Default: chat+console+socket. Cron/Telegram are opt-in via flags.
  local cmd="INSTANCE='${name}' npx tsx src/app/launcher.ts --chat --console --socket $extra_args"
  
  echo "Starting interactive instance '$name'..."
  # Check if locked
  local pf=$(pid_path "$name")
  if is_alive "$pf"; then
    echo "Error: Instance '$name' is already running (PID $(cat "$pf"))."
    echo "Tip: Use './may.sh attach $name' to join it, or use a different name."
    exit 1
  fi

  eval "$cmd"
}

cmd_start() {
  # Background run (tmux)
  # Usage: ./may.sh start [name] [--flags]
  read -r name extra_args <<< "$(parse_flags "$@")"

  local tmux_session=$(tmux_name "$name")
  local pf=$(pid_path "$name")

  if is_alive "$pf"; then
    echo "Instance '$name' is already running (PID $(cat "$pf"))."
    exit 1
  fi
  cleanup_stale "$pf" "$(sock_path "$name")"

  # Build command
  local cmd="INSTANCE='${name}'"
  [ -n "$AGENT" ] && cmd="$cmd AGENT=$AGENT"
  if [ -f .env ]; then
    while IFS="=" read -r key val; do
      case "$key" in "#"*|"") continue;; esac
      cmd="$cmd $key=$val"
    done < .env
  fi
  [ -n "$STATE_DIR" ] && [ "$STATE_DIR" != ".state" ] && cmd="$cmd STATE_DIR=$STATE_DIR"
  
  # Default: chat+console+socket. Cron/Telegram must be explicit.
  # We construct the full command string for tmux.
  cmd="$cmd npx tsx src/app/launcher.ts --chat --console --socket $extra_args"

  if tmux has-session -t "$tmux_session" 2>/dev/null; then
    tmux kill-session -t "$tmux_session"
  fi
  tmux new-session -d -s "$tmux_session" "$cmd"
  
  echo "Started '$name' in tmux session '$tmux_session'."
  echo "  Attach: ./may.sh attach $name"
  echo "  Logs:   ./may.sh logs $name"
  echo "  Stop:   ./may.sh stop $name"
}

cmd_stop() {
  local name="${1:-default}"
  local pf=$(pid_path "$name")

  if ! is_alive "$pf"; then
    echo "Instance '$name' is not running."
    cleanup_stale "$pf" "$(sock_path "$name")"
    return
  fi

  local pid=$(cat "$pf")
  echo "Stopping '$name' (PID $pid)..."
  kill "$pid"
  for i in {1..10}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Stopped."
      rm -f "$pf"
      return
    fi
    sleep 1
  done
  kill -9 "$pid" 2>/dev/null
  rm -f "$pf"
}

cmd_restart() {
  local name="${1:-default}"
  local sf=$(sock_path "$name")

  if [ ! -S "$sf" ]; then
    echo "Socket not found for '$name'. Restarting via stop+start..."
    cmd_stop "$name"
    cmd_start "$name"
    return
  fi

  echo "Sending hot-reload signal to '$name'..."
  echo '{"type":"restart"}' | socat - UNIX-CONNECT:"$sf" 2>/dev/null || {
    echo "Socket failed. Force restarting..."
    cmd_stop "$name"
    cmd_start "$name"
  }
}

cmd_list() {
  echo "Instances:"
  local found=0
  for identity in "${STATE_DIR}"/instances/*/identity.json; do
    [ -f "$identity" ] || continue
    found=1
    
    python3 -c "
import json, sys, os
try:
    with open('$identity') as f: d = json.load(f)
    pid = d.get('pid')
    alive = False
    if pid:
        try:
            os.kill(int(pid), 0)
            alive = True
        except: pass
    
    status = d.get('status', '?')
    if alive and status == 'running': icon = '🟢'
    elif not alive and status == 'running': icon = '💀'
    elif status == 'done': icon = '✅'
    elif status == 'error': icon = '❌'
    else: icon = '❓'
    
    inst = d.get('instance','?')
    agent = d.get('agent','?')
    started = d.get('startedAt','?')[:19]
    print(f'  {icon} {inst:<20} {agent:<10} pid={pid:<6} {started}')
except: pass
"
  done
  
  if [ $found -eq 0 ]; then
    echo "  (none)"
  fi
}

cmd_logs() {
  local name="${1:-default}"
  local logfile="${STATE_DIR}/${name}.log"
  
  if [ -f "$logfile" ]; then
    tail -f "$logfile"
  else
    # Try finding session log
    local sid=$(python3 -c "import json; print(json.load(open('${STATE_DIR}/instances/${name}/identity.json')).get('sessionId',''))" 2>/dev/null || echo "")
    if [ -n "$sid" ] && [ -f "${STATE_DIR}/sessions/${sid}/session.jsonl" ]; then
      tail -f "${STATE_DIR}/sessions/${sid}/session.jsonl"
    else
      echo "No logs found for '$name'."
    fi
  fi
}

cmd_attach() {
  local name="${1:-default}"
  local session=$(tmux_name "$name")
  if tmux has-session -t "$session" 2>/dev/null; then
    tmux attach-session -t "$session"
  else
    echo "No tmux session '$session' found."
  fi
}

cmd_send() {
  local name="default"
  local msg=""
  if [ $# -ge 2 ]; then name="$1"; shift; msg="$*";
  else msg="$1"; fi

  local sock=$(sock_path "$name")
  if [ ! -S "$sock" ]; then
    echo "Socket not found for '$name'."
    exit 1
  fi
  
  local json_msg=$(printf '%s' "$msg" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
  echo "{\"type\":\"input\",\"message\":$json_msg}" | socat - UNIX-CONNECT:"$sock"
}

cmd_task() {
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

  [ -z "$name" ] && name="task-$(date +%s)"
  local instance="job-${name}"
  
  echo "Starting task '$name' (agent: $agent)..."
  
  if [ -n "$task_file" ]; then
    AGENT="$agent" INSTANCE="$instance" STATE_DIR="$STATE_DIR" \
      nohup npx tsx src/app/may.ts --task-file "$task_file" --socket > "${STATE_DIR}/${instance}.log" 2>&1 &
  else
    AGENT="$agent" INSTANCE="$instance" STATE_DIR="$STATE_DIR" \
      nohup npx tsx src/app/may.ts --task "$task_msg" --socket > "${STATE_DIR}/${instance}.log" 2>&1 &
  fi
  
  echo "  PID: $!"
  echo "  Logs: ./may.sh logs $instance"
}

# ── Entrypoint ───────────────────────────────────────────────────────────

case "${1:-}" in
  start)   shift; cmd_start "$@" ;;
  stop)    shift; cmd_stop "$@" ;;
  restart) shift; cmd_restart "$@" ;;
  list|status|ps) cmd_list ;;
  logs|log) shift; cmd_logs "$@" ;;
  attach)  shift; cmd_attach "$@" ;;
  send)    shift; cmd_send "$@" ;;
  task)    shift; cmd_task "$@" ;;
  *)       cmd_run "$@" ;;
esac
