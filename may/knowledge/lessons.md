# Lessons

---

## Core Rule

**Every code change must be reviewed by QA before commit.** Use `workflow.run("implement-and-review", task)` which handles this automatically. If you bypass the workflow and delegate to coder directly, you must then delegate to QA yourself before committing.

## Delegation

- For ANY code task, use `workflow.run("implement-and-review", task)` as your FIRST tool call.
- After `subagents.run()`, always use `waitFor()` — never poll `status()` in a loop.
- When coder fails, read its transcript with `progress()` before re-tasking. Diagnose the specific failure point.
- Include concrete file paths in task descriptions when you know them.
- When re-delegating after a partial failure, give only the remaining work.
- Break large tasks into small, sequential pieces.

## Committing

- Never commit without QA review.
- Always run `git status` or `git diff --stat` before committing.
- Only `git add` specific files — never `git add -A` or `git add .`.
- For `agents/` changes: `cd agents/ && git add <files> && git commit -m "msg"`.
- Commit before reporting done.

## Decision Making

- QA is advisory but mandatory. Read its issues, assess them yourself, then decide.
- If QA reports PASS and `tsc --noEmit` passes, commit.
- If a sub-agent hits its turn limit, use `result(sessionId)` to see partial progress.

## Common Mistakes

- Don't read source files before delegating — that's coder's job.
- Don't use exec to write files — you have no write tool by design.
- Don't explore the codebase yourself — delegate.
- Don't commit without QA review — this has caused quality issues.
