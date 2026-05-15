#!/usr/bin/env bash
# EXP-222 Arm B: Run gym with selective skills only
# Strategy: temporarily move non-essential shared skills to a backup dir

set -euo pipefail

SCENARIO="${1:-sql-injection-in-query-builder}"
SKILLS_DIR="/app/agents/shared/skills"
BACKUP_DIR="/tmp/exp222-skills-backup"

# Skills to KEEP for code-quality tasks (per H-EXP-024 mapping)
KEEP_SKILLS=(
  "README.md"
  "LIBRARY.md"
  "coder-edit-discipline"
  "file-safety"
  "verification"
  "tool-discipline"
  "error-handling"
)

cleanup() {
  echo "Restoring skills..."
  if [ -d "$BACKUP_DIR" ]; then
    cp -r "$BACKUP_DIR"/* "$SKILLS_DIR/" 2>/dev/null || true
    rm -rf "$BACKUP_DIR"
  fi
  echo "Skills restored."
}
trap cleanup EXIT

# Backup and remove non-essential skills
mkdir -p "$BACKUP_DIR"
for item in "$SKILLS_DIR"/*; do
  base=$(basename "$item")
  keep=false
  for k in "${KEEP_SKILLS[@]}"; do
    if [ "$base" = "$k" ]; then
      keep=true
      break
    fi
  done
  if [ "$keep" = false ]; then
    mv "$item" "$BACKUP_DIR/"
  fi
done

echo "Skills remaining: $(ls "$SKILLS_DIR" | wc -l)"
ls "$SKILLS_DIR"
echo "---"

# Run gym
GYM_AGENT_BIN=/usr/local/bin/may-agent bash agents/test/gym/run-gym.sh "$SCENARIO" --agent coder --timeout 3 2>&1

echo "---"
# cleanup happens via trap
