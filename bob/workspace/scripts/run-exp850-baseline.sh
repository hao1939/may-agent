#!/bin/bash
# EXP-850: Tool-Call Budget Awareness — Baseline (Arm A)
# Run 5 trials of multi-file-refactor with NO budget instruction
# Measures: tool call count, task completion

set -euo pipefail

export GYM_AGENT_BIN=/usr/local/bin/may-agent
SCENARIO="multi-file-refactor"
TAG="EXP-850-arm-a-baseline"
RESULTS_DIR="/app/agents/bob/workspace/exp850-baseline-results"
mkdir -p "$RESULTS_DIR"

echo "=== EXP-850 Baseline: $SCENARIO (no budget instruction) ==="
echo "Started: $(date -u)"
echo ""

for trial in 1 2 3 4 5; do
  echo "--- Trial $trial ---"
  OUTFILE="$RESULTS_DIR/trial-${trial}.json"
  
  # Run gym scenario - baseline arm (no injected context)
  bash /app/agents/test/gym/run-gym.sh "$SCENARIO" --agent coder --tag "$TAG" --json > "$OUTFILE" 2>&1 || true
  
  echo "Trial $trial complete. Output: $OUTFILE"
  echo ""
done

echo "=== All 5 baseline trials complete ==="
echo "Results in: $RESULTS_DIR/"
echo "Finished: $(date -u)"
