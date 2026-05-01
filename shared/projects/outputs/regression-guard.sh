#!/usr/bin/env bash
# Regression guard: alerts if any SOUL.md or context.md grows back above targets
# Usage: bash regression-guard.sh [agents_dir]
# Targets: SOUL.md < 600w, context.md < 450w

AGENTS_DIR="${1:-/app/agents}"
EXIT=0

for soul in "$AGENTS_DIR"/*/SOUL.md; do
  [ -f "$soul" ] || continue
  wc=$(wc -w < "$soul")
  agent=$(basename "$(dirname "$soul")")
  if [ "$wc" -gt 600 ]; then
    echo "FAIL: $agent/SOUL.md = ${wc}w (limit 600w)"
    EXIT=1
  else
    echo "OK:   $agent/SOUL.md = ${wc}w"
  fi
done

for ctx in "$AGENTS_DIR"/*/context.md; do
  [ -f "$ctx" ] || continue
  wc=$(wc -w < "$ctx")
  agent=$(basename "$(dirname "$ctx")")
  if [ "$wc" -gt 450 ]; then
    echo "FAIL: $agent/context.md = ${wc}w (limit 450w)"
    EXIT=1
  else
    echo "OK:   $agent/context.md = ${wc}w"
  fi
done

exit $EXIT
