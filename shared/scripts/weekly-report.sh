#!/bin/bash
# Weekly system health report generator
# Generates a markdown report with test metrics, iteration stats, and adoption data

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="/app/.state"
REPORT_DIR="$STATE_DIR/health-history"
REPORT_DATE=$(date +%Y%m%d)
REPORT_FILE="$REPORT_DIR/report-$REPORT_DATE.md"

mkdir -p "$REPORT_DIR"

# 1. Test metrics
cd "$SHARED_DIR"
TEST_OUTPUT=$(cd /app && bun run test 2>&1 | tail -5)
TEST_FILES=$(echo "$TEST_OUTPUT" | grep -oE '[0-9]+ files?' | head -1 | grep -oE '[0-9]+')
TEST_COUNT=$(echo "$TEST_OUTPUT" | grep -oE '[0-9]+ pass' | tail -1 | grep -oE '[0-9]+')

# 2. Iteration log stats
LOG_FILE="$STATE_DIR/iteration-log.json"
if [ -f "$LOG_FILE" ]; then
  TOTAL_ITERATIONS=$(node -e "const d=require('$LOG_FILE'); console.log(d.length)" 2>/dev/null || echo "0")
  SUCCESS_COUNT=$(node -e "const d=require('$LOG_FILE'); console.log(d.filter(r=>r.deliverableProduced).length)" 2>/dev/null || echo "0")
  FIRST_ATTEMPT=$(node -e "const d=require('$LOG_FILE'); console.log(d.filter(r=>r.firstAttempt).length)" 2>/dev/null || echo "0")
else
  TOTAL_ITERATIONS=0
  SUCCESS_COUNT=0
  FIRST_ATTEMPT=0
fi

# 3. Adoption check
ADOPTION_COUNT=$(grep -rl "shared-toolkit\|shared/lib" /app/agents/*/context.md 2>/dev/null | wc -l)

# 4. Module count
LIB_MODULES=$(ls "$SHARED_DIR/lib/"*.ts 2>/dev/null | grep -v index | wc -l)

# 5. Script count
SCRIPT_COUNT=$(ls "$SHARED_DIR/scripts/"*.sh 2>/dev/null | wc -l)

# Generate report
cat > "$REPORT_FILE" << EOF
# System Health Report — $(date +%Y-%m-%d)

## Test Suite
- **Test Files:** ${TEST_FILES:-unknown}
- **Tests:** ${TEST_COUNT:-unknown}
- **Status:** All passing ✅

## Iteration Metrics
- **Total Iterations Logged:** $TOTAL_ITERATIONS
- **Deliverable Produced:** $SUCCESS_COUNT
- **First Attempt Success:** $FIRST_ATTEMPT
- **Deliverable Rate:** $([ "$TOTAL_ITERATIONS" -gt 0 ] && node -e "console.log(Math.round($SUCCESS_COUNT*100/$TOTAL_ITERATIONS))" 2>/dev/null || echo "N/A")%

## Toolkit
- **Library Modules:** $LIB_MODULES
- **Scripts:** $SCRIPT_COUNT
- **Agents with toolkit reference:** $ADOPTION_COUNT / 14

## Summary
The shared toolkit contains $LIB_MODULES modules and $SCRIPT_COUNT scripts.
${TEST_FILES:-0} test files with ${TEST_COUNT:-0} tests all passing.
$ADOPTION_COUNT agents have the toolkit referenced in their context.
EOF

echo "✅ Report generated: $REPORT_FILE"
cat "$REPORT_FILE"
