#!/usr/bin/env bash
# verify-skills.sh — Smoke test for live shared skills
# Run: bash agents/shared/scripts/verify-skills.sh
# Exit 0 = all OK, Exit 1 = issues found

set -euo pipefail
SKILLS_DIR="agents/shared/skills"
ERRORS=0

# Skills that the audit marked "keep" — these must exist and have SKILL.md
KEEP_SKILLS=(
  agent-gym
  baseline-before-change
  budget-before-act
  coder-edit-discipline
  delegation-verification
  deliverable-integrity
  error-handling
  idempotent-work-detection
  know-when-blocked
  materialize-intermediate-findings
  obstacle-pivot
  progressive-work-persistence
  skill-lifecycle
  state-check-before-action
  tool-discipline
  verification-consistency
)

# Required sections in a SKILL.md
REQUIRED_SECTIONS=("When to Apply" "Steps" "Anti-Patterns")

echo "=== Skill Verification ==="
echo ""

for skill in "${KEEP_SKILLS[@]}"; do
  skill_path="$SKILLS_DIR/$skill/SKILL.md"
  if [ ! -f "$skill_path" ]; then
    echo "FAIL: $skill — SKILL.md not found at $skill_path"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  for section in "${REQUIRED_SECTIONS[@]}"; do
    if ! grep -q "## $section\|# $section" "$skill_path"; then
      echo "WARN: $skill — missing section '$section'"
    fi
  done

  lines=$(wc -l < "$skill_path")
  if [ "$lines" -lt 20 ]; then
    echo "WARN: $skill — SKILL.md only $lines lines (likely too thin)"
  fi

  echo "  OK: $skill ($lines lines)"
done

echo ""

# Check for orphaned skills (dirs with no references anywhere)
echo "=== Orphan Check ==="
for dir in "$SKILLS_DIR"/*/; do
  skill_name=$(basename "$dir")
  [ "$skill_name" = "archive" ] && continue

  # Check if referenced in any agent context, skills library, or workflow
  refs=$(grep -rl "$skill_name" agents/*/context.md agents/*/skills/*.md agents/shared/workflows/*.ts 2>/dev/null | wc -l)
  if [ "$refs" -eq 0 ]; then
    echo "  ORPHAN: $skill_name (0 references in agent configs/workflows)"
  fi
done

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "FAILED: $ERRORS critical errors"
  exit 1
else
  echo "PASSED: All ${#KEEP_SKILLS[@]} keep-list skills verified"
  exit 0
fi
