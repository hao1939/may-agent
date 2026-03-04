#!/bin/bash
# Exercise 1 staging: Plant an off-by-one bug in overflow.ts
# Bug: redactArgs uses key instead of key.toLowerCase() for comparison,
# so uppercase keys like "API_KEY" leak through redaction.
#
# Also plants a test that catches this bug.
#
# Usage: bash exercise-1-stage.sh
# Cleanup: bash exercise-1-stage.sh --cleanup

set -euo pipefail

PROJECT_ROOT="/home/hao/may-agent"
BACKUP_DIR="$PROJECT_ROOT/.state/coaching/exercise-backups/ex1"

if [[ "${1:-}" == "--cleanup" ]]; then
  echo "Restoring original files..."
  if [[ -f "$BACKUP_DIR/overflow.ts" ]]; then
    cp "$BACKUP_DIR/overflow.ts" "$PROJECT_ROOT/src/overflow.ts"
  fi
  if [[ -f "$BACKUP_DIR/overflow.test.ts" ]]; then
    cp "$BACKUP_DIR/overflow.test.ts" "$PROJECT_ROOT/test/overflow.test.ts"
  fi
  rm -rf "$BACKUP_DIR"
  echo "Exercise 1 cleanup complete."
  exit 0
fi

echo "Staging Exercise 1: planted bug in overflow.ts..."

# Backup originals
mkdir -p "$BACKUP_DIR"
cp "$PROJECT_ROOT/src/overflow.ts" "$BACKUP_DIR/overflow.ts"
cp "$PROJECT_ROOT/test/overflow.test.ts" "$BACKUP_DIR/overflow.test.ts"

# Plant the bug: change key.toLowerCase() to key in redactArgs
# Original: if (REDACT_KEYS.has(key.toLowerCase())) {
# Bugged:   if (REDACT_KEYS.has(key)) {
sed -i 's/REDACT_KEYS\.has(key\.toLowerCase())/REDACT_KEYS.has(key)/' "$PROJECT_ROOT/src/overflow.ts"

# Add a test that catches the bug (uppercase key leaking through)
cat >> "$PROJECT_ROOT/test/overflow.test.ts" << 'TESTEOF'

describe("redactArgs case sensitivity", () => {
  it("redacts uppercase key variants in extractProgress", () => {
    const messages: any[] = [
      { role: "assistant", content: [
        { type: "toolCall", name: "exec", arguments: {
          command: "deploy",
          API_KEY: "sk-leaked-123",
          Token: "bearer-leaked",
          path: "/safe",
        }},
      ]},
    ];
    const result = extractProgress("task", messages, "overflow");
    expect(result).not.toContain("sk-leaked-123");
    expect(result).not.toContain("bearer-leaked");
    expect(result).toContain("[REDACTED]");
    expect(result).toContain("/safe");
  });
});
TESTEOF

echo "Exercise 1 staged. Bug planted in src/overflow.ts, test added to test/overflow.test.ts."
echo "To verify: npx vitest --run test/overflow.test.ts"
echo "Expected: test should FAIL (uppercase keys leak through redaction)"
