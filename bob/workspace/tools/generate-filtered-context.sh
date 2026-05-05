#!/usr/bin/env bash
# EXP-235 Phase 4 Prototype: Task-Aware Context Filtering
# Usage: ./generate-filtered-context.sh <agent-name> <task-description>
# Outputs filtered context to stdout with only task-relevant sections.
#
# Approach: Parse context.md into sections, match section headers + content
# against keywords extracted from the task description. Always include
# universal sections (Environment, Session Discipline, Shared Toolkit).

set -euo pipefail

AGENT="${1:?Usage: $0 <agent-name> <task-description>}"
TASK="${2:?Usage: $0 <agent-name> <task-description>}"
CONTEXT_FILE="agents/${AGENT}/context.md"

if [[ ! -f "$CONTEXT_FILE" ]]; then
  echo "ERROR: $CONTEXT_FILE not found" >&2
  exit 1
fi

# Universal sections that always get included (case-insensitive patterns)
UNIVERSAL_PATTERNS=(
  "environment"
  "session discipline"
  "shared toolkit"
  "output format"
  "budget"
)

# Extract keywords from task (lowercase, deduplicated, min 4 chars)
extract_keywords() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | \
    grep -oE '[a-z]{4,}' | \
    sort -u | \
    grep -vE '^(this|that|with|from|have|been|will|would|should|could|into|also|each|when|what|your|they|them|then|than|more|some|make|just|only|about|after|before|other|these|those|which|their|there|where|every|first|being|does|done|need|must|very|most|were|here|much)$'
}

# Parse context.md into sections (## headers)
# Output: section_header\tline_start\tline_end for each section
parse_sections() {
  local file="$1"
  local prev_header=""
  local prev_line=0
  local line_num=0

  while IFS= read -r line; do
    line_num=$((line_num + 1))
    if [[ "$line" =~ ^##\  ]]; then
      if [[ -n "$prev_header" ]]; then
        echo "${prev_header}	${prev_line}	$((line_num - 1))"
      fi
      prev_header="${line#\#\# }"
      prev_line=$line_num
    fi
  done < "$file"
  # Last section
  if [[ -n "$prev_header" ]]; then
    echo "${prev_header}	${prev_line}	${line_num}"
  fi
}

# Check if a section is universal (always included)
is_universal() {
  local header_lower
  header_lower=$(echo "$1" | tr '[:upper:]' '[:lower:]')
  for pattern in "${UNIVERSAL_PATTERNS[@]}"; do
    if [[ "$header_lower" == *"$pattern"* ]]; then
      return 0
    fi
  done
  return 1
}

# Check if section content matches any task keyword
matches_task() {
  local file="$1"
  local start="$2"
  local end="$3"
  shift 3
  local keywords=("$@")

  local section_text
  section_text=$(sed -n "${start},${end}p" "$file" | tr '[:upper:]' '[:lower:]')

  for kw in "${keywords[@]}"; do
    if echo "$section_text" | grep -q "$kw"; then
      return 0
    fi
  done
  return 1
}

# Main logic
KEYWORDS=()
while IFS= read -r kw; do
  KEYWORDS+=("$kw")
done < <(extract_keywords "$TASK")

if [[ ${#KEYWORDS[@]} -eq 0 ]]; then
  # No keywords extracted — return full context
  cat "$CONTEXT_FILE"
  exit 0
fi

# Always include the title (first line)
head -1 "$CONTEXT_FILE"
echo ""

TOTAL_LINES=$(wc -l < "$CONTEXT_FILE")
INCLUDED_LINES=0
TOTAL_SECTIONS=0
INCLUDED_SECTIONS=0

# Parse sections into temp file to avoid subshell variable scoping issues
SECTIONS_TMP=$(mktemp)
trap "rm -f $SECTIONS_TMP" EXIT
parse_sections "$CONTEXT_FILE" > "$SECTIONS_TMP"

while IFS=$'\t' read -r header start end; do
  TOTAL_SECTIONS=$((TOTAL_SECTIONS + 1))
  section_lines=$((end - start + 1))

  if is_universal "$header" || matches_task "$CONTEXT_FILE" "$start" "$end" "${KEYWORDS[@]}"; then
    INCLUDED_SECTIONS=$((INCLUDED_SECTIONS + 1))
    INCLUDED_LINES=$((INCLUDED_LINES + section_lines))
    sed -n "${start},${end}p" "$CONTEXT_FILE"
    echo ""
  fi
done < "$SECTIONS_TMP"

# Stats to stderr
REDUCTION=$(( (TOTAL_LINES - INCLUDED_LINES) * 100 / TOTAL_LINES ))
echo "--- Context Filter Stats ---" >&2
echo "Agent: $AGENT" >&2
echo "Task keywords: ${KEYWORDS[*]}" >&2
echo "Sections: ${INCLUDED_SECTIONS}/${TOTAL_SECTIONS} included" >&2
echo "Lines: ${INCLUDED_LINES}/${TOTAL_LINES} (${REDUCTION}% reduction)" >&2
