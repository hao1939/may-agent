#!/bin/bash
# trace-error.sh — Cross-reference errors in log files with source code
#
# Scans all log files in logs/ for ERROR and WARN entries,
# extracts source file references, and shows the relevant code context.
#
# Usage: ./scripts/trace-error.sh [pattern]
#   pattern: grep pattern to search for (default: "ERROR\|WARN")

pattern="${1:-ERROR\|WARN}"

echo "╔══════════════════════════════════════════════════════╗"
echo "║           Error Trace Report                         ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Count total log lines for context
total_lines=$(wc -l logs/*.log 2>/dev/null | tail -1 | awk '{print $1}')
echo "Scanned $total_lines lines across $(ls logs/*.log 2>/dev/null | wc -l) log files"
echo ""

# Find all matching entries
echo "━━━ Matching Log Entries ━━━"
matches=$(grep -rn "$pattern" logs/ 2>/dev/null)
if [ -z "$matches" ]; then
  echo "No matches found for pattern: $pattern"
  exit 0
fi

echo "$matches"
echo ""

# Extract source file references (pattern: src/something.js:NN)
echo "━━━ Source Code References ━━━"
refs=$(echo "$matches" | grep -oP 'src/[\w.-]+\.js:\d+' | sort -u)

if [ -z "$refs" ]; then
  echo "No source code references found in error messages."
  echo ""
  echo "━━━ Context Around Errors ━━━"
  grep -rn -B2 -A2 "$pattern" logs/ 2>/dev/null
else
  echo "$refs"
  echo ""
  echo "━━━ Source Code Context ━━━"
  echo "$refs" | while IFS=: read -r file line; do
    if [ -f "$file" ]; then
      start=$((line - 5))
      [ $start -lt 1 ] && start=1
      end=$((line + 5))
      echo ""
      echo ">>> $file (around line $line):"
      echo "    ─────────────────────────────"
      sed -n "${start},${end}p" "$file" | while IFS= read -r src_line; do
        if [ $start -eq $line ]; then
          echo " >> $start: $src_line"
        else
          echo "    $start: $src_line"
        fi
        start=$((start + 1))
      done
    else
      echo ">>> $file:$line — file not found"
    fi
  done
fi

echo ""
echo "━━━ Summary ━━━"
error_count=$(echo "$matches" | grep -c "ERROR")
warn_count=$(echo "$matches" | grep -c "WARN")
echo "Errors: $error_count, Warnings: $warn_count"
echo "Unique source references: $(echo "$refs" | grep -c .)"
