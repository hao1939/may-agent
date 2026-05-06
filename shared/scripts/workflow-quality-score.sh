#!/bin/bash
# Workflow Quality Scoring Script
# Grades each workflow file on 5 criteria (100 points max)

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKFLOWS_DIR="$SCRIPT_DIR/workflows"
TESTS_DIR="$SCRIPT_DIR/tests"

printf "%-40s %5s %5s %5s %5s %5s %5s\n" "File" "Tests" "Err" "JSDoc" "Size" "Clean" "Total"
printf "%-40s %5s %5s %5s %5s %5s %5s\n" "----" "-----" "-----" "-----" "-----" "-----" "-----"

results=""

for file in "$WORKFLOWS_DIR"/*.ts; do
  # Skip test files
  [[ "$file" == *.test.ts ]] && continue
  
  basename=$(basename "$file" .ts)
  score=0
  
  # 1. Has tests (25pts)
  tests_score=0
  if [ -f "$TESTS_DIR/${basename}.test.ts" ]; then
    tests_score=25
  fi
  score=$((score + tests_score))
  
  # 2. Has error handling (25pts)
  err_score=0
  catch_count=$(grep -c "catch" "$file" 2>/dev/null)
  catch_count=${catch_count:-0}
  if [ "$catch_count" -gt 0 ]; then
    err_score=25
  fi
  score=$((score + err_score))
  
  # 3. Has JSDoc (20pts)
  jsdoc_score=0
  jsdoc_count=$(grep -c "/\*\*" "$file" 2>/dev/null || echo 0)
  if [ "$jsdoc_count" -gt 0 ]; then
    jsdoc_score=20
  fi
  score=$((score + jsdoc_score))
  
  # 4. Under 200 lines (15pts)
  size_score=0
  line_count=$(wc -l < "$file")
  if [ "$line_count" -lt 200 ]; then
    size_score=15
  fi
  score=$((score + size_score))
  
  # 5. No TODOs/FIXMEs (15pts)
  clean_score=15
  todo_count=$(grep -c "TODO\|FIXME\|HACK\|XXX" "$file" 2>/dev/null)
  todo_count=${todo_count:-0}
  if [ "$todo_count" -gt 0 ]; then
    clean_score=0
  fi
  score=$((score + clean_score))
  
  results="${results}${score} $(printf "%-40s %5d %5d %5d %5d %5d %5d" "$basename" "$tests_score" "$err_score" "$jsdoc_score" "$size_score" "$clean_score" "$score")\n"
done

# Sort by total score (descending)
echo -e "$results" | sort -rn | awk '{$1=""; print substr($0,2)}'
