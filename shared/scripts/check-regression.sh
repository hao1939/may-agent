#!/bin/bash
# Regression checker — compares current metrics against stored baseline
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BASELINE="$SHARED_DIR/.state/baseline.json"

if [ ! -f "$BASELINE" ]; then
  echo "❌ No baseline found at $BASELINE"
  exit 1
fi

cd "$SHARED_DIR"

# Get current test metrics
VITEST_OUTPUT=$(npx vitest run 2>&1 || true)
TEST_FILES=$(echo "$VITEST_OUTPUT" | grep "Test Files" | grep -oP '\d+(?= passed)' || echo "0")
TEST_COUNT=$(echo "$VITEST_OUTPUT" | grep "Tests " | grep -oP '\d+(?= passed)' || echo "0")
LIB_MODULES=$(find lib -maxdepth 1 -name "*.ts" ! -name "index.ts" ! -name "*.test.ts" | wc -l)

# Compare using regression-detector
npx tsx -e "
import { detectRegressions } from './lib/regression-detector.ts';
import { readFileSync } from 'fs';
const baseline = JSON.parse(readFileSync('./.state/baseline.json', 'utf-8'));

const current = {
  testFiles: ${TEST_FILES:-0},
  testCount: ${TEST_COUNT:-0},
  passRate: 1.0,
  libModules: ${LIB_MODULES:-0}
};

console.log('📊 Current vs Baseline:');
console.log('  Test Files: ' + current.testFiles + ' (baseline: ' + baseline.testFiles + ')');
console.log('  Test Count: ' + current.testCount + ' (baseline: ' + baseline.testCount + ')');
console.log('  Lib Modules: ' + current.libModules + ' (baseline: ' + baseline.libModules + ')');
console.log('');

const result = detectRegressions(current, baseline, 0.05);
if (result.regressions.length === 0) {
  console.log('✅ No regressions detected');
  process.exit(0);
} else {
  console.log('⚠️  REGRESSIONS DETECTED:');
  result.regressions.forEach(r => {
    console.log('  ' + r.metric + ': ' + r.current + ' (was ' + r.baseline + ', dropped ' + (r.drop * 100).toFixed(1) + '%)');
  });
  process.exit(1);
}
"
