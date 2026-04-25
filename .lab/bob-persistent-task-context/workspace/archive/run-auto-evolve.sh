#!/bin/bash
set -e

# Configuration
AGENT="coder"
BASELINE_SOUL="agents/$AGENT/SOUL.md"
VARIATIONS_DIR="agents/coach/workspace/auto-evolve/variations"
OUTPUT_FILE="agents/bob/workspace/auto-evolve-results.md"
mkdir -p agents/bob/workspace

echo "# Auto-Evolve Results: $AGENT" > "$OUTPUT_FILE"
echo "Date: $(date)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| Variation | Pass Rate | Time | Status |" >> "$OUTPUT_FILE"
echo "|-----------|-----------|------|--------|" >> "$OUTPUT_FILE"

# Backup original
cp "$BASELINE_SOUL" "$BASELINE_SOUL.original"

cleanup() {
  cp "$BASELINE_SOUL.original" "$BASELINE_SOUL"
  rm "$BASELINE_SOUL.original"
}
trap cleanup EXIT

# Run baseline first
echo "Running baseline..."
echo -n "| Baseline | " >> "$OUTPUT_FILE"
# Run smoke tier (fastest) - assuming scripts/gym-baseline.sh exists and works as described
# Redirect stderr to stdout to catch the output
RESULT=$(scripts/gym-baseline.sh --tier smoke --agent "$AGENT" 2>&1 | tail -1)
echo "$RESULT" | awk -F'|' '{print $2 " | " $3 " | " $4 " |"}' >> "$OUTPUT_FILE"

# Loop through variations
for v in "$VARIATIONS_DIR"/*.md; do
  name=$(basename "$v" .md)
  echo "Testing variation: $name"
  
  # Apply variation
  cp "$v" "$BASELINE_SOUL"
  
  # Run gym
  echo -n "| $name | " >> "$OUTPUT_FILE"
  RESULT=$(scripts/gym-baseline.sh --tier smoke --agent "$AGENT" 2>&1 | tail -1)
  echo "$RESULT" | awk -F'|' '{print $2 " | " $3 " | " $4 " |"}' >> "$OUTPUT_FILE"
  
  # Cool down slightly to let system settle
  sleep 2
done

echo "" >> "$OUTPUT_FILE"
echo "Done. Restoring original SOUL."
