#!/bin/bash
# new-project.sh — Create a new project from template
# Usage: new-project.sh <name> <goal> <owner>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECTS_DIR="$SCRIPT_DIR/../projects"

if [ $# -lt 3 ]; then
  echo "Usage: $0 <name> <goal> <owner>"
  echo "  name:  Project directory name (kebab-case)"
  echo "  goal:  One-line project goal"
  echo "  owner: Owner agent or person"
  exit 1
fi

NAME="$1"
GOAL="$2"
OWNER="$3"
TARGET_DIR="$PROJECTS_DIR/$NAME"

if [ -d "$TARGET_DIR" ]; then
  echo "ERROR: Project '$NAME' already exists at $TARGET_DIR"
  exit 1
fi

mkdir -p "$TARGET_DIR"

npx tsx -e "
import { generateProject } from '$SCRIPT_DIR/../lib/project-template.ts';
const result = generateProject({
  name: '$NAME',
  goal: '$GOAL',
  metrics: [{ name: 'completion', target: '100%' }],
  owner: '$OWNER'
});
process.stdout.write(result.projectMd);
" > "$TARGET_DIR/project.md"

if [ $? -eq 0 ] && [ -f "$TARGET_DIR/project.md" ]; then
  echo "✅ Project created: $TARGET_DIR/project.md"
  echo ""
  cat "$TARGET_DIR/project.md"
else
  echo "❌ Failed to create project"
  rm -rf "$TARGET_DIR"
  exit 1
fi
