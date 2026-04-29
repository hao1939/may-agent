#!/usr/bin/env bash
# health-check.sh — Reports status of all satellite projects
# Exit 0 always (informational), prints actionable summary

set -euo pipefail
PROJECTS_DIR="$(cd "$(dirname "$0")/../projects" && pwd)"

echo "=== Satellite Project Health Check ==="
echo "Date: $(date -u '+%Y-%m-%d %H:%M UTC')"
echo ""

ACTIVE=0
CLOSED=0
BLOCKED=0
AT_TARGET=0
TOTAL=0

for dir in "$PROJECTS_DIR"/*/; do
  [ -f "$dir/project.md" ] || continue
  name=$(basename "$dir")
  [ "$name" = "outputs" ] || [ "$name" = "_archive" ] && continue
  
  TOTAL=$((TOTAL + 1))
  
  status=$(grep -m1 '^\*\*Status\*\*:' "$dir/project.md" | sed 's/.*: //' | tr -d '[:space:]')
  priority=$(grep -m1 '^\*\*Priority\*\*:' "$dir/project.md" | sed 's/.*: //' | tr -d '[:space:]')
  
  # Check if metrics are at target (look for ✅ in metrics section)
  metrics_met=$(grep -c '✅' "$dir/project.md" 2>/dev/null || true)
  metrics_met=${metrics_met:-0}
  metrics_total=$(grep -cE '^\- .+→ target' "$dir/project.md" 2>/dev/null || true)
  metrics_total=${metrics_total:-0}
  
  case "$status" in
    active) ACTIVE=$((ACTIVE + 1)) ;;
    closed) CLOSED=$((CLOSED + 1)) ;;
    blocked) BLOCKED=$((BLOCKED + 1)) ;;
  esac
  
  if [ "$metrics_met" -gt 0 ] && [ "$metrics_met" -ge "$metrics_total" ] && [ "$metrics_total" -gt 0 ]; then
    AT_TARGET=$((AT_TARGET + 1))
    icon="✅"
  elif [ "$status" = "closed" ]; then
    AT_TARGET=$((AT_TARGET + 1))
    icon="✅"
  elif [ "$status" = "blocked" ]; then
    icon="🚫"
  else
    icon="⚠️"
  fi
  
  printf "  %s %-28s [%s] %s  metrics: %d/%d ✅\n" "$icon" "$name" "$status" "$priority" "$metrics_met" "$metrics_total"
done

echo ""
echo "--- Summary ---"
echo "Total: $TOTAL | Active: $ACTIVE | Closed: $CLOSED | Blocked: $BLOCKED"
echo "At target: $AT_TARGET / $TOTAL"
echo ""

# Actionable recommendations
echo "--- Recommendations ---"
for dir in "$PROJECTS_DIR"/*/; do
  [ -f "$dir/project.md" ] || continue
  name=$(basename "$dir")
  [ "$name" = "outputs" ] || [ "$name" = "_archive" ] && continue
  
  status=$(grep -m1 '^\*\*Status\*\*:' "$dir/project.md" | sed 's/.*: //' | tr -d '[:space:]')
  
  if [ "$status" = "active" ]; then
    metrics_met=$(grep -c '✅' "$dir/project.md" 2>/dev/null || true)
    metrics_met=${metrics_met:-0}
    metrics_total=$(grep -cE '^\- .+→ target' "$dir/project.md" 2>/dev/null || true)
    metrics_total=${metrics_total:-0}
    if [ "$metrics_total" -gt 0 ] && [ "$metrics_met" -lt "$metrics_total" ]; then
      echo "  → $name: $((metrics_total - metrics_met)) metric(s) below target — needs work"
    fi
  fi
done

echo ""
echo "Done."
