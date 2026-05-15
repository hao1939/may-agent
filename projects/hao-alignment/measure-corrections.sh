#!/bin/bash
# Measure correction rate from Hao interaction sessions
# Scans: chat sessions + telegram-sourced sessions + sessions mentioning "hao"
# Usage: measure-corrections.sh [days_back]

DAYS_BACK=${1:-30}
CUTOFF_MS=$(( $(date +%s) * 1000 - DAYS_BACK * 86400000 ))
SESSIONS_DIR="/app/.state/sessions"

TOTAL=0
CORRECTIONS=0
CORRECTION_DETAILS=""

# Find candidate sessions: chat OR telegram-sourced
CANDIDATES=$(grep -rl '"kind": "chat"\|"source": "telegram"' "$SESSIONS_DIR"/*/meta.json 2>/dev/null | head -500)

for meta in $CANDIDATES; do
  SESSION_DIR=$(dirname "$meta")
  SESSION_NAME=$(basename "$SESSION_DIR")
  
  # Extract startedAt timestamp from session name (s_TIMESTAMP_N format)
  STARTED=$(echo "$SESSION_NAME" | grep -oP '(?<=s_)\d+' | head -1)
  if [ -n "$STARTED" ] && [ "$STARTED" -lt "$CUTOFF_MS" ] 2>/dev/null; then
    continue
  fi
  
  TOTAL=$((TOTAL + 1))
  
  # Check for correction signals in session messages
  CORRECTION_FOUND=false
  for msgfile in "$SESSION_DIR"/messages*.jsonl "$SESSION_DIR"/*.jsonl; do
    [ -f "$msgfile" ] || continue
    # Look for Hao corrections - user role messages with rejection/override language
    if grep -qiE '"role":\s*"user"' "$msgfile" 2>/dev/null; then
      if grep -iE '"(no,|stop |don.t do|do not |wrong|incorrect|cancel that|reject|not what I|bad idea|please don)"' "$msgfile" 2>/dev/null | grep -qi '"role":\s*"user"'; then
        CORRECTION_FOUND=true
        SNIPPET=$(grep -iE '"(no,|stop |don.t do|do not |wrong|incorrect|cancel|reject)"' "$msgfile" 2>/dev/null | head -1 | cut -c1-120)
        CORRECTION_DETAILS="${CORRECTION_DETAILS}\n  - ${SESSION_NAME}: ${SNIPPET}"
        break
      fi
    fi
  done
  
  if [ "$CORRECTION_FOUND" = true ]; then
    CORRECTIONS=$((CORRECTIONS + 1))
  fi
done

if [ "$TOTAL" -gt 0 ]; then
  RATE=$(echo "scale=1; $CORRECTIONS * 100 / $TOTAL" | bc 2>/dev/null || echo "N/A")
else
  RATE="N/A (no sessions found)"
fi

echo "=== Correction Rate Measurement ==="
echo "Date: $(date -I)"
echo "Window: last ${DAYS_BACK} days"
echo "Sessions scanned: ${TOTAL} (chat + telegram)"
echo "Sessions with correction signals: ${CORRECTIONS}"
echo "Correction rate: ${RATE}%"
echo ""
echo "Detection sources: kind:chat, source:telegram"
echo ""
echo "Details:"
echo -e "$CORRECTION_DETAILS"
