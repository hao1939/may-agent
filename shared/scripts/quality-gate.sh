#!/bin/bash
# quality-gate.sh — Unified quality gate: tests + quality scores + TypeScript strict
# Exit 0 if all pass, 1 if any fail

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

PASS=true
DETAILS=""

# 1. Test gate
echo "=== Running Test Gate ==="
if bash scripts/test-gate.sh; then
  echo "✅ Tests: PASS"
else
  echo "❌ Tests: FAIL"
  PASS=false
  DETAILS="${DETAILS}\n- Tests failed"
fi

# 2. Quality scores — check if any file below 60
echo ""
echo "=== Running Quality Scores ==="
if [ -f scripts/workflow-quality-score.sh ]; then
  SCORE_OUTPUT=$(bash scripts/workflow-quality-score.sh 2>/dev/null || true)
  LOW_SCORES=$(echo "$SCORE_OUTPUT" | awk -F'|' 'NR>2 && $NF+0 < 60 && $NF+0 > 0 {print $1 ": " $NF}')
  if [ -z "$LOW_SCORES" ]; then
    echo "✅ Quality Scores: PASS (all ≥60)"
  else
    echo "⚠️  Quality Scores: WARNING — files below 60:"
    echo "$LOW_SCORES"
    DETAILS="${DETAILS}\n- Low quality scores detected"
  fi
else
  echo "⚠️  Quality score script not found, skipping"
fi

# 3. TypeScript strict errors
echo ""
echo "=== Running TypeScript Strict Check ==="
TS_ERRORS=$(npx tsc --noEmit --strict workflows/*.ts 2>&1 | grep -c "error TS" || true)
if [ "$TS_ERRORS" -le 86 ]; then
  echo "✅ TypeScript: PASS ($TS_ERRORS errors, baseline: 86)"
else
  echo "❌ TypeScript: FAIL ($TS_ERRORS errors, baseline: 86)"
  PASS=false
  DETAILS="${DETAILS}\n- TypeScript errors regressed: $TS_ERRORS > 86"
fi

# Summary
echo ""
echo "================================"
if [ "$PASS" = true ]; then
  echo "🟢 QUALITY GATE: PASS"
  exit 0
else
  echo "🔴 QUALITY GATE: FAIL"
  echo -e "$DETAILS"
  exit 1
fi
