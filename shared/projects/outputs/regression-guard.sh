#!/usr/bin/env bash
# Regression guard: alerts if any SOUL.md or context.md grows back above word limits
# Usage: bash regression-guard.sh [soul_limit] [context_limit]
SOUL_LIMIT=${1:-600}
CTX_LIMIT=${2:-450}
EXIT=0

for f in $(find /app/agents -name "SOUL.md" 2>/dev/null); do
  wc=$(wc -w < "$f")
  if [ "$wc" -gt "$SOUL_LIMIT" ]; then
    echo "FAIL: $f has ${wc}w (limit: ${SOUL_LIMIT}w)"
    EXIT=1
  else
    echo "OK:   $f ${wc}w"
  fi
done

for f in $(find /app/agents -name "context.md" 2>/dev/null); do
  wc=$(wc -w < "$f")
  if [ "$wc" -gt "$CTX_LIMIT" ]; then
    echo "FAIL: $f has ${wc}w (limit: ${CTX_LIMIT}w)"
    EXIT=1
  else
    echo "OK:   $f ${wc}w"
  fi
done

exit $EXIT
