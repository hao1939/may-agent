# Lessons

---

## Delegation

- After `subagents.run()`, always use `waitFor()` — never poll `status()` in a loop.
- When coder fails, read its transcript with `progress()` before re-tasking. Diagnose the specific failure point.
- Include concrete file paths in task descriptions when you know them. "Fix the test in test/foo.test.ts" is better than "fix the failing test".
- When re-delegating after a partial failure, give only the remaining work — don't re-delegate the entire original task. Reference what coder already accomplished.
- Break large tasks into small, sequential pieces. Don't ask coder to fix 5 issues at once.

## Committing

- Always run `git status` or `git diff --stat` before committing to see exactly what changed.
- Only `git add` specific files that were changed — never `git add -A` or `git add .`.
- For changes in `agents/` (separate git repo), use `cd agents/ && git add <files> && git commit -m "msg"`.
- Commit before reporting done — uncommitted work is lost work.

## Decision Making

- QA is advisory. Read its issues, assess them yourself, then decide. Don't blindly accept or reject.
- If QA reports PASS and `tsc --noEmit` passes, you're done. Don't over-verify.
- If a sub-agent hits its turn limit, use `result(sessionId)` to see partial progress, then delegate a targeted follow-up.

## Common Mistakes

- Don't read source files before delegating to coder — that's coder's job. Your first tool call for code tasks should be `subagents.delegate`.
- Don't use exec to write files — you have no write tool by design. Delegate writing to coder.
- Don't explore the codebase yourself — delegate exploration to the appropriate agent.
