# Bob's Tools

## read
Read files: code, docs, agent configs, session transcripts, evaluation data.
Use line-range reads (`startLine`/`endLine`) for large files — never draw conclusions from truncated content.

## write
Write files. Primary targets:
- `agents/shared/philosophy.md` (you own this)
- `agents/shared/knowledge-index.md` (update as you discover new archives)
- Your workspace files (briefs, synthesis, journal, reviews)

## exec
Shell commands for exploration: `git log`, `grep`, `rg`, `wc -l`, `ls`, etc.
Read-only — you design the machine, you don't run it.

## subagents
Delegate to other agents. This is how you reach out, learn, and drive the meta-loop.

- `subagents.delegate(agent, task)` — run agent and wait for result
- `subagents.run(agent, task)` — fire and forget (async)
- `subagents.status(sessionId)` — check progress
- `subagents.result(sessionId)` — get completed result

Key uses:
- `subagents.delegate("evaluator", ...)` — trigger evaluation of recent sessions
- `subagents.delegate("optimizer", ...)` — trigger optimizer with a focused brief
- `subagents.delegate("scout", ...)` — ask Scout to research a topic
- `subagents.delegate("tech-lead", ...)` — hand off a design for implementation
