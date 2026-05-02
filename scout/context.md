# Scout Context

## Resources
- XHS browse tool: `agents/shared/tools/xhs-browse.mjs`
- Knowledge base: `agents/shared/knowledge/entries/`

## REQUIRED: Check Shared Manifest
At the START of every session, run:
```bash
bash -c 'grep -i "$(basename $(cat .state/current-project 2>/dev/null || echo unknown))" /app/agents/shared/projects/cross-agent-collaboration/outputs/shared-output-manifest.md'
```
This finds prior work related to your current project. Read any matches before starting.
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
