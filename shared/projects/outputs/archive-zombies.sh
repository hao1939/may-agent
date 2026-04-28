#!/bin/bash
# Archive Zombie Projects — Clean up project-health-state.json
# Removes all entries pointing to non-existent files and rebuilds with live projects only.
# Created: 2026-04-28

set -e

STATE_FILE=".state/project-health-state.json"
BACKUP_FILE=".state/project-health-state.json.bak.$(date +%s)"

echo "=== Zombie Project Cleanup ==="
echo ""

# Backup
cp "$STATE_FILE" "$BACKUP_FILE"
echo "Backed up to: $BACKUP_FILE"

# Run cleanup
python3 << 'PYTHON'
import json, os

state = json.load(open(".state/project-health-state.json"))
projects = state.get("projects", {})

removed = []
kept = []

for path, data in list(projects.items()):
    if not os.path.exists(path):
        removed.append((path, data.get("consecutiveSkips", 0)))
        del projects[path]
    else:
        kept.append((path, data.get("consecutiveSkips", 0)))

# Also add real projects that exist but aren't tracked
real_projects_dir = "agents/shared/projects"
for name in os.listdir(real_projects_dir):
    proj_path = f"{real_projects_dir}/{name}"
    proj_md = f"{proj_path}/project.md"
    if name.startswith("_") or name == "outputs" or not os.path.isdir(proj_path):
        continue
    if not os.path.exists(proj_md):
        continue
    # Check if already tracked (under any path variant)
    already_tracked = any(name in p for p in projects)
    if not already_tracked:
        projects[proj_path] = {
            "lastLaunch": 0,
            "lastEscalation": 0,
            "reactivationAttempts": 0,
            "consecutiveSkips": 0,
            "blockerHash": "0"
        }
        kept.append((proj_path, 0))
        print(f"  ADDED: {proj_path}")

state["projects"] = projects

with open(".state/project-health-state.json", "w") as f:
    json.dump(state, f, indent=2)

print(f"\nRemoved {len(removed)} stale entries:")
for path, skips in sorted(removed, key=lambda x: -x[1]):
    print(f"  skips={skips:>3} {path}")

print(f"\nKept/added {len(kept)} live entries:")
for path, skips in sorted(kept, key=lambda x: -x[1]):
    print(f"  skips={skips:>3} {path}")

print(f"\nDone. Health state now tracks {len(projects)} projects.")
PYTHON
