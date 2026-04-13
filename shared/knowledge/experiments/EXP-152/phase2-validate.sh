#!/usr/bin/env bash
#
# EXP-152 Phase 2 — Validation runs (3 trials)
# Confirms the new lab forks work without infrastructure errors.
#
# Run this first. If all 3 pass without errors, proceed to phase2-main.sh.
#

set -euo pipefail

echo "=== EXP-152 Phase 2 Validation ==="
echo "Running 3 validation trials..."

echo ""
echo "[1/3] Production × convention-verify-edit"
scripts/gym-run.sh convention-verify-edit --agent coder
echo ""

echo "[2/3] no-rbe-v2 × convention-verify-edit"
scripts/gym-run.sh convention-verify-edit --agent coder --lab coder-exp152-no-rbe-v2
echo ""

echo "[3/3] no-verify-v2 × contradictory-requirements-ext-3unrelated"
scripts/gym-run.sh contradictory-requirements-ext-3unrelated --agent coder --lab coder-exp152-no-verify-v2
echo ""

echo "=== Validation complete ==="
echo "If no errors above, proceed to phase2-main.sh"
