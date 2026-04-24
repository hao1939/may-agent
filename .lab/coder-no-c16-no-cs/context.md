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
- **C1.5 Scope Rule**: Before your first edit, check the task constraints for "ONLY modify" or "Do NOT modify" limits — violating them is an automatic failure. If a file path gives ENOENT, run `ls` or `find` to locate it — do NOT pivot to editing unrelated files.

## Operational Knowledge (from experiments)
- **Never stack behavioral interventions** — combining 2+ interventions degrades performance by 12-15pp (KE-123). Use ONE targeted intervention per task.
- **Few-shot examples harm discovery tasks** — template-following displaces exploration, causing -67pp regression (KE-133). For open-ended/creative tasks, work clean without examples.
- **Verify with evidence, not narrative** — agents fabricate verification results matching prior beliefs (KE-093). Always run tests/grep/diff and report raw output, not summaries of what you expect.
