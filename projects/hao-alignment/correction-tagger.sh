#!/bin/bash
# Tag each human-inputs.jsonl entry as: approval, correction, directive, question, status
# Outputs classification counts and correction rate
# Usage: correction-tagger.sh [input_file]

INPUT_FILE="${1:-/app/.state/human-inputs.jsonl}"

if [ ! -f "$INPUT_FILE" ]; then
  echo "ERROR: $INPUT_FILE not found"
  exit 1
fi

APPROVALS=0
CORRECTIONS=0
DIRECTIVES=0
QUESTIONS=0
STATUS=0
OTHER=0
TOTAL=0

while IFS= read -r line; do
  [ -z "$line" ] && continue
  TOTAL=$((TOTAL + 1))
  
  # Extract the content/message field
  msg=$(echo "$line" | grep -oP '"(content|message|text)"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"$//')
  msg_lower=$(echo "$msg" | tr '[:upper:]' '[:lower:]')
  
  # Classify
  if echo "$msg_lower" | grep -qiE '^(great|yes|good|perfect|nice|ok |okay|approved|lgtm|let.s roll|go ahead|ship it|do it|choice it)'; then
    APPROVALS=$((APPROVALS + 1))
  elif echo "$msg_lower" | grep -qiE '(wrong|no,|no\.|stop |don.t|do not|cancel|reject|not what|bad |incorrect|why you stop|check again|so little|against our design)'; then
    CORRECTIONS=$((CORRECTIONS + 1))
  elif echo "$msg_lower" | grep -qiE '(\?|how is|what.s the|status|progress|where are|show me)'; then
    QUESTIONS=$((QUESTIONS + 1))
  elif echo "$msg_lower" | grep -qiE '(please|fix|investigate|create|build|add|update|implement|start|move|assign|review)'; then
    DIRECTIVES=$((DIRECTIVES + 1))
  else
    OTHER=$((OTHER + 1))
  fi
done < "$INPUT_FILE"

if [ "$TOTAL" -gt 0 ]; then
  RATE=$(echo "scale=2; $CORRECTIONS * 100 / $TOTAL" | bc 2>/dev/null || echo "N/A")
else
  RATE="N/A"
fi

echo "=== Correction Tagger Results ==="
echo "Date: $(date -I)"
echo "Source: $INPUT_FILE"
echo "Total entries: $TOTAL"
echo ""
echo "Classifications:"
echo "  Approvals:   $APPROVALS"
echo "  Corrections: $CORRECTIONS"
echo "  Questions:   $QUESTIONS"
echo "  Directives:  $DIRECTIVES"
echo "  Other:       $OTHER"
echo ""
echo "Correction rate: ${RATE}% ($CORRECTIONS / $TOTAL)"
echo ""
echo "Target: < 10%"
