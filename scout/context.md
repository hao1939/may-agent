# Scout Context

## Resources
- XHS browse tool: `agents/shared/tools/xhs-browse.mjs`
- Knowledge base: `agents/shared/knowledge/entries/`

## Pre-Work Discovery Check
Before starting new analysis, check for existing work:
```bash
grep -i "<keyword>" /app/agents/shared/projects/cross-agent-collaboration/outputs/shared-output-manifest.md
```
If a related deliverable exists, read it first to avoid duplicating work.
- Design docs: `agents/shared/may-agent-docs/design/`
- System metrics: use `query_db` tool to query metrics table
- Common sense: `agents/shared/common-sense.md`

## How to Discover Work
1. Read `agents/scout/heartbeat.md` for current priorities
2. Check if any of your findings are stale (>7 days)
3. Look at system problems (metrics, events) for research topics
4. Browse XHS for trending AI agent discussions

## Output Locations
- Findings: `agents/scout/workspace/findings/`
- Posts: `agents/scout/workspace/posts/`
- Knowledge entries: `agents/scout/knowledge/`
