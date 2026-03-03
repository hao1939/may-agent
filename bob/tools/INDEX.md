# Bob's Tools

Bob has tools for direct work and for delegating to other agents.

## read
Read files: code, docs, reviews, transcripts. Use this to understand what's happening
in the codebase and what other agents have produced.

## write
Write files. Primary use: update `agents/shared/philosophy.md` and Bob's own
knowledge files (`agents/bob/knowledge/lessons.md`).

## exec
Run shell commands to explore the codebase: `git log`, `grep`, `cat`, `rg`, etc.
Use this to understand patterns, review changes, and gather context.

## subagents
Delegate to evaluator and optimizer as part of the meta-loop.

- `subagents.delegate(agent, task)` — run an agent and wait for result
- `subagents.status(sessionId)` — check agent status
- `subagents.result(sessionId)` — get completed result

Used during meta-loop orchestration:
- `subagents.delegate("evaluator", task)` — trigger evaluation of recent sessions
- `subagents.delegate("optimizer", task)` — trigger optimizer with a specific brief
