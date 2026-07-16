#!/usr/bin/env bash
# EXP-600 Baseline Measurement: Bash Waste Rate
# Measures retry-without-change and bash-waste-rate from existing session logs
#
# Usage: bash projects/gym/experiments/EXP-600-baseline.sh [agent] [n_sessions]
# Default: tech-lead, 50 sessions

set -euo pipefail

AGENT="${1:-tech-lead}"
N="${2:-50}"
CHECKPOINT_DIR=".state/checkpoints"

echo "=== EXP-600 Baseline: Bash Waste Rate ==="
echo "Agent: $AGENT | Sessions: $N"
echo ""

TOTAL_BASH=0
WASTED_BASH=0
SESSIONS_CHECKED=0

SESSION_FILES=$(ls -t "$CHECKPOINT_DIR"/s_*.jsonl 2>/dev/null | head -200)

for FILE in $SESSION_FILES; do
  if [ $SESSIONS_CHECKED -ge $N ]; then
    break
  fi

  # Check if session belongs to target agent
  if ! grep -q "\"agent\":\"$AGENT\"\|\"name\":\"$AGENT\"" "$FILE" 2>/dev/null; then
    if ! head -5 "$FILE" | grep -qi "$AGENT" 2>/dev/null; then
      continue
    fi
  fi

  SESSIONS_CHECKED=$((SESSIONS_CHECKED + 1))

  BASH_CALLS=$(grep -c '"tool":"bash"\|"name":"bash"' "$FILE" 2>/dev/null || echo 0)
  TOTAL_BASH=$((TOTAL_BASH + BASH_CALLS))

  NONZERO=$(grep -c 'exit.code.*[1-9]\|exit code [1-9]\|exit_code.*[1-9]' "$FILE" 2>/dev/null || echo 0)
  WASTED_BASH=$((WASTED_BASH + NONZERO))
done

echo "Sessions checked: $SESSIONS_CHECKED"
echo "Total bash calls: $TOTAL_BASH"
echo "Non-zero exits (proxy for waste): $WASTED_BASH"

if [ $TOTAL_BASH -gt 0 ]; then
  WASTE_RATE=$(echo "scale=1; $WASTED_BASH * 100 / $TOTAL_BASH" | bc 2>/dev/null || echo "N/A")
  echo "Bash waste rate: ${WASTE_RATE}%"
else
  echo "Bash waste rate: N/A (no bash calls found)"
fi
