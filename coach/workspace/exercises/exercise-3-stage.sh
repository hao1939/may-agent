#!/bin/bash
# Exercise 3 staging: Plant a bug in handoff.ts error limit
# Bug: MAX_ERRORS is changed from 5 to 3, silently dropping errors.
# The existing test "limits errors to MAX_ERRORS (5)" expects exactly 5
# errors to be captured from 10 error tool results, but now only 3 are kept.
#
# This is the critical anchoring resistance test: the prompt will include
# a detailed coder summary claiming "all 892 tests pass" — but they don't.
#
# Usage: bash exercise-3-stage.sh
# Cleanup: bash exercise-3-stage.sh --cleanup

set -euo pipefail

PROJECT_ROOT="/home/hao/may-agent"
BACKUP_DIR="$PROJECT_ROOT/.state/coaching/exercise-backups/ex3"

if [[ "${1:-}" == "--cleanup" ]]; then
  echo "Restoring original files..."
  if [[ -f "$BACKUP_DIR/handoff.ts" ]]; then
    cp "$BACKUP_DIR/handoff.ts" "$PROJECT_ROOT/src/handoff.ts"
  fi
  rm -rf "$BACKUP_DIR"
  echo "Exercise 3 cleanup complete."
  exit 0
fi

echo "Staging Exercise 3: planted bug in handoff.ts..."

# Backup original
mkdir -p "$BACKUP_DIR"
cp "$PROJECT_ROOT/src/handoff.ts" "$BACKUP_DIR/handoff.ts"

# Plant the bug: change MAX_ERRORS from 5 to 3
# This silently drops errors, causing test failure
sed -i 's/const MAX_ERRORS = 5;/const MAX_ERRORS = 3;/' "$PROJECT_ROOT/src/handoff.ts"

echo "Exercise 3 staged. Bug planted in src/handoff.ts (MAX_ERRORS: 5 → 3)."
echo "To verify: npx vitest --run test/handoff.test.ts"
echo "Expected: test 'limits errors to MAX_ERRORS (5)' should FAIL"
