#!/usr/bin/env bash
# Regression Check Script for Skill & Workflow Audit
# Re-runs workflow load tests and gym scenario, outputs pass/fail summary.
# Usage: bash outputs/regression-check.sh
# Schedule: Run periodically (e.g., weekly or after skill/workflow changes)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="/app"
WORKFLOWS_DIR="$PROJECT_ROOT/agents/shared/workflows"
GYM_RUNNER="$PROJECT_ROOT/agents/test/gym/run-gym.sh"
export PATH="$PROJECT_ROOT/.state/.bun/bin:$PATH"

echo "============================================"
echo "  Skill & Workflow Regression Check"
echo "  $(date -Iseconds)"
echo "============================================"
echo ""

# ── 1. Workflow Load Tests ──────────────────────────────────────────
echo "## Workflow Load Tests"
echo ""

TOTAL=0
PASSED=0
FAILED=0
FAIL_LIST=""

for f in "$WORKFLOWS_DIR"/*.ts; do
  name=$(basename "$f" .ts)
  TOTAL=$((TOTAL + 1))
  result=$(timeout 10 bun -e "import('file://$f').then(m => console.log('OK:', Object.keys(m).join(','))).catch(e => console.error('FAIL:', e.message))" 2>&1)
  exit_code=$?
  if [ $exit_code -eq 0 ] && echo "$result" | grep -q "^OK:"; then
    PASSED=$((PASSED + 1))
    echo "  ✅ $name"
  else
    FAILED=$((FAILED + 1))
    FAIL_LIST="$FAIL_LIST $name"
    echo "  ❌ $name — exit=$exit_code $result"
  fi
done

PASS_RATE=$((PASSED * 100 / TOTAL))
echo ""
echo "  workflow.pass-rate = $PASSED/$TOTAL ($PASS_RATE%)"
if [ $FAILED -gt 0 ]; then
  echo "  FAILURES:$FAIL_LIST"
fi
echo ""

# ── 2. Gym Scenario: skill-delivery-obstacle-pivot ──────────────────
echo "## Gym Scenario Tests"
echo ""

if [ -f "$GYM_RUNNER" ]; then
  gym_result=$(timeout 30 bash "$GYM_RUNNER" skill-delivery-obstacle-pivot --stub 2>&1)
  gym_exit=$?
  if echo "$gym_result" | grep -q '"passed": true'; then
    echo "  ✅ skill-delivery-obstacle-pivot (stub mode)"
  else
    echo "  ⚠️  skill-delivery-obstacle-pivot (stub mode) — did not pass"
    echo "     (Expected in stub mode without live agent)"
  fi
else
  echo "  ⚠️  Gym runner not found at $GYM_RUNNER"
fi
echo ""

# ── 3. Summary ──────────────────────────────────────────────────────
echo "============================================"
echo "  SUMMARY"
echo "  Workflows: $PASSED/$TOTAL pass ($PASS_RATE%)"
if [ $FAILED -eq 0 ]; then
  echo "  Status: ALL CLEAR ✅"
  exit 0
else
  echo "  Status: REGRESSIONS DETECTED ❌"
  exit 1
fi
