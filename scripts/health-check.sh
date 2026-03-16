#!/bin/bash
# Health check script: runs tsc type checking.
#
# vitest intentionally removed — spawns 15+ worker processes consuming
# >1GB RAM each. Workers survive process timeouts as orphans and
# accumulate until the container is OOM killed. Test suite validation
# belongs in CI or explicit QA review, not automated health checks.
#
# Usage: bash scripts/health-check.sh

set -o pipefail

TIMEOUT=${1:-120}

echo "=== HEALTH CHECK ==="
echo ""

# --- TypeScript compilation ---
echo "--- tsc --noEmit ---"
tsc_output=$(timeout ${TIMEOUT}s npx tsc --noEmit 2>&1)
tsc_exit=$?
if [ $tsc_exit -eq 124 ]; then
  echo "⚠️ tsc: TIMEOUT (>${TIMEOUT}s)"
  tsc_exit=1
fi
if [ $tsc_exit -eq 0 ]; then
  echo "✅ tsc: PASS (no type errors)"
else
  echo "❌ tsc: FAIL (exit $tsc_exit)"
  echo "$tsc_output" | tail -20
fi
echo ""

# --- Verdict ---
echo "=== VERDICT ==="
if [ $tsc_exit -eq 0 ]; then
  echo "✅ BUILD HEALTHY"
  exit 0
else
  echo "❌ BUILD UNHEALTHY"
  echo "  - tsc failed"
  exit 1
fi
