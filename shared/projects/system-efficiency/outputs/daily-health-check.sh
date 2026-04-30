#!/bin/bash
# Daily Health Check — combines stale project detection + test regression check
# Run from any directory. Outputs timestamped pass/fail summary.

set -euo pipefail

SHARED_DIR="/app/agents/shared"
PROJECTS_DIR="$SHARED_DIR/projects"
TEST_THRESHOLD=80

echo "============================================"
echo "  DAILY HEALTH CHECK"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""

# --- Section 1: Stale Project Detection ---
echo "--- Stale Projects (no activity in 7+ days) ---"
STALE=$(find "$PROJECTS_DIR" -name "project.md" -mtime +7 -exec dirname {} \; 2>/dev/null | wc -l)
if [ "$STALE" -gt 0 ]; then
  find "$PROJECTS_DIR" -name "project.md" -mtime +7 -exec dirname {} \; 2>/dev/null
  echo "⚠️  $STALE stale project(s) found"
else
  echo "✅ No stale projects"
fi
echo ""

echo "--- Active Projects (modified within 7 days) ---"
find "$PROJECTS_DIR" -name "project.md" -mtime -7 -exec dirname {} \; 2>/dev/null || true
echo ""

# --- Section 2: Test File Count ---
echo "--- Test Suite Health ---"
TEST_COUNT=$(find "$SHARED_DIR" -name "*.test.ts" 2>/dev/null | wc -l)
echo "Test files found: $TEST_COUNT (threshold: $TEST_THRESHOLD)"
if [ "$TEST_COUNT" -lt "$TEST_THRESHOLD" ]; then
  echo "❌ FAIL: Test file count ($TEST_COUNT) below threshold ($TEST_THRESHOLD)"
  TEST_STATUS=1
else
  echo "✅ PASS: Test file count above threshold"
  TEST_STATUS=0
fi
echo ""

# --- Section 3: Summary ---
echo "============================================"
echo "  SUMMARY"
echo "============================================"
OVERALL=0
if [ "$STALE" -gt 2 ]; then
  echo "⚠️  Many stale projects — consider closing or reviving"
  OVERALL=1
fi
if [ "$TEST_STATUS" -ne 0 ]; then
  echo "❌ Test regression detected"
  OVERALL=1
fi
if [ "$OVERALL" -eq 0 ]; then
  echo "✅ All checks passed"
fi
echo "============================================"
exit $OVERALL
