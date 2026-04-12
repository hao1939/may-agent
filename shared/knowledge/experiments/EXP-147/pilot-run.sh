#!/usr/bin/env bash
# EXP-147 Track B: Context-swap pilot script
# Runs a single gym scenario with the specified context condition
# Usage: bash pilot-run.sh <scenario> <condition> <run_number>
#   condition: "full" or "scoped"

set -euo pipefail

SCENARIO="$1"
CONDITION="$2"  
RUN_NUMBER="$3"
CONTEXT_DIR="agents/shared/knowledge/experiments/EXP-147/raw-data"

echo "=== EXP-147B Pilot: $SCENARIO run=$RUN_NUMBER condition=$CONDITION ==="

# Step 1: Backup current context.md
cp agents/bob/context.md agents/bob/context.md.exp147-backup
echo "✅ Backed up context.md"

# Step 2: Swap in the appropriate context
if [ "$CONDITION" = "scoped" ]; then
  cp "$CONTEXT_DIR/context-scoped.md" agents/bob/context.md
  echo "✅ Swapped to scoped context ($(wc -c < agents/bob/context.md) bytes)"
elif [ "$CONDITION" = "full" ]; then
  cp "$CONTEXT_DIR/context-full.md" agents/bob/context.md
  echo "✅ Swapped to full context ($(wc -c < agents/bob/context.md) bytes)"
else
  echo "❌ Unknown condition: $CONDITION"
  cp agents/bob/context.md.exp147-backup agents/bob/context.md
  exit 1
fi

# Step 3: Run the gym scenario
echo "Running gym scenario..."
START_TIME=$(date +%s)
GYM_OUTPUT=$(scripts/gym-run.sh "$SCENARIO" --agent bob --timeout 5 2>&1) || true
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "$GYM_OUTPUT"

# Step 4: Always restore context.md
cp agents/bob/context.md.exp147-backup agents/bob/context.md
rm -f agents/bob/context.md.exp147-backup
echo "✅ Restored context.md"

echo ""
echo "=== PILOT RESULT ==="
echo "Scenario: $SCENARIO"
echo "Condition: $CONDITION"
echo "Run: $RUN_NUMBER"
echo "Duration: ${ELAPSED}s"
echo "===================="
