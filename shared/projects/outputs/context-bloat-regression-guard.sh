#!/usr/bin/env bash
# Regression guard: alerts if any agent SOUL.md or context.md grows back above targets
# Run from repo root. Exit 1 if any file exceeds thresholds.

SOUL_LIMIT=600
CTX_LIMIT=450
FAIL=0

for f in agents/*/SOUL.md; do
  [ -f "$f" ] || continue
  wc=$(wc -w < "$f")
  if [ "$wc" -gt "$SOUL_LIMIT" ]; then
    echo "FAIL: $f is ${wc}w (limit ${SOUL_LIMIT}w)"
    FAIL=1
  fi
done

for f in agents/*/context.md; do
  [ -f "$f" ] || continue
  wc=$(wc -w < "$f")
  if [ "$wc" -gt "$CTX_LIMIT" ]; then
    echo "FAIL: $f is ${wc}w (limit ${CTX_LIMIT}w)"
    FAIL=1
  fi
done

if [ "$FAIL" -eq 0 ]; then
  echo "OK: All agent files within word-count limits"
fi
exit $FAIL
