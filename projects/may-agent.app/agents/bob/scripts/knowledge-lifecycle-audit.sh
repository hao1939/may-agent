#!/bin/bash
# Knowledge Lifecycle Audit — H-EXP-018 Phase 3 Pilot
# Scans KEs for citation status, identifies promotion candidates and decay candidates
# Usage: bash agents/bob/scripts/knowledge-lifecycle-audit.sh

set -euo pipefail

KE_DIR="agents/shared/knowledge/entries"
ACTIVE_DOCS="agents/*/context.md agents/*/SOUL.md agents/shared/skills/"

echo "=== Knowledge Lifecycle Audit ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# 1. KE Citation Analysis
echo "## KE Citation Status"
total=0
cited=0
uncited=0
uncited_list=""

for f in "$KE_DIR"/KE-*.md; do
  ke=$(basename "$f" .md | grep -oP 'KE-\d+')
  total=$((total + 1))
  count=$(grep -rl "$ke" agents/shared/skills/ agents/*/context.md agents/*/SOUL.md 2>/dev/null | wc -l)
  if [ "$count" -gt 0 ]; then
    cited=$((cited + 1))
  else
    uncited=$((uncited + 1))
    uncited_list="$uncited_list $ke"
  fi
done

echo "Total KEs: $total"
echo "Cited in active docs: $cited ($(( cited * 100 / total ))%)"
echo "Uncited (decay candidates): $uncited ($(( uncited * 100 / total ))%)"
echo ""

# 2. Most-cited KEs (top 10)
echo "## Top 10 Most-Referenced KEs"
grep -roh "KE-[0-9]\+" agents/ 2>/dev/null | sort | uniq -c | sort -rn | head -10
echo ""

# 3. Skills without KE backing
echo "## Skills Without KE References"
skill_count=0
unbacked=0
for f in agents/shared/skills/*/SKILL.md agents/shared/skills/*.md; do
  [ -f "$f" ] || continue
  skill_count=$((skill_count + 1))
  if ! grep -q "KE-[0-9]" "$f" 2>/dev/null; then
    unbacked=$((unbacked + 1))
  fi
done
echo "Total skills: $skill_count"
echo "Without KE reference: $unbacked"
echo ""

# 4. Summary
echo "## Recommendations"
echo "- $uncited KEs are decay candidates (uncited in any active doc)"
echo "- Review top-cited KEs for accuracy (high-impact if stale)"
echo "- $unbacked skills lack KE backing (compression chain gap)"
