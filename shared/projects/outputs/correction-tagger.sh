#!/usr/bin/env bash
# correction-tagger.sh — Classifies human-inputs.jsonl entries into categories
# Categories: approval, correction, question, directive
# Usage: ./correction-tagger.sh [path-to-human-inputs.jsonl]
# Output: Tagged entries + summary correction rate

set -euo pipefail

INPUT_FILE="${1:-agents/shared/projects/outputs/human-inputs.jsonl}"

if [ ! -f "$INPUT_FILE" ]; then
  echo "ERROR: Input file not found: $INPUT_FILE"
  exit 1
fi

TOTAL=0
APPROVALS=0
CORRECTIONS=0
QUESTIONS=0
DIRECTIVES=0

while IFS= read -r line; do
  [ -z "$line" ] && continue
  TOTAL=$((TOTAL + 1))
  
  # Extract content field (handles JSON with jq if available, falls back to grep)
  if command -v jq &>/dev/null; then
    content=$(echo "$line" | jq -r '.content // .message // .text // ""' 2>/dev/null || echo "$line")
  else
    content="$line"
  fi
  
  # Classification heuristics
  content_lower=$(echo "$content" | tr '[:upper:]' '[:lower:]')
  
  # Corrections: redirections, "no", "stop", "don't", "wrong", "instead", "actually"
  if echo "$content_lower" | grep -qE '(no[,. ]|stop|don.t|wrong|instead|actually|fix |not what|should be|change |redo|revert|that.s not)'; then
    tag="correction"
    CORRECTIONS=$((CORRECTIONS + 1))
  # Questions: ends with ?, starts with question words
  elif echo "$content_lower" | grep -qE '(\?$|^(what|how|why|when|where|which|can you|could you|is there))'; then
    tag="question"
    QUESTIONS=$((QUESTIONS + 1))
  # Approvals: "good", "lgtm", "yes", "approved", "thanks", "perfect", "ship it"
  elif echo "$content_lower" | grep -qE '(^(yes|good|lgtm|approved|thanks|perfect|nice|great|ship it|looks good|merge))'; then
    tag="approval"
    APPROVALS=$((APPROVALS + 1))
  # Default: directive (new instruction/task)
  else
    tag="directive"
    DIRECTIVES=$((DIRECTIVES + 1))
  fi
  
  # Output tagged entry
  if command -v jq &>/dev/null; then
    echo "$line" | jq -c --arg tag "$tag" '. + {classification: $tag}' 2>/dev/null || echo "{\"raw\":\"$(echo "$line" | head -c 100)\",\"classification\":\"$tag\"}"
  else
    echo "[${tag}] ${line:0:120}"
  fi

done < "$INPUT_FILE"

# Summary
echo ""
echo "=== CORRECTION RATE SUMMARY ==="
echo "Total entries:  $TOTAL"
echo "Approvals:      $APPROVALS ($(( TOTAL > 0 ? APPROVALS * 100 / TOTAL : 0 ))%)"
echo "Corrections:    $CORRECTIONS ($(( TOTAL > 0 ? CORRECTIONS * 100 / TOTAL : 0 ))%)"
echo "Questions:      $QUESTIONS ($(( TOTAL > 0 ? QUESTIONS * 100 / TOTAL : 0 ))%)"
echo "Directives:     $DIRECTIVES ($(( TOTAL > 0 ? DIRECTIVES * 100 / TOTAL : 0 ))%)"
echo ""
echo "CORRECTION RATE: $(( TOTAL > 0 ? CORRECTIONS * 100 / TOTAL : 0 ))%"
echo "(Target: <5% indicates strong preference alignment)"
