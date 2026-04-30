#!/bin/bash
# Project Health CLI — combines all health utilities into one report
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "╔══════════════════════════════════════════╗"
echo "║        SYSTEM HEALTH REPORT              ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 1. Test Suite
echo "┌─── TEST SUITE ───────────────────────────┐"
if bash "$SCRIPT_DIR/test-guard.sh" > /tmp/test-guard-out.txt 2>&1; then
  TESTS_OK=true
  echo "  ✅ All tests passing"
else
  TESTS_OK=false
  echo "  ❌ Tests failing!"
fi
grep -E "Files|Tests" /tmp/test-guard-out.txt 2>/dev/null | sed 's/^/  /' || true
echo ""

# 2. Satellite Projects
echo "┌─── SATELLITE PROJECTS ───────────────────┐"
if [ -f "$SCRIPT_DIR/health-check.sh" ]; then
  bash "$SCRIPT_DIR/health-check.sh" 2>/dev/null | sed 's/^/  /' || echo "  (health-check unavailable)"
else
  echo "  (health-check.sh not found)"
fi
echo ""

# 3. Config Validation
echo "┌─── CONFIG VALIDATION ────────────────────┐"
PROJECTS_DIR="$SHARED_DIR/projects"
CONFIG_ERRORS=0
for proj_dir in "$PROJECTS_DIR"/*/; do
  [ -d "$proj_dir" ] || continue
  proj_name=$(basename "$proj_dir")
  proj_md="$proj_dir/project.md"
  if [ -f "$proj_md" ]; then
    RESULT=$(cd "$SHARED_DIR" && node --loader ts-node/esm -e "
      import { validateProjectConfig } from './lib/config-validator.js';
      import { readFileSync } from 'fs';
      const content = readFileSync('$proj_md', 'utf-8');
      const r = validateProjectConfig(content);
      if (!r.valid) { console.log('FAIL:' + r.errors.join('; ')); process.exit(1); }
      else if (r.warnings.length) { console.log('WARN:' + r.warnings.join('; ')); }
      else { console.log('OK'); }
    " 2>/dev/null || echo "SKIP")
    if [[ "$RESULT" == FAIL* ]]; then
      echo "  ❌ $proj_name: ${RESULT#FAIL:}"
      CONFIG_ERRORS=$((CONFIG_ERRORS + 1))
    elif [[ "$RESULT" == WARN* ]]; then
      echo "  ⚠️  $proj_name: ${RESULT#WARN:}"
    elif [[ "$RESULT" == "OK" ]]; then
      echo "  ✅ $proj_name"
    else
      echo "  ⏭️  $proj_name (skipped)"
    fi
  fi
done
echo ""

# 4. Iteration Metrics
echo "┌─── ITERATION METRICS ────────────────────┐"
LOG_FILE="$SHARED_DIR/.state/iteration-log.json"
if [ -f "$LOG_FILE" ]; then
  node -e "
    const data = require('$LOG_FILE');
    const entries = Array.isArray(data) ? data : [];
    const total = entries.length;
    const delivered = entries.filter(e => e.deliverableProduced).length;
    const firstAttempt = entries.filter(e => e.firstAttempt).length;
    const rate = total ? (delivered/total*100).toFixed(0) : 'N/A';
    const faRate = total ? (firstAttempt/total*100).toFixed(0) : 'N/A';
    console.log('  Iterations logged: ' + total);
    console.log('  Deliverable rate:  ' + rate + '%');
    console.log('  First-attempt rate: ' + faRate + '%');
  " 2>/dev/null || echo "  (no iteration data)"
else
  echo "  (no iteration log found)"
fi
echo ""

# 5. Summary
echo "┌─── SUMMARY ──────────────────────────────┐"
if [ "$TESTS_OK" = true ] && [ "$CONFIG_ERRORS" -eq 0 ]; then
  echo "  🟢 SYSTEM HEALTHY"
  EXIT_CODE=0
elif [ "$TESTS_OK" = true ]; then
  echo "  🟡 SYSTEM OK (config warnings)"
  EXIT_CODE=0
else
  echo "  🔴 SYSTEM UNHEALTHY"
  EXIT_CODE=1
fi
echo ""
exit $EXIT_CODE
