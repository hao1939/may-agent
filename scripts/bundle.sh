#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

BUN="$(command -v bun 2>/dev/null || echo "${HOME}/.bun/bin/bun")"
if ! [ -x "$BUN" ]; then
  echo "Error: bun not found. Install with: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi

mkdir -p bundle
echo "Building may-agent binary..."
"$BUN" build --compile src/app/binary-entry.ts --outfile bundle/may-agent
echo "Built: bundle/may-agent ($(du -h bundle/may-agent | cut -f1))"
echo ""
echo "Run with: PROJECT_ROOT=/app ./bundle/may-agent --chat --cron --telegram --socket"
