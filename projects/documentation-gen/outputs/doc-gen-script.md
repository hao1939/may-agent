# Documentation Auto-Generation Pipeline

## Overview
A script-based pipeline that extracts documentation from code, configs, and agent definitions, then assembles it into browsable markdown docs. Designed to run daily or on-demand.

## Pipeline Steps

### Step 1: Extract Agent Metadata
```bash
#!/bin/bash
# doc-gen.sh — Auto-generate agent system documentation

OUTPUT_DIR="/app/agents/shared/projects/documentation-gen/outputs/generated"
mkdir -p "$OUTPUT_DIR"

# Extract agent definitions
echo "# Agent Registry" > "$OUTPUT_DIR/agents.md"
for agent_dir in /app/agents/*/; do
  agent_name=$(basename "$agent_dir")
  [[ "$agent_name" == "shared" ]] && continue
  echo "## $agent_name" >> "$OUTPUT_DIR/agents.md"
  if [ -f "$agent_dir/context.md" ]; then
    echo '```' >> "$OUTPUT_DIR/agents.md"
    head -20 "$agent_dir/context.md" >> "$OUTPUT_DIR/agents.md"
    echo '```' >> "$OUTPUT_DIR/agents.md"
  else
    echo "_No context.md found_" >> "$OUTPUT_DIR/agents.md"
  fi
  echo "" >> "$OUTPUT_DIR/agents.md"
done
```

### Step 2: Extract Workflow Definitions
```bash
# Extract workflow descriptions from TypeScript files
echo "# Workflows" > "$OUTPUT_DIR/workflows.md"
for wf in /app/agents/shared/workflows/*.ts; do
  wf_name=$(basename "$wf" .ts)
  echo "## $wf_name" >> "$OUTPUT_DIR/workflows.md"
  # Extract leading comment block or description
  head -30 "$wf" | grep -E '^\s*(//|\*|/\*\*)' >> "$OUTPUT_DIR/workflows.md"
  echo "" >> "$OUTPUT_DIR/workflows.md"
done
```

### Step 3: Extract Project Status
```bash
# Summarize active projects
echo "# Active Projects" > "$OUTPUT_DIR/projects.md"
for proj in /app/agents/shared/projects/*/project.md; do
  proj_name=$(basename $(dirname "$proj"))
  status=$(grep -i "^Status:" "$proj" | head -1)
  goal=$(grep -i "^## Goal" -A 2 "$proj" | tail -1)
  echo "## $proj_name" >> "$OUTPUT_DIR/projects.md"
  echo "- $status" >> "$OUTPUT_DIR/projects.md"
  echo "- $goal" >> "$OUTPUT_DIR/projects.md"
  echo "" >> "$OUTPUT_DIR/projects.md"
done
```

### Step 4: Assemble Index
```bash
echo "# System Documentation Index" > "$OUTPUT_DIR/index.md"
echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$OUTPUT_DIR/index.md"
echo "" >> "$OUTPUT_DIR/index.md"
echo "- [Agent Registry](agents.md)" >> "$OUTPUT_DIR/index.md"
echo "- [Workflows](workflows.md)" >> "$OUTPUT_DIR/index.md"
echo "- [Active Projects](projects.md)" >> "$OUTPUT_DIR/index.md"
```

## Scheduling
- **Manual**: Run `bash doc-gen.sh` anytime
- **Automated**: Add to heartbeat or cron: runs daily at 00:00 UTC
- **On-demand**: Trigger from any agent via `bash("/app/agents/shared/projects/documentation-gen/outputs/doc-gen.sh")`

## Staleness Tracking
Each generated file includes a timestamp. A staleness check compares file modification time to current time:
```bash
find "$OUTPUT_DIR" -name "*.md" -mtime +7 -exec echo "STALE: {}" \;
```
Alert if any doc is older than 7 days.

## Metrics Impact
- docs.pages-generated: Pipeline produces 4 files per run (agents, workflows, projects, index)
- docs.staleness-days: Tracked via modification timestamps
- docs.coverage: Count agents with context.md vs total agents
