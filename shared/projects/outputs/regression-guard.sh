#!/bin/bash
# Regression guard: alerts if any SOUL.md or context.md grows back above word limits
# Run periodically to ensure agent config bloat doesn't return

SOUL_LIMIT=600
CTX_LIMIT=450
EXIT=0

for f in /app/agents/*/SOUL.md; do
  [ -f "$f" ] || continue
  wc=$(wc -w < "$f")
  if [ "$wc" -gt "$SOUL_LIMIT" ]; then
    echo "FAIL: $f has ${wc}w (limit ${SOUL_LIMIT}w)"
    EXIT=1
  else
    echo "OK: $f ${wc}w"
  fi
done

for f in /app/agents/*/context.md; do
  [ -f "$f" ] || continue
  wc=$(wc -w < "$f")
  if [ "$wc" -gt "$CTX_LIMIT" ]; then
    echo "FAIL: $f has ${wc}w (limit ${CTX_LIMIT}w)"
    EXIT=1
  else
    echo "OK: $f ${wc}w"
  fi
done

exit $EXIT
