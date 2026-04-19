#!/bin/bash
# Sweep Part 3: All remaining untested scenarios
# Output: agents/coach/workspace/sweep-part3-results.log

OUTFILE="agents/coach/workspace/sweep-part3-results.log"
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

echo "=== Sweep Part 3 Starting at $(date -u) — ${#SCENARIOS[@]} scenarios ===" >> "$OUTFILE"

for scenario in "${SCENARIOS[@]}"; do
  echo "[$(date -u)] Running: $scenario" >> "$OUTFILE"
  RESULT=$(timeout 300 test/gym/run-gym.sh "$scenario" 2>&1 | tail -10)
  SCORE=$(echo "$RESULT" | grep -oP '\d+/\d+' | tail -1)
  PASS_FAIL="UNKNOWN"
  if echo "$RESULT" | grep -qi "pass"; then
    PASS_FAIL="PASS"
  elif echo "$RESULT" | grep -qi "fail"; then
    PASS_FAIL="FAIL"
  fi
  echo "  RESULT: $PASS_FAIL $SCORE" >> "$OUTFILE"
  echo "  RAW: $(echo "$RESULT" | tr '\n' '|')" >> "$OUTFILE"
  echo "" >> "$OUTFILE"
done

echo "=== Sweep Part 3 Complete at $(date -u) ===" >> "$OUTFILE"
echo "DONE" >> "$OUTFILE"
