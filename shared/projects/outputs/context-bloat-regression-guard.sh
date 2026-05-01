#!/usr/bin/env bash
# Regression guard: alerts if any SOUL.md or context.md grows back above threshold
# Run from repo root: bash agents/shared/projects/outputs/context-bloat-regression-guard.sh

SOUL_LIMIT=600
CTX_LIMIT=450
EXIT=0

for f in agents/*/SOUL.md; do
  [ -f "$f" ] || continue
  wc=$(wc -w < "$f")
  if [ "$wc" -gt "$SOUL_LIMIT" ]; then
    echo "FAIL: $f is ${wc}w (limit ${SOUL_LIMIT}w)"
    EXIT=1
  fi
done

for f in agents/*/context.md; do
  [ -f "$f" ] || continue
  wc=$(wc -w < "$f")
  if [ "$wc" -gt "$CTX_LIMIT" ]; then
    echo "FAIL: $f is ${wc}w (limit ${CTX_LIMIT}w)"
    EXIT=1
  fi
done

[ "$EXIT" -eq 0 ] && echo "OK: All files within limits"
exit $EXIT
