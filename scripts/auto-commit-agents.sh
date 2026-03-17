#!/bin/bash
# auto-commit-agents.sh — Auto-commit agents/ sub-repo changes
# Registered as a May cron job (10-minute interval)
# Prevents data loss from uncommitted agent config/workspace changes

set -euo pipefail

AGENTS_DIR="$(dirname "$0")/../agents"

# Resolve to absolute path
AGENTS_DIR="$(cd "$AGENTS_DIR" && pwd)"

# Verify it's a git repo
if [ ! -d "$AGENTS_DIR/.git" ]; then
  echo "ERROR: $AGENTS_DIR is not a git repo"
  exit 1
fi

cd "$AGENTS_DIR"

# Check for changes (tracked + untracked)
if [ -z "$(git status --porcelain)" ]; then
  # Nothing to commit
  exit 0
fi

# Stage all changes
git add -A

# Build commit message from changed file summary
CHANGED=$(git diff --cached --stat | tail -1)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

git commit -m "auto: ${CHANGED}" -m "Timestamp: ${TIMESTAMP}" --no-verify

echo "[auto-commit-agents] Committed: ${CHANGED}"
