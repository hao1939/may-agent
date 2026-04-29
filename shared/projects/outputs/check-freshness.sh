#!/usr/bin/env bash
# check-freshness.sh — Report age of agent doc files and output files
# Usage: bash check-freshness.sh

set -euo pipefail

NOW=$(date +%s)
OUTPUTS_DIR="$(cd "$(dirname "$0")" && pwd)"

printf "%-60s %-12s %s\n" "FILE" "MODIFIED" "DAYS AGO"
printf "%-60s %-12s %s\n" "----" "--------" "--------"

# Find doc files under /app/agents/*/
find /app/agents -maxdepth 3 \
  \( -name context.md -o -name DOMAIN.md -o -name SOUL.md -o -name README.md \) \
  -not -path '*/node_modules/*' \
  -not -path '*/.lab/*' | sort | while read -r f; do
  MTIME=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null)
  MDATE=$(date -d "@$MTIME" +%Y-%m-%d 2>/dev/null || date -r "$MTIME" +%Y-%m-%d 2>/dev/null)
  DAYS=$(( (NOW - MTIME) / 86400 ))
  printf "%-60s %-12s %s\n" "${f#/app/}" "$MDATE" "$DAYS"
done

# Find .md files in outputs/
echo ""
echo "=== Output files ==="
printf "%-60s %-12s %s\n" "FILE" "MODIFIED" "DAYS AGO"
printf "%-60s %-12s %s\n" "----" "--------" "--------"

find "$OUTPUTS_DIR" -maxdepth 1 -name '*.md' -o -name '*.sh' | sort | while read -r f; do
  MTIME=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null)
  MDATE=$(date -d "@$MTIME" +%Y-%m-%d 2>/dev/null || date -r "$MTIME" +%Y-%m-%d 2>/dev/null)
  DAYS=$(( (NOW - MTIME) / 86400 ))
  printf "%-60s %-12s %s\n" "$(basename "$f")" "$MDATE" "$DAYS"
done
