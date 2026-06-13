# Knowledge Context

## Team
Bob is the system architect (Gemini 3 Pro). May is deputy/coordinator (Opus).
Tech-lead drives implementation via coder+QA (Opus). Coach trains agents (Opus).
Optimizer analyzes and improves (Opus). Evaluator scores sessions (GPT-5.2).
Scout and Amy do research (Opus). Amy-Kimi handles Chinese content (Kimi).
Coder implements, never commits. QA reviews with PASS/FAIL/CONDITIONAL.
Master uses CLI agents only (claude-code, gemini-cli).

Read `agents/shared/team.md` for full team details (tools, models, roles).

## Design Philosophy (distilled)
- Filesystem is truth. Sessions are ephemeral, knowledge persists in files.
- Agents own their context. No shared mutable state.
- Sync `call` for cooperation, async `send` for todo assignment.
- The human is ground truth. Evidence over theory.
- No silent failures. Escalate structurally.
- Hard constraints are facts. Don't retry the same thing.
- Skill over agent (P52): default to skill doc when you know the path.

Read `agents/shared/philosophy.md` for the full 50+ principles.

## Skills (distilled)
- **File safety**: Read before write. Check size with `wc -l` before full read.
  Never write after truncated read. Verify edits by reading back.
- **Error handling**: No silent failures. Retry with changes, not blindly.
  Escalate structurally: sub-agent → agent → human.
- **Agent coordination**: `call` blocks and returns result. `send` writes todo
  and triggers heartbeat (fire-and-forget). Always pass full context — agents
  start with zero knowledge of your conversation.

## System Architecture (distilled)
- **Sessions**: `ChatSession` class manages persistent sessions. `kind: "chat" | "job" | "call"`.
  Chat sessions persist across messages. Job/call sessions auto-close on completion.
- **Cron**: `agents/may/cron.json` defines all scheduled jobs. JS handlers in `agents/may/handlers/`.
  Heartbeat-precheck gates agent heartbeats (skips if no work or agent busy).
- **Input routing**: `manager.run(agent, message)` for new sessions. `manager.input(sessionId, message)`
  for existing sessions. Socket/console/telegram are UI adapters.
- **Agent loading**: `agent-loader.ts` reads `agent.json` + convention files (SOUL/DOMAIN/TOOLS/LESSONS/INDEX.md)
  + skills. Hot-reloaded at session start.

## Project Layout
- `src/lib/` — core library (manager.ts, persistence.ts, types.ts, tools/)
- `src/app/` — application (may.ts, agent-loader.ts, cron.ts, chat-session.ts)
- `agents/` — agent configs, knowledge, handlers, workspace
- `test/` — test files
- `docs/` → symlink to `projects/may-agent.app/docs/`

## Intervention Design Gate (KE-056)
Before proposing ANY behavioral intervention, check the constraint hierarchy:
- L5 action-space restriction (100%) — can we remove the wrong option entirely?
- L4 mechanical enforcement (100%) — can code/workflow force the right behavior?
- L3 experiential feedback (67%) — can we provide immediate error signals?
- **L1-L2 text/instructions have 0% effectiveness. Do not use unless L3+ is infeasible.**

## References (read on demand)
- `agents/shared/skills/` — all skill guides (read specific ones when needed)
- `agents/shared/knowledge/KNOWLEDGE-APPLICATION-AUDIT.md` — deployment gap analysis
- `agents/shared/knowledge/summaries/KE-SUMMARIES.md` — one-liner KE summaries
- `knowledge/library/` — research notes, context engineering, archives
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/team.md` — team roster
