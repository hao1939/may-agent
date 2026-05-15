#!/bin/bash
# Op-Budget Compliance Check
# Queries sessions from last N hours and checks agent op counts against known budgets.
#
# Usage:
#   ./op-budget-check.sh                    # stdout only, last 6h
#   ./op-budget-check.sh --snapshot         # also write to audits/op-budget-snapshot.md
#   ./op-budget-check.sh --hours 12         # custom window
#   ./op-budget-check.sh --hours 12 --snapshot

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="/app"
DB_PATH="$PROJECT_ROOT/.state/may.db"
SNAPSHOT_DIR="$SCRIPT_DIR/../audits"

export PATH="$PROJECT_ROOT/.state/.bun/bin:$PATH"

if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: may.db not found at $DB_PATH" >&2
  exit 1
fi

# Parse args
HOURS=6
SNAPSHOT=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --snapshot) SNAPSHOT=true; shift ;;
    --hours) HOURS="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

OUTPUT=$(node "$SCRIPT_DIR/op-budget-check.cjs" "$DB_PATH" "$HOURS")

echo "$OUTPUT"

if [ "$SNAPSHOT" = true ]; then
  mkdir -p "$SNAPSHOT_DIR"
  SNAPSHOT_FILE="$SNAPSHOT_DIR/op-budget-snapshot.md"
  echo "$OUTPUT" > "$SNAPSHOT_FILE"
  echo ""
  echo "📄 Snapshot written to: $SNAPSHOT_FILE"
fi
