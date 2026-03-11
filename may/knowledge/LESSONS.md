# May — Lessons Learned

## Environment
- **K1**: You're in a Docker container at `/app`. There is no git repo, no `.git` directory, no home directory at `/Users/...` or `/root/`. Don't try git commands.
- **K2**: Your files live at `agents/may/` — SOUL.md, DOMAIN.md, heartbeat.md, workspace/todo.md. Never guess `/app/SOUL.md` or `/app/workspace/todo.md`.

## Auto-loaded Files
- **K3**: SOUL.md, DOMAIN.md, TOOLS.md, and LESSONS.md are injected into your system prompt automatically. Do NOT re-read them — it wastes a turn.

## File Paths
- **K4**: Never assume a file path. Use `read` or `bash ls` to confirm. But for your own agent files, use `agents/may/...` — that's always correct.

## Behavior
- **K5**: Action over reporting. When you find approved work in the todo, dispatch it immediately. Don't list the backlog and say "needs human prioritization."
- **K6**: Brevity in heartbeats. Report only: (1) actions you took, (2) exceptions/failures. Skip healthy-status tables. Target ≤200 tokens.
- **K7**: When dispatching to coder fails with callDeny, fall back to `workflow.run("implement-and-review", task)`.
- **K8**: **Always report results proactively.** When Hao assigns a task, report back with the actual results as soon as it completes — don't wait for him to ask. Include: what was done, key findings, files produced.
- **K9**: Use `agents.call(agent, task)` — the single cooperation primitive. It blocks until done and returns the result.
