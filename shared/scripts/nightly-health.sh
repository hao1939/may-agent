#!/bin/bash
# Nightly Health Report Generator
# Cron-compatible: runs system-health.sh and outputs a dated report
# Usage: ./scripts/nightly-health.sh
# Cron example: 0 2 * * * /app/agents/shared/scripts/nightly-health.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S %Z")
REPORT_DIR="projects/system-efficiency/outputs/health-reports"
REPORT_FILE="${REPORT_DIR}/health-${DATE}.md"
INDEX_FILE="${REPORT_DIR}/index.md"

# Create report directory
mkdir -p "$REPORT_DIR"

# Run system health check
echo "Running system health check..."
HEALTH_OUTPUT=$(bash scripts/system-health.sh 2>&1) || true
EXIT_CODE=${PIPESTATUS[0]:-$?}

# Performance regression detection
PERF_THRESHOLD=5
echo "Running performance check (threshold: ${PERF_THRESHOLD}s)..."
TEST_OUTPUT=$(cd /app && bun run test 2>&1) || true
DURATION=$(echo "$TEST_OUTPUT" | grep -oE 'in [0-9.]+s' | tail -1 | grep -oE '[0-9.]+')
PERF_WARNING=""
if [ -n "$DURATION" ]; then
  DURATION_INT=${DURATION%.*}
  if [ "${DURATION_INT:-0}" -ge "$PERF_THRESHOLD" ]; then
    PERF_WARNING="⚠️ PERF REGRESSION: tests took ${DURATION}s (threshold: ${PERF_THRESHOLD}s)"
    echo "$PERF_WARNING"
    EXIT_CODE=2
  else
    echo "✅ Performance OK: ${DURATION}s (threshold: ${PERF_THRESHOLD}s)"
  fi
fi

# Write dated report
cat > "$REPORT_FILE" <<EOF
# Health Report: ${DATE}
## Generated: ${TIMESTAMP}

\`\`\`
${HEALTH_OUTPUT}
\`\`\`

## Status
$(if [ "${EXIT_CODE}" -eq 0 ]; then echo "✅ ALL SYSTEMS HEALTHY"; elif [ "${EXIT_CODE}" -eq 2 ]; then echo "⚠️ PERFORMANCE REGRESSION DETECTED"; else echo "❌ ISSUES DETECTED (exit code: ${EXIT_CODE})"; fi)
$(if [ -n "${PERF_WARNING}" ]; then echo ""; echo "${PERF_WARNING}"; fi)
EOF

# Append to index
if [ ! -f "$INDEX_FILE" ]; then
  echo "# Health Report Index" > "$INDEX_FILE"
  echo "" >> "$INDEX_FILE"
  echo "| Date | Status | File |" >> "$INDEX_FILE"
  echo "|------|--------|------|" >> "$INDEX_FILE"
fi

STATUS_EMOJI=$(if [ "${EXIT_CODE}" -eq 0 ]; then echo "✅"; else echo "❌"; fi)
echo "| ${DATE} | ${STATUS_EMOJI} | [Report](health-${DATE}.md) |" >> "$INDEX_FILE"

echo "Report written to: ${REPORT_FILE}"

# Exit with health check status
exit ${EXIT_CODE}
