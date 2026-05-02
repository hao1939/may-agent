#!/bin/bash
# Reports outputs files not yet indexed in the manifest
MANIFEST="/app/agents/shared/projects/cross-agent-collaboration/outputs/shared-output-manifest.md"
for f in /app/agents/shared/projects/*/outputs/*.md; do
  basename=$(basename "$f")
  if ! grep -q "$basename" "$MANIFEST" 2>/dev/null; then
    echo "UNINDEXED: $f"
  fi
done
