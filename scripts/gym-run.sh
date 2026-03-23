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
#   --timeout <min>       Override timeout in minutes
#   --tier <tier>         Filter: smoke, standard, full
#   --category <cat>      Filter by category
#   --tag <tag>           Filter by tag
#   --list                List matching scenarios
#   --run-all             Run all matching scenarios

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure bun is discoverable even when not in system PATH (e.g., container deploys)
for _bun_dir in "$PROJECT_ROOT/.state/.bun/bin" "$HOME/.bun/bin"; do
  [ -x "$_bun_dir/bun" ] && { export PATH="$_bun_dir:$PATH"; break; }
done

exec bun "$PROJECT_ROOT/test/gym/gym-runner.ts" "$@"
