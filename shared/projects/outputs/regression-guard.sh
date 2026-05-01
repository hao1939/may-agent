#!/usr/bin/env bash
# Regression guard: alerts if any SOUL.md exceeds 600w or context.md exceeds 450w
# Run from repo root: bash agents/shared/projects/outputs/regression-guard.sh

EXIT=0
for f in agents/*/SOUL.md; do
  [ -f "$f" ] || continue
  wc=$(wc -w < "$f")
  if [ "$wc" -gt 600 ]; then
    echo "FAIL: $f has ${wc}w (limit 600w)"
    EXIT=1
  else
    echo "OK: $f ${wc}w"
  fi
done

for f in agents/*/context.md; do
  [ -f "$f" ] || continue
  wc=$(wc -w < "$f")
  if [ "$wc" -gt 450 ]; then
    echo "FAIL: $f has ${wc}w (limit 450w)"
    EXIT=1
  else
    echo "OK: $f ${wc}w"
  fi
done

exit $EXIT
