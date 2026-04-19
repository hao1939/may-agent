#!/bin/bash
# auto-evolve-test.sh — Run SOUL.md variations through gym smoke tier
# Usage: bash agents/coach/workspace/auto-evolve/auto-evolve-test.sh coder
#
# Saves original SOUL.md, tests each variation, restores original.
# Output: agents/coach/workspace/auto-evolve/results.md

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

AGENT="${1:-coder}"
BASELINE_SOUL="$PROJECT_ROOT/agents/$AGENT/SOUL.md"
VARIATIONS_DIR="$SCRIPT_DIR/variations"
RESULTS_FILE="$SCRIPT_DIR/results.md"

# Only test our new variations (v01-v05 with descriptive names)
VARIATION_PATTERN="v0[1-5]-*.md"

# Ensure bun
for _bun_dir in "$PROJECT_ROOT/.state/.bun/bin" "$HOME/.bun/bin"; do
  [ -x "$_bun_dir/bun" ] && { export PATH="$_bun_dir:$PATH"; break; }
done

# Safety: backup original
cp "$BASELINE_SOUL" "$BASELINE_SOUL.auto-evolve-backup"
echo "Backed up original SOUL.md to $BASELINE_SOUL.auto-evolve-backup"

# Count variations
VARIATIONS=($(ls $VARIATIONS_DIR/$VARIATION_PATTERN 2>/dev/null))
echo "Found ${#VARIATIONS[@]} variations to test"
echo ""

# Header for results
cat > "$RESULTS_FILE" << 'EOF'
# Auto-Evolve Results — Coder SOUL.md Variations

## Baseline (current SOUL.md)

| Scenario | Result |
|----------|--------|
EOF

# Run baseline first
echo "=== Running BASELINE ==="
BASELINE_OUTPUT=$(bash "$PROJECT_ROOT/scripts/gym-baseline.sh" --tier smoke --agent "$AGENT" 2>&1) || true
echo "$BASELINE_OUTPUT" | tail -5
echo ""

# Parse baseline results
BASELINE_PASS=$(echo "$BASELINE_OUTPUT" | grep -c "PASS" || echo "0")
BASELINE_FAIL=$(echo "$BASELINE_OUTPUT" | grep -c "FAIL" || echo "0")
BASELINE_TOTAL=$((BASELINE_PASS + BASELINE_FAIL))
echo "Baseline: $BASELINE_PASS/$BASELINE_TOTAL passed" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

# Capture baseline per-scenario results
echo "$BASELINE_OUTPUT" | grep -E "(PASS|FAIL)" >> "$RESULTS_FILE" || true
echo "" >> "$RESULTS_FILE"

# Test each variation
echo "## Variations" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

for v in "${VARIATIONS[@]}"; do
  name=$(basename "$v" .md)
  echo "=== Testing: $name ==="
  
  # Swap SOUL.md
  cp "$v" "$BASELINE_SOUL"
  
  # Run gym
  OUTPUT=$(bash "$PROJECT_ROOT/scripts/gym-baseline.sh" --tier smoke --agent "$AGENT" 2>&1) || true
  
  # Parse results
  V_PASS=$(echo "$OUTPUT" | grep -c "PASS" || echo "0")
  V_FAIL=$(echo "$OUTPUT" | grep -c "FAIL" || echo "0")
  V_TOTAL=$((V_PASS + V_FAIL))
  
  echo "### $name" >> "$RESULTS_FILE"
  echo "Pass rate: $V_PASS/$V_TOTAL (delta: $((V_PASS - BASELINE_PASS)) vs baseline)" >> "$RESULTS_FILE"
  echo '```' >> "$RESULTS_FILE"
  echo "$OUTPUT" | grep -E "(PASS|FAIL)" >> "$RESULTS_FILE" || true
  echo '```' >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"
  
  echo "  Result: $V_PASS/$V_TOTAL (delta: $((V_PASS - BASELINE_PASS)))"
  echo ""
done

# Restore original
cp "$BASELINE_SOUL.auto-evolve-backup" "$BASELINE_SOUL"
echo "Restored original SOUL.md"
echo ""
echo "Results written to: $RESULTS_FILE"
