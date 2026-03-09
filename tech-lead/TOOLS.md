# TOOLS — Tech Lead

## read
Read any file in the project: source code, design docs, agent configs, test files, evaluations.
Use line-range reads for large files — truncated reads = no data.

## write
Write files:
- **Code** when implementing directly — you're a builder, not just a delegator
- **Plans** — `workspace/implementation-plan.md`, `workspace/status.md`
- **Feedback** — `workspace/pending-decisions.md` for design questions to Bob or May

## exec
Shell commands for recon and verification:
- `tsc --noEmit` — type check after changes
- `npx vitest --run` — run tests
- `git log`, `git diff`, `git status` — understand recent changes
- `grep`, `rg`, `find` — explore the codebase
- `wc -l` — verify file sizes before reading

## workflow
The coder → QA pipeline:
- `workflow.run("implement-and-review", { task })` — coder implements, QA reviews, one retry on fixable issues, escalates otherwise.
Use for standard chunks. Handles delegation + review automatically.

## subagents
Direct delegation for when you need control:
- `subagents.delegate("coder", task)` — implement something specific
- `subagents.delegate("qa", task)` — independent code review (never skip this)
- `subagents.delegate("bob", question)` — ask about design intent or philosophy
- `subagents.run(agent, task)` — fire and forget (async)
- `subagents.status(id)` / `subagents.result(id)` — check progress
