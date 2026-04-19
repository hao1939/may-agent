#!/bin/bash
# Sweep Part 3 (FIXED): Re-run scenarios that got UNKNOWN results
# Uses --run-all with specific scenario list so results go to DB
# Also properly captures passed field from JSON output
#
# Output: agents/coach/workspace/sweep-part3-fixed-results.log

OUTFILE="agents/coach/workspace/sweep-part3-fixed-results.log"
> "$OUTFILE"

SCENARIOS=(
  red-herring-log
  regression-from-fix
  regression-from-fix-workflow
  request-triage-memoization
  scope-creep-multifile
  scope-creep-resistance
  scope-creep-resistance-workflow
  scope-creep-trap
  search-strategy-escalation
  shutdown-threat
  silent-dependency
  skip-verification
  skip-verification-open
  skip-verification-phased
  skip-verification-workflow
  spec-adherence-multi-step
  stale-approach-fixation
  stale-approach-fixation-workflow
  strict-tool-protocol
  sycophants-dilemma
  sycophants-dilemma-workflow
  sycophants-dilemma-workflow-strict
  tool-confusion-recovery
  verification-contradiction
  verification-contradiction-workflow
  verify-before-finish
  verify-before-finish-workflow
  verify-checksum-trap
  verify-claimed-fix
  verify-semantic-not-syntactic
  wrong-directory
  wrong-tool-args
  wrong-tool-args-workflow
)

echo "=== Sweep Part 3 (FIXED) Starting at $(date -u) — ${#SCENARIOS[@]} scenarios ===" >> "$OUTFILE"

for scenario in "${SCENARIOS[@]}"; do
  echo "[$(date -u)] Running: $scenario" >> "$OUTFILE"
  # Capture FULL output, not just tail
  RAW=$(timeout 300 test/gym/run-gym.sh "$scenario" 2>&1)
  EXIT_CODE=$?
  # Extract passed field from JSON
  PASSED=$(echo "$RAW" | grep -oP '"passed"\s*:\s*(true|false)' | head -1 | grep -oP 'true|false')
  # Extract score summary
  SUMMARY=$(echo "$RAW" | grep -oP '"score_summary"\s*:\s*"[^"]*"' | head -1 | sed 's/"score_summary":\s*//;s/^"//;s/"$//')
  
  if [ "$PASSED" = "true" ]; then
    RESULT="PASS"
  elif [ "$PASSED" = "false" ]; then
    RESULT="FAIL"
  else
    RESULT="UNKNOWN (exit=$EXIT_CODE)"
  fi
  
  echo "  RESULT: $RESULT" >> "$OUTFILE"
  echo "  SUMMARY: $SUMMARY" >> "$OUTFILE"
  echo "" >> "$OUTFILE"
done

echo "=== Sweep Part 3 (FIXED) Complete at $(date -u) ===" >> "$OUTFILE"
echo "DONE" >> "$OUTFILE"
