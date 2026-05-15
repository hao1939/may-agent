#!/usr/bin/env bash
# System Dashboard — single-command health overview
set -euo pipefail

cd "$(dirname "$0")/.."

echo "╔══════════════════════════════════════════╗"
echo "║         SYSTEM HEALTH DASHBOARD          ║"
echo "╠══════════════════════════════════════════╣"
echo ""

# Test metrics
echo "┌─ TEST SUITE ─────────────────────────────"
TEST_OUTPUT=$(cd /app && bun run test 2>&1 || true)
FILES_LINE=$(echo "$TEST_OUTPUT" | grep -E "across [0-9]+ files?" || echo "Test files unknown")
TESTS_LINE=$(echo "$TEST_OUTPUT" | grep -E "[0-9]+ pass" | head -1 || echo "Tests unknown")
echo "│ $FILES_LINE"
echo "│ $TESTS_LINE"
echo ""

# Satellite projects
echo "┌─ SATELLITE PROJECTS ─────────────────────"
for proj_dir in projects/*/; do
  [ -d "$proj_dir" ] || continue
  proj_name=$(basename "$proj_dir")
  [ "$proj_name" = "outputs" ] && continue
  status="unknown"
  if [ -f "$proj_dir/project.md" ]; then
    status=$(grep -i "^status:" "$proj_dir/project.md" | head -1 | sed 's/^[Ss]tatus:\s*//' || echo "unknown")
    [ -z "$status" ] && status=$(grep -i "status" "$proj_dir/project.md" | head -1 | cut -d: -f2- | xargs || echo "unknown")
  fi
  printf "│ %-25s %s\n" "$proj_name" "$status"
done
echo ""

# Lessons/memory
echo "┌─ KNOWLEDGE BASE ──────────────────────────"
LESSON_COUNT=0
if [ -d ".state" ]; then
  LESSON_COUNT=$(find .state -name "*.md" -exec grep -c "^-\|^\*" {} + 2>/dev/null | awk -F: '{s+=$NF}END{print s+0}')
fi
MEMORY_COUNT=0
if [ -d "memory" ]; then
  MEMORY_COUNT=$(find memory -type f | wc -l | xargs)
fi
echo "│ Lessons/items in .state: $LESSON_COUNT"
echo "│ Memory files: $MEMORY_COUNT"
echo ""

# Deliverables
echo "┌─ DELIVERABLES ────────────────────────────"
DELIV_COUNT=$(find projects -mindepth 2 -maxdepth 2 -type d -name outputs 2>/dev/null | while read -r d; do find "$d" -type f; done | wc -l | xargs)
echo "│ Files in project-scoped outputs/: $DELIV_COUNT"
echo ""

echo "╚══════════════════════════════════════════╝"
echo "Dashboard generated at $(date -Iseconds)"
