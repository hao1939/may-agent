#!/bin/bash
# may.sh — manage may-agent instances
#
# Usage:
#   ./may.sh                      Start default instance (interactive)
#   ./may.sh start [name]         Start instance in background (tmux)
#   ./may.sh list                 List all instances
#   ./may.sh stop [name]          Stop an instance (SIGTERM)
#   ./may.sh send [name] "msg"    Send message to instance via socket
#   ./may.sh log [name]           Attach to instance's tmux session
#
# Environment:
#   STATE_DIR     State directory (default: .state)
#   SCHEDULERS=1  Enable cron jobs (default: on)

set -e
cd "$(dirname "$0")"
# Source env files (telegram bot, etc.)
[ -f .env.telegram ] && export $(grep -v "^#" .env.telegram | xargs)


STATE_DIR="${STATE_DIR:-.state}"
AGENT="${AGENT:-may}"
# Capture explicit SCHEDULERS override; per-command defaults apply below.
SCHEDULERS_OVERRIDE="${SCHEDULERS:-}"
SCHEDULERS="${SCHEDULERS:-1}"
export SCHEDULERS

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
  local pid_file="$1"
  if [ ! -f "$pid_file" ]; then
    return 1
  fi
  local pid
  pid=$(cat "$pid_file" 2>/dev/null)
  if [ -z "$pid" ]; then
    return 1
  fi
  kill -0 "$pid" 2>/dev/null
}

cleanup_stale() {
  local pid_file="$1"
  local sock_file="$2"
  if [ -f "$pid_file" ] && ! is_alive "$pid_file"; then
    rm -f "$pid_file" "$sock_file" 2>/dev/null
  fi
}

# ── Commands ─────────────────────────────────────────────────────────────

cmd_run() {
  # Interactive foreground run (default instance, with restart loop)
  # Cron jobs disabled by default in interactive mode (set SCHEDULERS=1 to override)
  SCHEDULERS="${SCHEDULERS_OVERRIDE:-0}"
  export SCHEDULERS
  local instance="${1:-}"
  export INSTANCE="$instance"
  while true; do
    echo "[$(date)] Starting may-agent (instance: ${instance:-default})..."
    npx tsx run/may.ts
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
  [ -n "$SCHEDULERS" ] && cmd="$cmd SCHEDULERS=$SCHEDULERS"
  [ -n "$AGENT" ] && cmd="$cmd AGENT=$AGENT"
  [ -n "$TELEGRAM_BOT_TOKEN" ] && cmd="$cmd TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN"
  [ -n "$TELEGRAM_CHAT_ID" ] && cmd="$cmd TELEGRAM_CHAT_ID=$TELEGRAM_CHAT_ID"
  [ -n "$STATE_DIR" ] && [ "$STATE_DIR" != ".state" ] && cmd="$cmd STATE_DIR=$STATE_DIR"
  cmd="$cmd npx tsx run/may.ts"

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

  # Wait up to 5s for graceful shutdown
  for i in $(seq 1 10); do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Stopped."
      return
    fi
    sleep 0.5
  done

  echo "Still alive after 5s, sending SIGKILL..."
  kill -9 "$pid" 2>/dev/null
  cleanup_stale "$pf" "$(sock_path "$name")"
  echo "Killed."
}

cmd_list() {
  mkdir -p "$STATE_DIR"

  printf "%-15s %-8s %-8s %-30s\n" "INSTANCE" "PID" "STATUS" "SOCKET"
  printf "%-15s %-8s %-8s %-30s\n" "--------" "---" "------" "------"

  local found=0

  for pid_file in "${STATE_DIR}/${AGENT}"*.pid; do
    [ -f "$pid_file" ] || continue
    found=1

    local base
    base=$(basename "$pid_file" .pid)

    # Extract instance name: may.pid -> default, may.foo.pid -> foo
    local instance_name
    if [ "$base" = "$AGENT" ]; then
      instance_name="default"
    else
      instance_name="${base#${AGENT}.}"
    fi

    local pid
    pid=$(cat "$pid_file" 2>/dev/null)
    local status="dead"
    local sock_file

    if [ "$instance_name" = "default" ]; then
      sock_file="${STATE_DIR}/${AGENT}.sock"
    else
      sock_file="${STATE_DIR}/${AGENT}.${instance_name}.sock"
    fi

    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      status="alive"
    else
      # Clean up stale files
      rm -f "$pid_file" "$sock_file" 2>/dev/null
      status="stale (cleaned)"
    fi

    local sock_display
    if [ -S "$sock_file" ]; then
      sock_display=$(basename "$sock_file")
    else
      sock_display="-"
    fi

    printf "%-15s %-8s %-8s %-30s\n" "$instance_name" "${pid:-?}" "$status" "$sock_display"
  done

  if [ $found -eq 0 ]; then
    echo "(no instances found)"
  fi
}

cmd_send() {
  local name=""
  local message=""

  if [ $# -eq 1 ]; then
    # ./may.sh send "message" — default instance
    message="$1"
  elif [ $# -eq 2 ]; then
    name="$1"
    message="$2"
  else
    echo "Usage: ./may.sh send [instance] \"message\""
    exit 1
  fi

  local sf
  sf=$(sock_path "$name")

  if [ ! -S "$sf" ]; then
    echo "No socket at $sf. Is instance '${name:-default}' running?"
    echo "Run: ./may.sh list"
    exit 1
  fi

  local payload
  payload=$(printf '{"type":"input","message":"%s"}\n' "$(echo "$message" | sed 's/"/\\"/g')")
  echo "$payload" | socat - UNIX-CONNECT:"$sf"
}

cmd_log() {
  local name="${1:-}"
  local tmux_session
  tmux_session=$(tmux_name "$name")

  if ! tmux has-session -t "$tmux_session" 2>/dev/null; then
    echo "No tmux session '$tmux_session'. Is instance '${name:-default}' running via ./may.sh start?"
    exit 1
  fi

  tmux attach-session -t "$tmux_session"
}

# ── Dispatch ─────────────────────────────────────────────────────────────

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
  help|--help|-h)
    echo "Usage: ./may.sh [command] [args]"
    echo ""
    echo "Commands:"
    echo "  (no command)        Start default instance interactively (with restart loop)"
    echo "  start [name]        Start instance in background (tmux)"
    echo "  stop [name]         Stop an instance"
    echo "  list                List all instances"
    echo "  send [name] \"msg\"   Send message to instance"
    echo "  log [name]          Attach to instance's tmux session"
    echo ""
    echo "If name is omitted, 'default' is used."
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
