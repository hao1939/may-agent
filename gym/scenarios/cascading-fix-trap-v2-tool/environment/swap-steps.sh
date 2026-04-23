#!/bin/bash
# swap-steps.sh — Swap two adjacent pipeline steps and run tests
#
# Usage: ./swap-steps.sh <step1_function> <step2_function>
#
# This tool swaps the order of two function calls in src/pipeline.js
# and runs the test suite to see if the swap improves or worsens results.
# After showing results, it reverts the swap automatically.
#
# Example: ./swap-steps.sh normalize applyPenalties
#   → Swaps normalize() and applyPenalties() calls, runs tests, reverts

set -e

if [ $# -ne 2 ]; then
  echo "Usage: ./swap-steps.sh <step1_function> <step2_function>"
  echo "Example: ./swap-steps.sh normalize applyPenalties"
  exit 1
fi

STEP1="$1"
STEP2="$2"
PIPELINE="src/pipeline.js"

if [ ! -f "$PIPELINE" ]; then
  echo "Error: $PIPELINE not found"
  exit 1
fi

# Backup
cp "$PIPELINE" "$PIPELINE.bak"

echo "=== Swapping $STEP1 and $STEP2 in pipeline ==="

# Find the lines containing the two function calls
LINE1=$(grep -n "$STEP1(" "$PIPELINE" | grep -v "require\|//\|function\|module" | head -1 | cut -d: -f1)
LINE2=$(grep -n "$STEP2(" "$PIPELINE" | grep -v "require\|//\|function\|module" | head -1 | cut -d: -f1)

if [ -z "$LINE1" ] || [ -z "$LINE2" ]; then
  echo "Error: Could not find both function calls in pipeline"
  cp "$PIPELINE.bak" "$PIPELINE"
  rm "$PIPELINE.bak"
  exit 1
fi

echo "Found $STEP1 at line $LINE1, $STEP2 at line $LINE2"

# Extract the full statement blocks (line + any continuation)
CONTENT1=$(sed -n "${LINE1}p" "$PIPELINE")
CONTENT2=$(sed -n "${LINE2}p" "$PIPELINE")

echo "Swapping:"
echo "  Line $LINE1: $CONTENT1"
echo "  Line $LINE2: $CONTENT2"

# Perform the swap using sed
sed -i "${LINE1}s/.*/${CONTENT2}/" "$PIPELINE"
sed -i "${LINE2}s/.*/${CONTENT1}/" "$PIPELINE"

echo ""
echo "=== Running tests with swapped order ==="
echo ""
node test/test.js 2>&1 || true

echo ""
echo "=== Reverting swap ==="
cp "$PIPELINE.bak" "$PIPELINE"
rm "$PIPELINE.bak"
echo "Pipeline restored to original state."
