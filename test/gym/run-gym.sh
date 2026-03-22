#!/usr/bin/env bash
#
# Gym runner shell wrapper.
# Compiles src/gym/runner.ts → temp JS, then runs it with node.
#
# Usage:
#   test/gym/run-gym.sh <scenario> [--agent <name>] [--timeout <min>]
#   test/gym/run-gym.sh --list [--tier <t>] [--tag <t>] [--category <c>]
#   test/gym/run-gym.sh --run-all [--tier <t>] [--agent <name>]

set -euo pipefail

# ── Resolve project root relative to this script ─────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUNNER_TS="$PROJECT_ROOT/src/gym/runner.ts"
STRIP_TYPES="$SCRIPT_DIR/strip-types.js"

if [ ! -f "$RUNNER_TS" ]; then
  echo "ERROR: Runner source not found at $RUNNER_TS" >&2
  exit 1
fi

# ── Create temp file for compiled JS ─────────────────────────────────
COMPILED_JS="$(mktemp /tmp/gym-runner-XXXXXX.mjs)"
trap 'rm -f "$COMPILED_JS"' EXIT

# ── Try to compile with esbuild ──────────────────────────────────────
ESBUILD=""

# Check node_modules/.bin/esbuild first
if [ -x "$PROJECT_ROOT/node_modules/.bin/esbuild" ]; then
  ESBUILD="$PROJECT_ROOT/node_modules/.bin/esbuild"
# Then check PATH
elif command -v esbuild >/dev/null 2>&1; then
  ESBUILD="esbuild"
# Then try npx esbuild (if npx is available)
elif command -v npx >/dev/null 2>&1; then
  # Verify npx can resolve esbuild before committing to it
  if npx --no-install esbuild --version >/dev/null 2>&1; then
    ESBUILD="npx --no-install esbuild"
  elif npx esbuild --version >/dev/null 2>&1; then
    ESBUILD="npx esbuild"
  fi
fi

if [ -n "$ESBUILD" ]; then
  # Use esbuild to compile TS → JS
  "$ESBUILD" "$RUNNER_TS" \
    --bundle \
    --platform=node \
    --format=esm \
    --outfile="$COMPILED_JS" \
    --target=node18 \
    2>/dev/null
elif [ -f "$STRIP_TYPES" ]; then
  # Fallback: use strip-types.js to remove TS annotations
  node "$STRIP_TYPES" "$RUNNER_TS" "$COMPILED_JS"
else
  echo "ERROR: Neither esbuild nor strip-types.js found. Cannot compile runner.ts" >&2
  echo "  Tried: node_modules/.bin/esbuild, esbuild on PATH, npx esbuild, $STRIP_TYPES" >&2
  exit 1
fi

# ── Run the compiled JS ──────────────────────────────────────────────
export GYM_PROJECT_ROOT="$PROJECT_ROOT"

# ── Auto-detect agent binary if GYM_AGENT_BIN not set ────────────────
if [ -z "${GYM_AGENT_BIN:-}" ]; then
  if [ -x "$PROJECT_ROOT/bundle/may-agent" ]; then
    export GYM_AGENT_BIN="$PROJECT_ROOT/bundle/may-agent"
  elif [ -x "/app/may-agent-bin" ]; then
    export GYM_AGENT_BIN="/app/may-agent-bin"
  fi
fi

exec node "$COMPILED_JS" "$@"
