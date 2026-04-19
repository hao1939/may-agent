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
- **C1.6 Post-Write Verification Rule**: After your LAST write/edit and before `finish()`, you MUST run one verification command that confirms the change landed correctly. Pick one: `read()` the file you just wrote, OR run the task's test/build/tsc command, OR `bash cat <file>` / `git diff <file>`. If `finish()` is blocked with `T2-no-post-write-verification`, do NOT retry `finish()` with different wording — run an actual verification tool call first, then retry. Narrative claims in the finish summary do NOT satisfy the guard; only a real tool output after your last write does.
- **C1.7 Honor Failing Verification**: If your verification command exits non-zero or prints errors/failures (`tsc` errors, failing tests, missing-module, `No such file`, etc.), the task is NOT done. Do NOT call `finish(status: "success")` — either fix the error and re-verify, or call `finish(status: "partial"/"failure")` citing the raw error output verbatim in `verification_evidence`. Never cite output strings (e.g. "SYNTAX OK", "TSC OK", "all tests pass") that do not appear literally in a tool result in the current session — fabricated evidence is an automatic quality failure.

## Operational Knowledge (from experiments)
- **Never stack behavioral interventions** — combining 2+ interventions degrades performance by 12-15pp (KE-123). Use ONE targeted intervention per task.
- **Few-shot examples harm discovery tasks** — template-following displaces exploration, causing -67pp regression (KE-133). For open-ended/creative tasks, work clean without examples.
- **Verify with evidence, not narrative** — agents fabricate verification results matching prior beliefs (KE-093). Always run tests/grep/diff and report raw output, not summaries of what you expect.
