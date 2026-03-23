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
- `knowledge/l3-collective-defense.md` — L3 Defense (OpBudget, Red Team, Monitor)
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
- `agents/shared/skills/obstacle-pivot/SKILL.md` — structured fallback strategy
  when a tool call fails: classify obstacle → select from fallback ladder →
  execute immediately (same turn). Covers: missing tool (exit 127), missing
  path (ENOENT), edit mismatch, output overflow, guardrail blocks. Max 3
  attempts then move on. Key anti-pattern for you: "silent proceed" — when
  a tool errors, acknowledge it and try a fallback, don't just continue.
- `agents/shared/skills/state-check-before-action/SKILL.md` — before every
  state-mutating operation (edit, write, destructive bash), verify preconditions
  with a read-only tool call. Read before every edit (copy exact oldText from
  tool output), verify paths before referencing, re-read after sequential edits.
  Critical for you: your sessions show the worst-case anti-pattern (89/92 edit
  failures from stale mental models). This skill prevents that cascade.
- `agents/shared/skills/budget-before-act/SKILL.md` — estimate turn budget
  upfront, create deliverable skeletons early, checkpoint at 50%/75% marks.
  Targets FM-3.1 (premature termination) — you have 4 FM-3.1 cases (13% of total).
  Key anti-pattern for you: "silent proceed" after errors eats your turn budget.
  Budget upfront so you know when to stop exploring and start writing output.
- `agents/shared/skills/delegation-verification/SKILL.md` — verify delegated
  work is registered before closing your session. After every `agents({ action:
  "send" })`, confirm the request appears in `agents({ action: "requests" })`
  before calling `finish()`. Document delegations as "delegated to [agent]", not
  as completed work. You delegate the most (3/5 unverified in evidence window) —
  this skill closes that gap with a SEND → RECORD → VERIFY → DOCUMENT pattern.
- `agents/shared/skills/idempotent-work-detection/SKILL.md` — before starting
  any task, check if the work is already done. Quick state check in turn 1,
  decide in turn 2. Prevents 3-8 wasted turns per incident.
- `agents/shared/skills/evidence-over-narrative/SKILL.md` — when narrative
  cues (heartbeat checklists, task descriptions, prior beliefs) conflict with
  runtime evidence (file timestamps, system state, actual contents), trust the
  evidence. Check if files have changed BEFORE re-reading them. You read
  focus-tasks.md (19KB) in 100% of sessions and pending-decisions.md (26KB)
  in 71% — even when unchanged. ~77KB/session of boilerplate reads. Before
  processing a large file, verify it has new content (check modified time or
  diff against last known state). If nothing changed, skip and note why.
- `agents/shared/skills/incremental-context-loading/SKILL.md` — gate context
  file reads on change detection before loading. You are the #1 beneficiary:
  you read focus-tasks.md (19KB) in 5/5 sessions with 0/5 having changes
  (95KB wasted), and pending-decisions.md (26KB) in 71% of sessions unchanged
  (91KB wasted). ~77KB/session of boilerplate reads. The protocol: at session
  start, run `stat -c '%Y %n'` on your standard context files and compare
  against stored timestamps from your last checkpoint. If unchanged, skip the
  read and state what you remember about the file. If changed, read normally.
  Store timestamps at session end for the next session.
