#!/bin/bash
# Full Gym Infrastructure Sweep
# Runs every scenario's success_criteria.js and classifies:
#   HEALTHY - criteria exist, some/all checks fail (needs agent work)
#   PRE_SOLVED - criteria exist, all checks pass (no training signal)
#   BROKEN - criteria crash or produce no output
#   NO_CRITERIA - no success_criteria.js found
#
# Usage: bash gym-full-sweep.sh [output_file]
# Output: TSV report + summary stats

set -euo pipefail

OUTPUT="${1:-/app/agents/shared/projects/outputs/gym-sweep-report.tsv}"
SCENARIOS_DIR="/app/agents/gym/scenarios"
TIMEOUT=30

echo -e "scenario\tstatus\tpassed\tfailed\ttotal\tnotes" > "$OUTPUT"

HEALTHY=0
PRE_SOLVED=0
BROKEN=0
NO_CRITERIA=0
TOTAL=0

for scenario_dir in "$SCENARIOS_DIR"/*/; do
  name=$(basename "$scenario_dir")
  
  # Skip variant directories (contain "-workflow", "-nudge" suffix with a base scenario)
  # Include all for completeness
  
  criteria="$scenario_dir/success_criteria.js"
  TOTAL=$((TOTAL + 1))
  
  if [ ! -f "$criteria" ]; then
    echo -e "$name\tNO_CRITERIA\t0\t0\t0\tNo success_criteria.js" >> "$OUTPUT"
    NO_CRITERIA=$((NO_CRITERIA + 1))
    continue
  fi
  
  # Run criteria with timeout
  result=$(cd "$scenario_dir" && timeout "$TIMEOUT" node success_criteria.js 2>&1) || true
  
  # Check if output contains any JSON with "passed" field
  if ! echo "$result" | grep -q '"passed"'; then
    note=$(echo "$result" | head -1 | tr '\t\n' '  ' | cut -c1-80)
    echo -e "$name\tBROKEN\t0\t0\t0\t$note" >> "$OUTPUT"
    BROKEN=$((BROKEN + 1))
    continue
  fi
  
  # Count passed/failed from individual check objects
  passed=$(echo "$result" | grep -c '"passed": *true' || true)
  failed=$(echo "$result" | grep -c '"passed": *false' || true)
  total_checks=$((passed + failed))
  
  # The last "passed" line is the overall verdict
  overall=$(echo "$result" | grep '"passed"' | tail -1)
  if echo "$overall" | grep -q 'true'; then
    echo -e "$name\tPRE_SOLVED\t$passed\t$failed\t$total_checks\tAll checks pass without agent" >> "$OUTPUT"
    PRE_SOLVED=$((PRE_SOLVED + 1))
  else
    echo -e "$name\tHEALTHY\t$passed\t$failed\t$total_checks\t" >> "$OUTPUT"
    HEALTHY=$((HEALTHY + 1))
  fi
  
done

echo ""
echo "=== GYM INFRASTRUCTURE SWEEP ==="
echo "Total scenarios: $TOTAL"
echo "  HEALTHY:      $HEALTHY ($(( HEALTHY * 100 / TOTAL ))%)"
echo "  PRE_SOLVED:   $PRE_SOLVED ($(( PRE_SOLVED * 100 / TOTAL ))%)"
echo "  BROKEN:       $BROKEN ($(( BROKEN * 100 / TOTAL ))%)"
echo "  NO_CRITERIA:  $NO_CRITERIA ($(( NO_CRITERIA * 100 / TOTAL ))%)"
echo ""
echo "Report: $OUTPUT"
