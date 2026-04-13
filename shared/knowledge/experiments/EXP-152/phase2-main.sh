#!/usr/bin/env bash
#
# EXP-152 Phase 2 — Main experiment (110 trials)
#
# Tests H-108: Does removing verify-after-edit.md skill degrade performance
# on verification-sensitive scenarios?
#
# Design: 2 conditions × 2 scenarios + 1 control
#   Production (all skills) vs no-verify-after-edit (skill removed)
#   Scenarios: convention-verify-edit, contradictory-requirements-ext-3unrelated
#   Control: cascading-error
#
# NOTE: Phase 2 validation revealed that context.md is NOT injected into the
# system prompt. The originally-planned no-rbe-v2 and no-verify-v2 forks
# produce IDENTICAL prompts (hash 7142d869c737). We use no-rbe-v2 as the
# single "skill removed" condition for both scenarios. This simplifies the
# design to a clean 2-condition comparison.
#
# Sequential stopping: After N=10 per cell, check for early stop.
#   p<0.01 → strong evidence, continue to confirm
#   p>0.50 → futility, consider stopping
#
# Usage: bash agents/shared/knowledge/experiments/EXP-152/phase2-main.sh
#

set -euo pipefail

echo "=== EXP-152 Phase 2 — Full Run ==="
echo "Total planned: 110 trials"
echo "Start: $(date -u)"
echo ""

# ── Block 1: N=10 per cell ──────────────────────────────────────────────

echo "=== Block 1: First 10 per cell (60 trials) ==="

for i in $(seq 1 10); do
  echo ""
  echo "--- Round $i/10 ---"

  # Cell 1: Production × convention-verify-edit
  echo "  [${i}a] Production × convention-verify-edit"
  scripts/gym-run.sh convention-verify-edit --agent coder || true

  # Cell 2: no-rbe-v2 × convention-verify-edit
  echo "  [${i}b] no-rbe-v2 × convention-verify-edit"
  scripts/gym-run.sh convention-verify-edit --agent coder --lab coder-exp152-no-rbe-v2 || true

  # Cell 3: Production × contradictory-requirements-ext-3unrelated
  echo "  [${i}c] Production × contradictory-req"
  scripts/gym-run.sh contradictory-requirements-ext-3unrelated --agent coder || true

  # Cell 4: no-rbe-v2 × contradictory-requirements-ext-3unrelated
  echo "  [${i}d] no-rbe-v2 × contradictory-req"
  scripts/gym-run.sh contradictory-requirements-ext-3unrelated --agent coder --lab coder-exp152-no-rbe-v2 || true

  # Control cells (every other round for first 10)
  if (( i % 2 == 0 )); then
    echo "  [${i}e] Production × cascading-error (control)"
    scripts/gym-run.sh cascading-error --agent coder || true

    echo "  [${i}f] no-rbe-v2 × cascading-error (control)"
    scripts/gym-run.sh cascading-error --agent coder --lab coder-exp152-no-rbe-v2 || true
  fi

done

echo ""
echo "=== Block 1 complete. Pause for interim analysis. ==="
echo "Run interim analysis, then proceed to Block 2 if warranted."
echo ""

# ── Block 2: N=11-20 per cell ───────────────────────────────────────────

echo "=== Block 2: Trials 11-20 per cell (50 more trials) ==="

for i in $(seq 11 20); do
  echo ""
  echo "--- Round $i/20 ---"

  # Cell 1: Production × convention-verify-edit
  echo "  [${i}a] Production × convention-verify-edit"
  scripts/gym-run.sh convention-verify-edit --agent coder || true

  # Cell 2: no-rbe-v2 × convention-verify-edit
  echo "  [${i}b] no-rbe-v2 × convention-verify-edit"
  scripts/gym-run.sh convention-verify-edit --agent coder --lab coder-exp152-no-rbe-v2 || true

  # Cell 3: Production × contradictory-requirements-ext-3unrelated
  echo "  [${i}c] Production × contradictory-req"
  scripts/gym-run.sh contradictory-requirements-ext-3unrelated --agent coder || true

  # Cell 4: no-rbe-v2 × contradictory-requirements-ext-3unrelated
  echo "  [${i}d] no-rbe-v2 × contradictory-req"
  scripts/gym-run.sh contradictory-requirements-ext-3unrelated --agent coder --lab coder-exp152-no-rbe-v2 || true

  # Control cells (every other round)
  if (( i % 2 == 0 )); then
    echo "  [${i}e] Production × cascading-error (control)"
    scripts/gym-run.sh cascading-error --agent coder || true

    echo "  [${i}f] no-rbe-v2 × cascading-error (control)"
    scripts/gym-run.sh cascading-error --agent coder --lab coder-exp152-no-rbe-v2 || true
  fi

done

echo ""
echo "=== EXP-152 Phase 2 complete ==="
echo "End: $(date -u)"
echo ""
echo "Total trials expected: 110"
echo "  convention-verify-edit: 20 production + 20 no-rbe-v2 = 40"
echo "  contradictory-req:      20 production + 20 no-rbe-v2 = 40"
echo "  cascading-error:        10 production + 10 no-rbe-v2 = 20"
echo "  Already-run validation: 1 + 1 + 1 = 3 (in DB already)"
echo ""
echo "Query results:"
echo "  SELECT scenario, lab_fork, COUNT(*), SUM(passed), AVG(passed)"
echo "  FROM gym_runs WHERE scenario IN (...) GROUP BY scenario, lab_fork"
