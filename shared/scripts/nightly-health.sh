#!/bin/bash
# Nightly Health Report Generator
# Cron-compatible: runs system-health.sh and outputs a dated report
# Usage: ./scripts/nightly-health.sh
# Cron example: 0 2 * * * /app/agents/shared/scripts/nightly-health.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
REPORT_DIR="$PROJECT_DIR/projects/system-efficiency/outputs/health-reports"

mkdir -p "$REPORT_DIR"

echo "=== Nightly Health Report: $DATE ==="
echo ""

# Run system-health.sh and capture output
HEALTH_OUTPUT=$("$SCRIPT_DIR/system-health.sh" 2>&1) || true
HEALTH_EXIT=$?

# Write dated report
cat > "$REPORT_DIR/health-${DATE}.md" << EOF
# Health Report: $DATE
## Generated: $TIMESTAMP

\`\`\`
$HEALTH_OUTPUT
\`\`\`

## Exit Code: $HEALTH_EXIT
EOF

# Append to index
if [ ! -f "$REPORT_DIR/index.md" ]; then
  echo "# Health Report Index" > "$REPORT_DIR/index.md"
  echo "" >> "$REPORT_DIR/index.md"
  echo "| Date | Status |" >> "$REPORT_DIR/index.md"
  echo "|------|--------|" >> "$REPORT_DIR/index.md"
fi

if [ "$HEALTH_EXIT" -eq 0 ]; then
  STATUS="✅ PASS"
else
  STATUS="❌ FAIL"
fi

echo "| $DATE | $STATUS |" >> "$REPORT_DIR/index.md"

echo "Report written to: health-reports/health-${DATE}.md"
echo "Status: $STATUS"

exit $HEALTH_EXIT
