#!/usr/bin/env bash
# Regression guard: alerts if any SOUL.md exceeds 600 words or context.md exceeds 450 words
# Run from repo root: bash agents/shared/projects/outputs/regression-guard.sh

set -euo pipefail

SOUL_LIMIT=600
CTX_LIMIT=450
EXIT=0

for f in agents/*/SOUL.md; do
  [ -f "$f" ] || continue
  wc=$(wc -w < "$f")
  if [ "$wc" -gt "$SOUL_LIMIT" ]; then
    echo "FAIL: $f is ${wc}w (limit ${SOUL_LIMIT}w)"
    EXIT=1
  else
    echo "OK:   $f — ${wc}w"
  fi
done

for f in agents/*/context.md; do
  [ -f "$f" ] || continue
  wc=$(wc -w < "$f")
  if [ "$wc" -gt "$CTX_LIMIT" ]; then
    echo "FAIL: $f is ${wc}w (limit ${CTX_LIMIT}w)"
    EXIT=1
  else
    echo "OK:   $f — ${wc}w"
  fi
done

if [ "$EXIT" -eq 0 ]; then
  echo -e "\nAll files within limits."
else
  echo -e "\nREGRESSION DETECTED — files above word limits."
fi
exit $EXIT
