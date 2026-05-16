#!/usr/bin/env bash
#
# gym-run.sh — Thin wrapper around the TypeScript gym runner.
#
# Usage:
#   scripts/gym-run.sh <scenario> [options]
#   scripts/gym-run.sh --list [--tier <t>] [--category <c>] [--tag <t>]
#   scripts/gym-run.sh --run-all [--tier <t>] [--category <c>] [--tag <t>]
#
# Options:
#   --adapter <name>      may-agent (default), claude-code, generic
#   --agent <name>        Agent name passed to adapter (default: coder)
#   --lab <fork>          Lab fork name (may-agent adapter only)
#   --common-sense <path> Overlay a custom common-sense.md (may-agent adapter)
#   --timeout <min>       Override timeout in minutes
#   --tier <tier>         Filter: smoke, standard, full
#   --category <cat>      Filter by category
#   --tag <tag>           Filter by tag
#   --list                List matching scenarios
#   --run-all             Run all matching scenarios

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure bun on PATH for host dev runs (the container image already has
# /usr/local/bin/bun on PATH).
if [ -x "$HOME/.bun/bin/bun" ]; then
  export PATH="$HOME/.bun/bin:$PATH"
fi

# ── Mode detection ──────────────────────────────────────────────────────
_is_list=0
for _arg in "$@"; do
  [ "$_arg" = "--list" ] && _is_list=1
done

# --list mode: exec directly (no recording needed, plain text output)
if [ "$_is_list" -eq 1 ]; then
  exec bun "$PROJECT_ROOT/test/gym/gym-runner.ts" "$@"
fi

# ── Normal / run-all mode: capture output, display, and record ─────────
_tmpout=$(mktemp)
_exit_code=0
bun "$PROJECT_ROOT/test/gym/gym-runner.ts" "$@" > "$_tmpout" 2>&1 || _exit_code=$?

# Always display output to caller
cat "$_tmpout"

# Record to DB unless GYM_NO_RECORD=1
if [ "${GYM_NO_RECORD:-0}" != "1" ]; then
  # Extract JSON block from output (skip non-JSON lines like progress/debug messages)
  # Find line number of first JSON opening brace/bracket
  _json_start=$(grep -nE '^\s*[\[{]' "$_tmpout" | head -1 | cut -d: -f1)
  if [ -n "$_json_start" ]; then
    tail -n +"$_json_start" "$_tmpout" | bun "$PROJECT_ROOT/scripts/gym-record.ts" 2>/dev/null || true
  fi
fi

rm -f "$_tmpout"
exit "$_exit_code"
