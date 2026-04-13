#!/usr/bin/env bash
#
# EXP-152 Phase 2 — Main experiment (110 trials)
#
# PREREQUISITE: The lab fork overlay bug was fixed in test/gym/gym-runner.ts
# (commit: bob: fix lab fork overlay bug — cpSync merges, must rmSync subdirs first)
# Verify fix is present before running: grep -c "rmSync.*agentTarget.*entry.name" test/gym/gym-runner.ts
# Should return 1.
#
# Trial matrix (from phase2-design.md §5):
#   20 × Production × convention-verify-edit          (edit-heavy baseline)
#   20 × no-rbe-v2 × convention-verify-edit           (edit-heavy, guard removed)
#   20 × Production × contradictory-req-ext-3unrelated (verify-heavy baseline)
#   20 × no-verify-v2 × contradictory-req-ext-3unrelated (verify-heavy, guard removed)
#   10 × Production × cascading-error                  (control)
#   10 × no-rbe-v2 × cascading-error                   (control)
#   10 × no-verify-v2 × cascading-error                (control)
#
# Total: 110 trials, ~$11 estimated cost
#
# Sequential stopping rule (§5):
#   After block 2 (N=10 per cell), check interim results.
#   Stop early if p<0.01 (strong signal) or p>0.50 (futility).
#
# Usage:
#   bash agents/shared/knowledge/experiments/EXP-152/phase2-main.sh [--block N]
#   Default: run all 4 blocks
#   --block 1: run first block only (N=5 per cell, 35 trials)
#   --block 2: run second block only (N=5 per cell, 35 trials) — interim check after this
#   --block 3: run third block (N=5 per cell, 30 trials — no more control)
#   --block 4: run fourth block (N=5 per cell, 30 trials — no more control)
#

set -euo pipefail

BLOCK="${1:-all}"
if [ "$BLOCK" = "--block" ]; then
  BLOCK="${2:-all}"
fi

# Verify the overlay fix is present
FIX_COUNT=$(grep -c "rmSync.*agentTarget.*entry.name" test/gym/gym-runner.ts 2>/dev/null || echo "0")
if [ "$FIX_COUNT" -lt 1 ]; then
  echo "ERROR: Lab fork overlay fix not found in test/gym/gym-runner.ts"
  echo "The fix ensures cpSync doesn't merge directories. Apply the fix first."
  exit 1
fi

echo "=== EXP-152 Phase 2 — Main Experiment ==="
echo "Overlay fix verified: OK"
echo ""

run_block() {
  local BLOCK_NUM=$1
  local BLOCK_SIZE_MAIN=5
  local BLOCK_SIZE_CTRL=5
  
  # Control trials only in blocks 1-2 (to reach N=10)
  local RUN_CONTROL=false
  if [ "$BLOCK_NUM" -le 2 ]; then
    RUN_CONTROL=true
  fi
  
  echo "--- Block $BLOCK_NUM ---"
  
  for i in $(seq 1 $BLOCK_SIZE_MAIN); do
    echo "[Block $BLOCK_NUM, Trial $i/$BLOCK_SIZE_MAIN]"
    
    # Production × convention-verify-edit
    echo "  Production × convention-verify-edit"
    scripts/gym-run.sh convention-verify-edit --agent coder 2>&1 | grep -E '"passed"|recorded' || true
    
    # no-rbe-v2 × convention-verify-edit
    echo "  no-rbe-v2 × convention-verify-edit"
    scripts/gym-run.sh convention-verify-edit --agent coder --lab coder-exp152-no-rbe-v2 2>&1 | grep -E '"passed"|recorded' || true
    
    # Production × contradictory-requirements-ext-3unrelated
    echo "  Production × contradictory-req-ext-3unrelated"
    scripts/gym-run.sh contradictory-requirements-ext-3unrelated --agent coder 2>&1 | grep -E '"passed"|recorded' || true
    
    # no-verify-v2 × contradictory-requirements-ext-3unrelated
    echo "  no-verify-v2 × contradictory-req-ext-3unrelated"
    scripts/gym-run.sh contradictory-requirements-ext-3unrelated --agent coder --lab coder-exp152-no-verify-v2 2>&1 | grep -E '"passed"|recorded' || true
    
    # Control trials (only blocks 1-2)
    if [ "$RUN_CONTROL" = true ]; then
      echo "  Production × cascading-error (control)"
      scripts/gym-run.sh cascading-error --agent coder 2>&1 | grep -E '"passed"|recorded' || true
      
      echo "  no-rbe-v2 × cascading-error (control)"
      scripts/gym-run.sh cascading-error --agent coder --lab coder-exp152-no-rbe-v2 2>&1 | grep -E '"passed"|recorded' || true
      
      echo "  no-verify-v2 × cascading-error (control)"
      scripts/gym-run.sh cascading-error --agent coder --lab coder-exp152-no-verify-v2 2>&1 | grep -E '"passed"|recorded' || true
    fi
    
    echo ""
  done
  
  echo "--- Block $BLOCK_NUM complete ---"
  echo ""
}

if [ "$BLOCK" = "all" ]; then
  for b in 1 2 3 4; do
    run_block $b
    if [ "$b" -eq 2 ]; then
      echo "==============================="
      echo "INTERIM CHECK POINT — N=10 per cell"
      echo "Check results before continuing to blocks 3-4."
      echo "Query: SELECT lab_fork, scenario, COUNT(*), SUM(passed), AVG(passed) FROM gym_runs WHERE scenario IN ('convention-verify-edit','contradictory-requirements-ext-3unrelated','cascading-error') AND prompt_hash != '46ffe2beb315' OR lab_fork IS NULL GROUP BY lab_fork, scenario"
      echo "==============================="
      echo ""
    fi
  done
elif [ "$BLOCK" -ge 1 ] && [ "$BLOCK" -le 4 ]; then
  run_block "$BLOCK"
else
  echo "Usage: $0 [--block 1|2|3|4]"
  exit 1
fi

echo "=== EXP-152 Phase 2 complete ==="
echo "Run analysis: see phase2-design.md §6 for error recurrence analysis procedure"
