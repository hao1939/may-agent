#!/bin/bash
# Convention Compliance Regression Guard
# Run all 9 convention gym scenarios and fail if score < 88%
#
# Usage: bash workspace/regression-guard.sh [--threshold 88]
#
set -euo pipefail

THRESHOLD=${1:-88}
AGENTS_ROOT="${AGENTS_ROOT:-/app/agents}"
RUN_GYM="$AGENTS_ROOT/test/gym/run-gym.sh"

SCENARIOS=(
  convention-verify-edit
  convention-verify-edit-fewshot
  convention-verify-edit-workflow
  convention-verify-edit-verify-wrap
  convention-verify-multi-edit
  convention-verify-multi-edit-workflow
  convention-safe-append
  convention-promise-report
  convention-retry-pivot
)

PASS=0
TOTAL=0
RESULTS=""

for scenario in "${SCENARIOS[@]}"; do
  echo "=== $scenario ===" >&2
  output=$(bash "$RUN_GYM" "$scenario" --timeout 10 2>&1) || true
  
  # Parse checks from JSON output
  scenario_pass=$(echo "$output" | grep -oP '"passed":\s*(true|false)' | grep -c 'true' || echo 0)
  scenario_total=$(echo "$output" | grep -oP '"passed":\s*(true|false)' | wc -l || echo 0)
  
  # If no JSON found, try the summary line
  if [ "$scenario_total" -eq 0 ]; then
    scenario_pass=$(echo "$output" | grep -oP '\d+(?=/\d+ checks passed)' | head -1 || echo 0)
    scenario_total=$(echo "$output" | grep -oP '(?<=/)(\d+)(?= checks passed)' | head -1 || echo 0)
  fi
  
  PASS=$((PASS + scenario_pass))
  TOTAL=$((TOTAL + scenario_total))
  RESULTS="$RESULTS\n$scenario: $scenario_pass/$scenario_total"
  echo "$scenario: $scenario_pass/$scenario_total" >&2
done

if [ "$TOTAL" -eq 0 ]; then
  echo "ERROR: No checks found. Gym may not be running." >&2
  exit 1
fi

RATE=$((PASS * 100 / TOTAL))
echo ""
echo "=== CONVENTION COMPLIANCE REGRESSION ==="
echo -e "$RESULTS"
echo ""
echo "Total: $PASS/$TOTAL = $RATE%"
echo "Threshold: $THRESHOLD%"

if [ "$RATE" -ge "$THRESHOLD" ]; then
  echo "✅ PASS: Above threshold"
  exit 0
else
  echo "❌ REGRESSION: Below $THRESHOLD% threshold"
  exit 1
fi
