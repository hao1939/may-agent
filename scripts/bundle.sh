#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

BUN="${HOME}/.bun/bin/bun"
if ! command -v "$BUN" &>/dev/null; then
  echo "Error: bun not found at $BUN. Install with: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi

mkdir -p bundle
echo "Building may-agent binary..."
"$BUN" build --compile src/app/binary-entry.ts --outfile bundle/may-agent
echo "Built: bundle/may-agent ($(du -h bundle/may-agent | cut -f1))"
echo ""
echo "Run with: PROJECT_ROOT=/app ./bundle/may-agent --chat --cron --telegram --socket"
