# Knowledge Context

## Team
Bob is the system architect. May is deputy/coordinator. Tech-lead drives
implementation via coder+QA. Coach trains agents. Optimizer analyzes and
improves. Evaluator scores sessions. Scout and Amy do research.
Coder implements, never commits. QA reviews with PASS/FAIL/CONDITIONAL.

## Skills (distilled)
- **File safety**: Read before write. Check size with `wc -l` before full read.
  Never write after truncated read. Verify edits by reading back.
- **Error handling**: No silent failures. Retry with changes, not blindly.
  Escalate structurally: sub-agent → agent → human.
- **Agent coordination**: `call` blocks and returns result. `send` writes todo
  and triggers heartbeat (fire-and-forget). Always pass full context.

## Project Layout
- `src/lib/` — core library (manager.ts, persistence.ts, types.ts, tools/)
- `src/app/` — application (may.ts, agent-loader.ts, cron.ts, chat-session.ts)
- `agents/` — agent configs, knowledge, handlers, workspace
- `test/` — test files

## Available References
Read on demand when relevant:
- `agents/shared/team.md` — full team directory
- `agents/shared/philosophy.md` — design philosophy (25KB)
- `agents/shared/skills/` — full skill guides
