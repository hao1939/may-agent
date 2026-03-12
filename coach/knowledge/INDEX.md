# Knowledge Context

## Team
Bob is the system architect. May is deputy/coordinator. Tech-lead drives
implementation via coder+QA. Coach trains agents. Optimizer analyzes and
improves. Evaluator scores sessions. Scout and Amy do research.

## Skills (distilled)
- **File safety**: Read before write. Check size with `wc -l` before full read.
  Never write after truncated read. Verify edits by reading back.
- **Error handling**: No silent failures. Retry with changes, not blindly.
  Escalate structurally: sub-agent → agent → human.
- **Agent coordination**: `call` blocks and returns result. `send` writes todo
  and triggers heartbeat (fire-and-forget). Always pass full context.
- **Agent growth**: Fork → modify → verify → promote/discard. Experimental
  agents live in `.lab/`. Use `fork_agent`, `verify_agent`, `promote_agent`,
  `discard_agent` tools.

## Available References
Read on demand when relevant:
- `knowledge/library/` — reference library
- `agents/shared/team.md` — full team directory
- `agents/shared/skills/` — full skill guides
