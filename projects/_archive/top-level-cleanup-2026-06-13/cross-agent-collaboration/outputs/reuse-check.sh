#!/bin/bash
echo "=== Manifest Usage Check $(date +%Y-%m-%d) ==="
for agent_dir in /app/agents/*/; do
  agent=$(basename "$agent_dir")
  hits=$(grep -rl "shared-output-manifest" "$agent_dir.state/" 2>/dev/null | wc -l)
  if [ "$hits" -gt 0 ]; then
    echo "$agent: $hits session(s) referenced manifest"
  fi
done
echo "=== Reuse Log Entries ==="
grep -c "|" /app/agents/shared/projects/cross-agent-collaboration/outputs/reuse-log.md 2>/dev/null || echo "0"
