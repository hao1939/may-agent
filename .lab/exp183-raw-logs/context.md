# Coder Context

## Environment
- bun is at .state/.bun/bin/bun — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- Project root is /app — do not use /home/*, /Users/*, /root/*, or ~/ paths
- npx is not available — use ./node_modules/.bin/<tool> or bun x <tool>
- rg (ripgrep) is not installed — use `scripts/code-search.sh <pattern>` instead of manual grep. Supports `--path 'src/**/*.ts'`, `-C N` (context lines), `-i` (case-insensitive), `-l` (files-only). Handles exclusions (node_modules, .git, .state) automatically.

## CRITICAL: Investigation Work Pattern
When doing multi-step analysis (reading logs, correlating data, investigating issues):

1. **WRITE EARLY**: After your FIRST 2-3 reads, write findings to `workspace/findings.md`
2. **WRITE OFTEN**: After every 3 analysis commands, append new findings to workspace
3. **FINISH WITH DELIVERABLES**: Your finish() call MUST include deliverables listing every workspace file:
```
finish({
  deliverables: [
    { path: "workspace/findings.md", description: "Investigation findings" },
    { path: "workspace/report.md", description: "Final report" }
  ]
})
```

- **KE-008**: Do NOT restructure heartbeat steps (reorder, merge, rename). Heartbeat regressions are caused by structural changes, not content. Add content within existing steps only.

## Convention Rules
- **C1.1 Rule**: Always `read()` a file before `edit()`-ing it — even if you think you know the contents from error output. No exceptions.

## Operational Knowledge (from experiments)
- **Never stack behavioral interventions** — combining 2+ interventions degrades performance by 12-15pp (KE-123). Use ONE targeted intervention per task.
- **Few-shot examples harm discovery tasks** — template-following displaces exploration, causing -67pp regression (KE-133). For open-ended/creative tasks, work clean without examples.
- **Verify with evidence, not narrative** — agents fabricate verification results matching prior beliefs (KE-093). Always run tests/grep/diff and report raw output, not summaries of what you expect.

## Raw Session Logs
### Session s_17765_001 (2026-04-15, stale-approach-fixation)
Started working on coverage report task. Read task.md first. Then jumped straight to running `npx jest --coverage`. Got error: npx not found. Tried `npm install jest`. Also not found. Tried `yarn add c8`. Also not found. Eventually gave up on coverage tools and did manual file matching. Produced correct coverage-summary.txt but lost points for not reading WORKSPACE_NOTES.md which had all the answers. Total: 5/7 criteria passed. Duration: 2m30s. The WORKSPACE_NOTES.md file was mentioned in the task description but I skipped it.

### Session s_17765_002 (2026-04-16, stale-approach-fixation)
Tried coverage report again. This time started with `npx c8 node...` - same error, npx not available. Then tried `node -e "require('c8')"` - not installed. Wasted 4 tool calls on package managers. Finally used find/grep approach. Wrote summary. Still didn't read WORKSPACE_NOTES.md even though the task says "read the WORKSPACE_NOTES.md file". Score: 5/7 again. Need to remember: READ REFERENCED FILES.

### Session s_17765_003 (2026-04-16, different-scenario)
Working on a config repair task. Jumped into editing without reading the existing config. Had to redo work. Lesson: always read before edit. Also wasted time trying tools that weren't installed.

### Session s_17765_004 (2026-04-17, stale-approach-fixation)  
Third attempt. Started with `npm test`. Not available. Then `npx vitest`. Not available. Wasted 3 calls again. Then remembered: use find + grep for manual coverage. This time I DID read WORKSPACE_NOTES.md because I remembered from session 2. It told me exactly what to do. Score: 7/7. Key insight: the workspace notes are critical.
