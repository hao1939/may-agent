#!/bin/bash
# Weekly reuse check — finds manifest references in agent session logs
echo "=== Manifest Usage Check $(date +%Y-%m-%d) ==="
for agent_dir in /app/agents/*/; do
  agent=$(basename "$agent_dir")
  hits=$(grep -rl "shared-output-manifest" "$agent_dir/.state/" 2>/dev/null | wc -l)
  if [ "$hits" -gt 0 ]; then
    echo "$agent: $hits session(s) referenced manifest"
  fi
done
echo "=== Reuse Log Entries ==="
REUSE_LOG="/app/agents/shared/projects/cross-agent-collaboration/outputs/reuse-log.md"
if [ -f "$REUSE_LOG" ]; then
  entries=$(tail -n +5 "$REUSE_LOG" | grep -c "|" || echo 0)
  echo "$entries total reuse entries logged"
else
  echo "No reuse log found"
fi
