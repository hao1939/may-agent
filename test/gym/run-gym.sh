#!/bin/bash
# run-gym.sh — Portable gym runner wrapper.
#
# Runs test/gym/gym-runner.ts using whatever TypeScript runtime is available:
#   1. bun (if installed)
#   2. esbuild bundle + node (fallback for containers without bun)
#
# Usage:  test/gym/run-gym.sh <scenario> [options]
#         test/gym/run-gym.sh --list
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUNNER_TS="$SCRIPT_DIR/gym-runner.ts"
RUNNER_MJS="$SCRIPT_DIR/.gym-runner-bundle.mjs"
ESBUILD="$PROJECT_ROOT/node_modules/.bin/esbuild"

# Strategy 1: bun (fastest, native .ts support)
if command -v bun &>/dev/null; then
  exec bun "$RUNNER_TS" "$@"
fi

# Strategy 2: esbuild + node
if [ -x "$ESBUILD" ]; then
  # Rebuild bundle if source is newer or bundle doesn't exist
  if [ ! -f "$RUNNER_MJS" ] || [ "$RUNNER_TS" -nt "$RUNNER_MJS" ]; then
    BANNER='import{fileURLToPath as _f}from"node:url";import{dirname as _d}from"node:path";if(!import.meta.dirname)Object.defineProperty(import.meta,"dirname",{get(){return _d(_f(import.meta.url))}});'
    "$ESBUILD" "$RUNNER_TS" --bundle --platform=node --format=esm \
      --packages=external --outfile="$RUNNER_MJS" \
      --banner:js="$BANNER" --log-level=warning 2>&1
  fi
  exec node "$RUNNER_MJS" "$@"
fi

echo "ERROR: No TypeScript runtime available. Need bun or esbuild." >&2
exit 1
