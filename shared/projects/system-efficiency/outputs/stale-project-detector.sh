#!/bin/bash
# Finds projects with no file modifications in the last 7 days
echo "=== Stale Project Detector ==="
echo "Projects with no activity in 7+ days:"
find /app/agents/shared/projects -name "project.md" -mtime +7 -exec dirname {} \;
echo "---"
echo "Active projects (modified within 7 days):"
find /app/agents/shared/projects -name "project.md" -mtime -7 -exec dirname {} \;
