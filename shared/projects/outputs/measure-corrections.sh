#!/bin/bash
# measure-corrections.sh — Count tagged corrections vs total decisions in a time window
# Usage: ./measure-corrections.sh [days_back] (default: 30)
#
# Scans session meta.json files for correction tags and calculates correction rate.

DAYS_BACK="${1:-30}"
CUTOFF=$(date -d "-${DAYS_BACK} days" +%s 2>/dev/null || date -v-${DAYS_BACK}d +%s 2>/dev/null)

SESSIONS_DIR="/app/sessions"
TOTAL_DECISIONS=0
TOTAL_CORRECTIONS=0
CORRECTIONS_LOG=""

# Find all meta.json files in sessions
find "$SESSIONS_DIR" -name "meta.json" -type f 2>/dev/null | while read meta; do
  # Check if session is within time window
  mtime=$(stat -c %Y "$meta" 2>/dev/null || stat -f %m "$meta" 2>/dev/null)
  if [ -n "$mtime" ] && [ "$mtime" -ge "$CUTOFF" ]; then
    echo "$meta"
  fi
done | {
  while read meta; do
    TOTAL_DECISIONS=$((TOTAL_DECISIONS + 1))
    
    # Check for correction tag
    if grep -q '"correction"' "$meta" 2>/dev/null; then
      TOTAL_CORRECTIONS=$((TOTAL_CORRECTIONS + 1))
      reason=$(grep -o '"correction_reason"[[:space:]]*:[[:space:]]*"[^"]*"' "$meta" 2>/dev/null | head -1 | sed 's/.*: *"//;s/"$//')
      CORRECTIONS_LOG="${CORRECTIONS_LOG}\n  - ${meta}: ${reason:-no reason given}"
    fi
  done

  # Output report
  echo "=== Correction Rate Report ==="
  echo "Window: last ${DAYS_BACK} days"
  echo "Total sessions with decisions: ${TOTAL_DECISIONS}"
  echo "Sessions with corrections: ${TOTAL_CORRECTIONS}"
  
  if [ "$TOTAL_DECISIONS" -gt 0 ]; then
    # bash integer math, multiply by 100 first for percentage
    RATE=$((TOTAL_CORRECTIONS * 100 / TOTAL_DECISIONS))
    echo "Correction rate: ${RATE}% (${TOTAL_CORRECTIONS}/${TOTAL_DECISIONS})"
  else
    echo "Correction rate: N/A (no sessions found)"
  fi
  
  if [ -n "$CORRECTIONS_LOG" ]; then
    echo ""
    echo "Corrections found:"
    echo -e "$CORRECTIONS_LOG"
  fi
  
  echo ""
  echo "Target: <10% correction rate"
}
