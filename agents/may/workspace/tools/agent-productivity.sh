#!/bin/bash
# Agent Productivity Script — Commits-per-Session by Agent
# Re-runnable. Outputs results to stdout and optionally to a snapshot file.
#
# Usage:
#   ./agent-productivity.sh                    # stdout only
#   ./agent-productivity.sh --snapshot         # also write to audits/agent-productivity-snapshot.md
#
# Requires: node, better-sqlite3, git (agents/ repo)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="/app"
AGENTS_DIR="$PROJECT_ROOT/agents"
DB_PATH="$PROJECT_ROOT/.state/may.db"
SNAPSHOT_DIR="$SCRIPT_DIR/../audits"

export PATH="$PROJECT_ROOT/.state/.bun/bin:$PATH"

if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: may.db not found at $DB_PATH" >&2
  exit 1
fi

# Run the analysis
OUTPUT=$(node "$SCRIPT_DIR/agent-productivity.cjs" "$DB_PATH" "$AGENTS_DIR")

echo "$OUTPUT"

# Optionally write snapshot
if [[ "${1:-}" == "--snapshot" ]]; then
  mkdir -p "$SNAPSHOT_DIR"
  SNAPSHOT_FILE="$SNAPSHOT_DIR/agent-productivity-snapshot.md"
  echo "$OUTPUT" > "$SNAPSHOT_FILE"
  echo ""
  echo "📄 Snapshot written to: $SNAPSHOT_FILE"
fi
