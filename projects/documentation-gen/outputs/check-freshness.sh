#!/bin/bash
# Check freshness of all agent documentation files
# Reports each doc file's last modification date and days since modification

echo "=== Agent Documentation Freshness Report ==="
echo "Generated: $(date '+%Y-%m-%d %H:%M')"
echo ""

NOW=$(date +%s)

check_file() {
    local file="$1"
    if [ -f "$file" ]; then
        local mtime=$(stat -c %Y "$file" 2>/dev/null)
        local mdate=$(date -d @"$mtime" '+%Y-%m-%d' 2>/dev/null)
        local days=$(( (NOW - mtime) / 86400 ))
        local status="✅"
        if [ "$days" -gt 14 ]; then
            status="⚠️  STALE"
        fi
        printf "%-60s %s  %3d days  %s\n" "$file" "$mdate" "$days" "$status"
    fi
}

echo "--- Agent docs (context.md, DOMAIN.md, SOUL.md) ---"
for agent_dir in /app/agents/*/; do
    agent=$(basename "$agent_dir")
    # Skip non-agent dirs
    [[ "$agent" == "node_modules" || "$agent" == "shared" || "$agent" == "environment" || "$agent" == "gym" || "$agent" == "knowledge-base" || "$agent" == "_archetypes" || "$agent" == ".lab" ]] && continue
    for doc in context.md DOMAIN.md SOUL.md README.md; do
        check_file "${agent_dir}${doc}"
    done
done

echo ""
echo "--- Project output docs ---"
for f in /app/agents/shared/projects/documentation-gen/outputs/*.md; do
    check_file "$f"
done

echo ""
echo "--- Summary ---"
TOTAL=0
STALE=0
for f in $(find /app/agents -maxdepth 3 \( -name context.md -o -name DOMAIN.md -o -name SOUL.md \) -not -path '*/node_modules/*' -not -path '*/.lab/*'); do
    TOTAL=$((TOTAL + 1))
    mtime=$(stat -c %Y "$f" 2>/dev/null)
    days=$(( (NOW - mtime) / 86400 ))
    if [ "$days" -gt 14 ]; then
        STALE=$((STALE + 1))
    fi
done
echo "Total doc files checked: $TOTAL"
echo "Stale (>14 days): $STALE"
echo "Fresh: $((TOTAL - STALE))"
