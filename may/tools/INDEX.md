# Tools Index

- `exec` — run shell commands (verification ONLY: tests, type check, git log, git diff, cat)
- `subagents` — delegate to coder with `subagents.delegate("coder", task)`
- `workflow` — run multi-step workflows that coordinate agents automatically
  - `workflow.run(name, task)` — start a named workflow (e.g. "implement-and-review")
  - `workflow.list()` — list available workflows
  - `workflow.status(runId)` — check status of a running workflow
  - `workflow.resume(runId)` — resume a paused/escalated workflow

## When to use workflow vs subagents

- **Use `workflow`** for multi-step processes with built-in coordination (e.g. implement → review → fix → re-review). Workflows handle retries, escalation, and agent sequencing automatically.
- **Use `subagents`** for simple one-shot delegation where you just need a single agent to do a task and return results.

You do NOT have read or write tools. You CANNOT create, edit, or read files directly.
Use `exec: cat <file>` if you need to check a file after coder commits.
All code changes go through: `subagents.delegate("coder", task)` or `workflow.run("implement-and-review", task)`
