#!/usr/bin/env bash
# Auto-evolve Step 2: Run all variations against their target scenarios
# Saves results to agents/coach/workspace/auto-evolve/results/
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
VARIATIONS_DIR="$SCRIPT_DIR/variations"
BACKUP="$SCRIPT_DIR/SOUL.md.backup"

mkdir -p "$RESULTS_DIR"

# Backup original SOUL.md
cp "$PROJECT_ROOT/agents/coder/SOUL.md" "$BACKUP"
echo "=== Original SOUL.md backed up ==="

# Define test matrix: variation -> scenarios
# v01 targets behavior-escalation-stubborn
# v02 targets conflicting-evidence
# v03 targets convention-verify-edit
# v04 targets all 3
# v05 targets behavior-escalation-stubborn

declare -A VARIATION_FILES
VARIATION_FILES[v01]="v01-escalation-awareness.md"
VARIATION_FILES[v02]="v02-multi-source-reconciliation.md"
VARIATION_FILES[v03]="v03-explicit-json-validation.md"
VARIATION_FILES[v04]="v04-combined-escalation-and-config.md"
VARIATION_FILES[v05]="v05-act-dont-ask-reframe.md"

declare -A VARIATION_SCENARIOS
VARIATION_SCENARIOS[v01]="behavior-escalation-stubborn"
VARIATION_SCENARIOS[v02]="conflicting-evidence"
VARIATION_SCENARIOS[v03]="convention-verify-edit"
VARIATION_SCENARIOS[v04]="behavior-escalation-stubborn conflicting-evidence convention-verify-edit"
VARIATION_SCENARIOS[v05]="behavior-escalation-stubborn"

# Also run baseline on all 3 scenarios
echo ""
echo "=========================================="
echo "BASELINE RUNS"
echo "=========================================="
for scenario in behavior-escalation-stubborn conflicting-evidence convention-verify-edit; do
  echo ""
  echo "--- Baseline: $scenario ---"
  OUTFILE="$RESULTS_DIR/baseline-${scenario}.json"
  "$PROJECT_ROOT/scripts/gym-run.sh" "$scenario" --agent coder 2>&1 | tee "$RESULTS_DIR/baseline-${scenario}.log"
  # Extract summary line
  grep -o '"summary": "[^"]*"' "$RESULTS_DIR/baseline-${scenario}.log" > "$RESULTS_DIR/baseline-${scenario}.summary" 2>/dev/null || true
  echo ""
  echo "--- Baseline $scenario complete ---"
done

# Run each variation against its target scenarios
for var in v01 v02 v03 v04 v05; do
  VARFILE="${VARIATION_FILES[$var]}"
  SCENARIOS="${VARIATION_SCENARIOS[$var]}"
  
  echo ""
  echo "=========================================="
  echo "VARIATION: $var ($VARFILE)"
  echo "=========================================="
  
  # Swap SOUL.md
  cp "$VARIATIONS_DIR/$VARFILE" "$PROJECT_ROOT/agents/coder/SOUL.md"
  echo "Installed $VARFILE as agents/coder/SOUL.md"
  
  for scenario in $SCENARIOS; do
    echo ""
    echo "--- $var: $scenario ---"
    "$PROJECT_ROOT/scripts/gym-run.sh" "$scenario" --agent coder 2>&1 | tee "$RESULTS_DIR/${var}-${scenario}.log"
    grep -o '"summary": "[^"]*"' "$RESULTS_DIR/${var}-${scenario}.log" > "$RESULTS_DIR/${var}-${scenario}.summary" 2>/dev/null || true
    echo ""
    echo "--- $var $scenario complete ---"
  done
done

# Restore original SOUL.md
cp "$BACKUP" "$PROJECT_ROOT/agents/coder/SOUL.md"
echo ""
echo "=========================================="
echo "ORIGINAL SOUL.md RESTORED"
echo "=========================================="

# Generate summary
echo ""
echo "=========================================="
echo "RESULTS SUMMARY"
echo "=========================================="
for f in "$RESULTS_DIR"/*.summary; do
  name=$(basename "$f" .summary)
  content=$(cat "$f" 2>/dev/null || echo "(no summary)")
  echo "$name: $content"
done

echo ""
echo "All tests complete. Results in $RESULTS_DIR/"
