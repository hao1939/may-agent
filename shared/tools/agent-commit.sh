#!/usr/bin/env bash
# agent-commit.sh — Commit changes in the agents/ submodule repo.
# Usage: agent-commit.sh "commit message"
# Can be run from anywhere — always operates on /app/agents/

set -euo pipefail

AGENTS_DIR="/app/agents"

if [ $# -eq 0 ] || [ -z "$1" ]; then
  echo "ERROR: commit message required"
  echo "Usage: agent-commit.sh \"commit message\""
  exit 1
fi

MSG="$1"

cd "$AGENTS_DIR"

# Check if there are any changes to commit
if git diff --quiet HEAD && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "Nothing to commit in agents/ — working tree clean."
  exit 0
fi

git add -A

# After staging, verify there's actually something to commit
if git diff --cached --quiet; then
  echo "Nothing to commit in agents/ — working tree clean."
  exit 0
fi

git commit -m "$MSG"
echo "Committed to agents/ repo: $MSG"
