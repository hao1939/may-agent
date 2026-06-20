#!/usr/bin/env bash
# check-active-projects.sh — Detect active projects and output persistent-task commands
# Called from heartbeat Step 1 to surface active work automatically.

AGENT_NAME="${1:-bob}"
PROJECTS_DIR="agents/${AGENT_NAME}/workspace/projects"

if [ ! -d "$PROJECTS_DIR" ]; then
  exit 0
fi

active_found=0
for f in "$PROJECTS_DIR"/*.md; do
  [ -f "$f" ] || continue
  if grep -qi "^[*]*Status[*]*:.*active" "$f" 2>/dev/null; then
    if [ $active_found -eq 0 ]; then
      echo ""
      echo "╔══════════════════════════════════════════════════════════════╗"
      echo "║  ACTIVE PROJECTS — Resume with persistent-task workflow     ║"
      echo "╚══════════════════════════════════════════════════════════════╝"
      active_found=1
    fi
    project_name=$(basename "$f")
    goal=$(grep -i "^## Goal" "$f" -A 1 | tail -1 | head -c 80)
    echo "  → $f"
    echo "    Goal: $goal"
    echo "    Run:  workflow.run(\"persistent-task\", \"project: $f\\nagent: ${AGENT_NAME}\\ngoal: ${goal}\")"
    echo ""
  fi
done

if [ $active_found -gt 0 ]; then
  echo "⚠️  Resume active projects before starting new work."
fi
