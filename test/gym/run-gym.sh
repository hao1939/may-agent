#!/usr/bin/env bash
#
# Gym runner shell wrapper.
# Compiles src/gym/runner.ts → cached JS bundle, then runs it with node.
#
# Usage:
#   test/gym/run-gym.sh <scenario> [--agent <name>] [--timeout <min>]
#   test/gym/run-gym.sh --list [--tier <t>] [--tag <t>] [--category <c>]
#   test/gym/run-gym.sh --run-all [--tier <t>] [--agent <name>]

set -euo pipefail

# ── Resolve project root relative to this script ─────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENTS_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT_ROOT="$(cd "$AGENTS_ROOT/.." && pwd)"
RUNNER_TS="$AGENTS_ROOT/src/gym/runner.ts"
STRIP_TYPES="$SCRIPT_DIR/strip-types.cjs"
RUNNER_MJS="$SCRIPT_DIR/.gym-runner-bundle.mjs"

# ── Compile (with caching) ───────────────────────────────────────────
ESBUILD="$PROJECT_ROOT/node_modules/.bin/esbuild"

needs_compile() {
  [ ! -f "$RUNNER_MJS" ] || ([ -f "$RUNNER_TS" ] && [ "$RUNNER_TS" -nt "$RUNNER_MJS" ])
}

if [ -f "$RUNNER_MJS" ] && ! needs_compile; then
  : # Use cached bundle
elif [ ! -f "$RUNNER_TS" ]; then
  if [ ! -f "$RUNNER_MJS" ]; then
    echo "ERROR: Runner source not found at $RUNNER_TS and no cached bundle exists." >&2
    exit 1
  fi
elif [ -x "$ESBUILD" ]; then
  "$ESBUILD" "$RUNNER_TS" \
    --bundle \
    --platform=node \
    --format=esm \
    --outfile="$RUNNER_MJS" \
    --target=node18 \
    --log-level=warning 2>&1
elif command -v esbuild >/dev/null 2>&1; then
  esbuild "$RUNNER_TS" \
    --bundle \
    --platform=node \
    --format=esm \
    --outfile="$RUNNER_MJS" \
    --target=node18 \
    --log-level=warning 2>&1
elif [ -f "$STRIP_TYPES" ]; then
  node "$STRIP_TYPES" "$RUNNER_TS" "$RUNNER_MJS"
else
  echo "ERROR: Cannot compile $RUNNER_TS — no esbuild or strip-types.cjs found." >&2
  exit 1
fi

# ── Run the compiled JS ──────────────────────────────────────────────
export GYM_PROJECT_ROOT="${GYM_PROJECT_ROOT:-$PROJECT_ROOT}"

exec node "$RUNNER_MJS" "$@"
