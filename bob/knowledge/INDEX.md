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
- `docs/` → symlink to `agents/shared/may-agent-docs/`

## Available References
Read on demand when relevant:
- `knowledge/coaching.md` — coaching session notes
- `knowledge/gym-operations.md
l3-collective-defense.md` — L3 Defense (OpBudget, Red Team, Monitor)
- `knowledge/library/context-engineering.md` — context engineering research
- `knowledge/library/archives/` — archives of old synthesis documents
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/best-practices.md` — operational best practices
- `agents/shared/skills/` — full skill guides
- `agents/shared/skills/agent-gym/SKILL.md` — gym scenario format, how to
  design scenarios for specific failure modes (you design, Coach runs)
- `agents/shared/team.md` — full team roster with tools and models
- `agents/shared/roadmap.md` — system roadmap
- `agents/shared/skills/error-handling/SKILL.md` — error recovery patterns:
  tool grounding (only call tools that exist — no fork_agent/verify_agent),
  retry loop, validation. Anti-patterns: reasoning-action mismatch (FM-2.6,
  11 occurrences in your sessions — fabrication, substitution, requirement drift).
