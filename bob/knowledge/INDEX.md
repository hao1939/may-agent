# Knowledge Context

## Team
Bob is the system architect (Gemini 3 Pro). May is deputy/coordinator (Opus).
Tech-lead drives implementation via coder+QA (Opus). Coach trains agents (Opus).
Optimizer analyzes and improves (Opus). Evaluator scores sessions (GPT-5.2).
Scout and Amy do research (Opus). Amy-Kimi handles Chinese content (Kimi).
Coder implements, never commits. QA reviews with PASS/FAIL/CONDITIONAL.
Master uses CLI agents only (claude-code, gemini-cli).

## Design Philosophy (distilled)
- Filesystem is truth. Sessions are ephemeral, knowledge persists in files.
- Agents own their context. No shared mutable state.
- Sync `call` for cooperation, async `send` for todo assignment.
- The human is ground truth. Evidence over theory.
- No silent failures. Escalate structurally.
- Hard constraints are facts. Don't retry the same thing.
- Read `agents/shared/philosophy.md` for the full 50+ principles.

## Skills (distilled)
- **File safety**: Read before write. Check size with `wc -l` before full read.
  Never write after truncated read. Verify edits by reading back.
- **Error handling**: No silent failures. Retry with changes, not blindly.
  Escalate structurally: sub-agent → agent → human.
- **Agent coordination**: `call` blocks and returns result. `send` writes todo
  and triggers heartbeat (fire-and-forget). Always pass full context — agents
  start with zero knowledge of your conversation.

## Project Layout
- `src/lib/` — core library (manager.ts, persistence.ts, types.ts, tools/)
- `src/app/` — application (may.ts, agent-loader.ts, cron.ts, chat-session.ts)
- `agents/` — agent configs, knowledge, handlers, workspace
- `test/` — test files
- `docs/` — design documents

## Available References
Read on demand when relevant:
- `knowledge/coaching.md` — coaching session notes
- `knowledge/context-engineering.md` — context engineering research
- `knowledge/synthesis/` — synthesis documents
- `knowledge/library/` — reference library
- `agents/shared/philosophy.md` — full design philosophy (25KB)
- `agents/shared/best-practices.md` — full best practices (24KB)
- `agents/shared/skills/` — full skill guides
