#!/bin/bash
# Flakiness Detector - runs the curated Bun app health suite 3 times and flags inconsistent results.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "=== Flakiness Detector ==="
echo "Running curated Bun test suite 3 times..."

RESULTS=""
for i in 1 2 3; do
  echo "Run $i/3..."
  OUT="/tmp/may_agent_test_full_${i}.txt"
  if (cd "$APP_DIR" && bun run test > "$OUT" 2>&1); then
    RESULTS="${RESULTS}0"
  else
    RESULTS="${RESULTS}1"
  fi
  grep -E "[0-9]+ pass|[0-9]+ fail|across [0-9]+ files?" "$OUT" > "/tmp/may_agent_test_summary_${i}.txt" || true
done

echo ""
echo "=== Results ==="
for i in 1 2 3; do
  echo "Run $i:"
  sed 's/^/  /' "/tmp/may_agent_test_summary_${i}.txt"
done

if [ "$RESULTS" = "000" ]; then
  if diff -q /tmp/may_agent_test_summary_1.txt /tmp/may_agent_test_summary_2.txt >/dev/null 2>&1 && \
     diff -q /tmp/may_agent_test_summary_2.txt /tmp/may_agent_test_summary_3.txt >/dev/null 2>&1; then
    echo "NO FLAKY TESTS DETECTED (3 runs consistent)"
    exit 0
  fi
  echo "WARNING: all runs passed, but summaries differed. Review /tmp/may_agent_test_summary_*.txt"
  exit 1
fi

echo "FLAKY OR FAILING TESTS DETECTED. Exit codes: $RESULTS"
exit 1
