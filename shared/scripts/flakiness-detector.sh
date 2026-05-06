#!/bin/bash
# Flakiness Detector - runs test suite 3 times and flags inconsistent results
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "=== Flakiness Detector ==="
echo "Running test suite 3 times to detect flaky tests..."

for i in 1 2 3; do
  echo "Run $i/3..."
  npx vitest run 2>&1 | grep -E "^\s*(✓|×|FAIL)" > "/tmp/vitest_run_${i}.txt" || true
  npx vitest run 2>&1 | grep -E "Test Files" > "/tmp/vitest_summary_${i}.txt" || true
done

# Compare results
FLAKY=0
echo ""
echo "=== Results ==="

# Extract pass/fail per file from each run
for i in 1 2 3; do
  npx vitest run 2>&1 | tee "/tmp/vitest_full_${i}.txt" | grep -E "FAIL|PASS" | grep -oP "tests/\S+" | sort > "/tmp/vitest_files_${i}.txt" || true
done

# Actually let's just run 3 times and compare exit codes and file lists
RESULTS=""
for i in 1 2 3; do
  if npx vitest run > "/tmp/vitest_full_${i}.txt" 2>&1; then
    RESULTS="${RESULTS}0"
  else
    RESULTS="${RESULTS}1"
  fi
  grep "FAIL" "/tmp/vitest_full_${i}.txt" | grep -oP "\S+\.test\.\S+" | sort > "/tmp/vitest_fails_${i}.txt" || true
done

# Check if fail lists differ
if diff -q /tmp/vitest_fails_1.txt /tmp/vitest_fails_2.txt > /dev/null 2>&1 && \
   diff -q /tmp/vitest_fails_2.txt /tmp/vitest_fails_3.txt > /dev/null 2>&1; then
  echo "NO FLAKY TESTS DETECTED (3 runs consistent)"
  echo "Exit codes: $RESULTS"
  exit 0
else
  echo "⚠️ FLAKY TESTS DETECTED:"
  comm -3 /tmp/vitest_fails_1.txt /tmp/vitest_fails_2.txt 2>/dev/null | sed 's/^/  FLAKY: /'
  comm -3 /tmp/vitest_fails_2.txt /tmp/vitest_fails_3.txt 2>/dev/null | sed 's/^/  FLAKY: /'
  exit 1
fi
