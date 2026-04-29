#!/bin/bash
# System Health Dashboard — reports all key metrics

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "╔══════════════════════════════════════════════════╗"
echo "║        System Efficiency Health Dashboard        ║"
echo "╠══════════════════════════════════════════════════╣"
echo ""

# Test count
TEST_COUNT=$(npx vitest run --reporter=json 2>/dev/null | jq '.numTotalTests // 0')
if [ -z "$TEST_COUNT" ] || [ "$TEST_COUNT" = "null" ]; then
  TEST_COUNT=0
fi

# Test file count
TEST_FILES=$(find . -name '*.test.*' -not -path './node_modules/*' | wc -l | tr -d ' ')

# Output artifacts
ARTIFACTS=$(ls outputs/ 2>/dev/null | wc -l | tr -d ' ')

# Lessons count (from memory files)
LESSONS=$(find . -path '*/memory/*' -name '*.md' -not -path './node_modules/*' -exec grep -c '^-' {} + 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')

printf "%-30s %-12s %-12s %-8s\n" "Metric" "Current" "Target" "Status"
printf "%-30s %-12s %-12s %-8s\n" "------------------------------" "------------" "------------" "--------"

# Test count status
if [ "$TEST_COUNT" -ge 500 ]; then TC_STATUS="✅"; else TC_STATUS="⚠️"; fi
printf "%-30s %-12s %-12s %-8s\n" "Total Tests" "$TEST_COUNT" "500+" "$TC_STATUS"

# Test files status
if [ "$TEST_FILES" -ge 18 ]; then TF_STATUS="✅"; else TF_STATUS="⚠️"; fi
printf "%-30s %-12s %-12s %-8s\n" "Test Files" "$TEST_FILES" "18+" "$TF_STATUS"

# Artifacts status
if [ "$ARTIFACTS" -ge 5 ]; then A_STATUS="✅"; else A_STATUS="⚠️"; fi
printf "%-30s %-12s %-12s %-8s\n" "Output Artifacts" "$ARTIFACTS" "5+" "$A_STATUS"

# Lessons status
if [ "$LESSONS" -ge 50 ]; then L_STATUS="✅"; else L_STATUS="⚠️"; fi
printf "%-30s %-12s %-12s %-8s\n" "Lessons Extracted" "$LESSONS" "50+" "$L_STATUS"

echo ""
echo "╚══════════════════════════════════════════════════╝"
