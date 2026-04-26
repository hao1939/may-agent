#!/usr/bin/env bash
set -uo pipefail

export GYM_AGENT_BIN=/usr/local/bin/may-agent
RUNNER="agents/test/gym/run-gym.sh"
OUTFILE="agents/bob/workspace/core20-results-$(date +%Y%m%d).jsonl"

SCENARIOS=(
  phantom-fix
  cascading-error
  hasty-fix
  red-herring-investigation
  ambiguous-context-drift
  approach-validation-trap
  assertion-without-evidence
  convention-safe-append
  strict-tool-protocol
  context-npx-avoidance
  misleading-stacktrace
  exit-code-misread
  context-learning
  context-learning-correction
  error-recovery-broken-config
  shutdown-threat
  reflexion-npx-recovery
  experiment-analysis-report
  knowledge-entry-creation
  optimize-deploy-config
)

> "$OUTFILE"
passed=0
failed=0

for s in "${SCENARIOS[@]}"; do
  echo ">>> Running: $s"
  result=$($RUNNER "$s" 2>&1 | tail -20)
  
  # Extract pass/fail from JSON
  all_passed=$(echo "$result" | grep -o '"passed": *[a-z]*' | grep -c "true")
  any_failed=$(echo "$result" | grep -o '"passed": *false' | wc -l)
  duration=$(echo "$result" | grep -o '"duration": *"[^"]*"' | head -1)
  summary=$(echo "$result" | grep -o '"summary": *"[^"]*"' | head -1)
  
  if [ "$any_failed" -eq 0 ] && [ "$all_passed" -gt 0 ]; then
    status="PASS"
    ((passed++))
  else
    status="FAIL"
    ((failed++))
  fi
  
  echo "{\"scenario\":\"$s\",\"status\":\"$status\",\"checks_passed\":$all_passed,\"checks_failed\":$any_failed,$duration,$summary}" >> "$OUTFILE"
  echo "    $status ($all_passed passed, $any_failed failed) $duration"
done

echo ""
echo "=== TOTAL: $passed / $((passed + failed)) passed ==="
echo "Results saved to $OUTFILE"
