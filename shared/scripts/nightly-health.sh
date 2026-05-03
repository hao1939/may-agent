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

REPORT_FILE="$REPORT_DIR/health-${DATE}.md"
INDEX_FILE="$REPORT_DIR/index.md"

# Run system-health.sh and capture output
echo "Running system health check at $TIMESTAMP..."
HEALTH_OUTPUT=$("$SCRIPT_DIR/system-health.sh" 2>&1) || true
HEALTH_EXIT=$?

# Write dated report
cat > "$REPORT_FILE" << EOF
# Health Report: $DATE
## Generated: $TIMESTAMP

\`\`\`
$HEALTH_OUTPUT
\`\`\`

## Status: $([ $HEALTH_EXIT -eq 0 ] && echo "✅ HEALTHY" || echo "❌ UNHEALTHY")
EOF

# Append to index
if [ ! -f "$INDEX_FILE" ]; then
  echo "# Health Report Index" > "$INDEX_FILE"
  echo "" >> "$INDEX_FILE"
  echo "| Date | Status |" >> "$INDEX_FILE"
  echo "|------|--------|" >> "$INDEX_FILE"
fi

STATUS_EMOJI=$([ $HEALTH_EXIT -eq 0 ] && echo "✅" || echo "❌")
echo "| $DATE | $STATUS_EMOJI |" >> "$INDEX_FILE"

echo "Report written to: $REPORT_FILE"
echo "Index updated: $INDEX_FILE"

exit $HEALTH_EXIT
