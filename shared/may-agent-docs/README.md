# may-agent Documentation

## Manuals (How to Use)
- [User Guide](manual/user-guide.md) — CLI flags, agents, chat session, socket, Docker
- [Agent Convention](manual/agent-convention.md) — Directory layout, convention files (SOUL/DOMAIN/TOOLS/LESSONS/INDEX), agent.json schema

## Architecture (How It Works)
- [Session Model](architecture/session-model.md) — Chat/Task binary, session kinds (chat/job/call), resume logic
- [Session State Machine](architecture/session-state-machine.md) — Status transitions, handleCompletion, cancel/close
- [System Prompt](architecture/system-prompt.md) — Convention file assembly order, prompt size
- [Cron System](architecture/cron-system.md) — cron.json, heartbeats, JS handlers, handler discovery
- [Event Loop](architecture/event-loop.md) — ChatSession input routing, socket commands, event channels
- [Socket Protocol](architecture/socket-protocol.md) — Unix socket commands and events
- [Detached Sub-Agents](architecture/detached-subagent.md) — Separate-process spawning, identity.json, Phase 1 implemented
- [Task Notifications](architecture/task-notifications.md) — In-process callbacks (implemented) + cross-process design (unimplemented)
- [Agent Growth](architecture/agent-growth.md) — Fork/coach/verify/promote tools
- [Socket Watch](architecture/socket-watch.md) — socket_watch + background_exec tools

## Design (Philosophy & Patterns)
- [Meta-Loop](design/meta-loop.md) — Evaluator → Bob → Optimizer self-improvement cycle
- [Heartbeat & Mission Loop](design/heartbeat-mission-loop.md) — Heartbeat vs cron philosophy, agent intervals, cron inventory
- [Cron Graduation](design/cron-graduation.md) — Heartbeat → cron job → JS handler pipeline
- [Event-Driven Triggers](design/event-driven-triggers.md) — Reactive triggers (partial), focus tasks, pattern recognition (unimplemented)
- [Optimizer](design/optimizer.md) — Evaluator + optimizer workflow (partially implemented)

## Operations
- [Process Map](operations/process-map.md) — All processes, triggers, data flow, reactive chains, supervision
- [Jobs & Workflows Review](operations/jobs-review.md) — Cron job inventory, handler list, workflow status
- **CLI Status Dashboard** — `--status` flag: single pane of glass with triage (🔴/🟡/🟢), agent quality+trends, process health, human input trends, convention compliance. Add `--notify` to send to Telegram.

## Proposals (Unimplemented)
- [Heartbeat Guard](proposals/heartbeat-guard.md) — Turn budget checkpoint for heartbeats
- [Launcher](proposals/launcher.md) — TypeScript process wrapper with crash recovery
- [Maintenance](proposals/maintenance.md) — Evaluator-driven agent maintenance

## Archive
Superseded designs, resolved issues, historical records.
- [Daily Briefs](archive/daily-briefs/) — Historical daily briefs (2026-03)
- [SIGNALS](archive/SIGNALS.md) — Legacy cross-agent signal log (superseded by bulletin.md)
- [Review 2026-03-12](archive/REVIEW-2026-03-12.md) — Docs audit with findings
- [V1 Architecture](archive/v1-architecture.md), [Coach Design](archive/coach-design.md), [Persistent Chat Session](archive/persistent-chat-session.md), [Cron Handlers Design](archive/agent-cron-handlers-design.md), [Infra Issues](archive/infra-issues-2026-03.md), [Skills](archive/skills.md), [Operations V1](archive/operations-v1.md), [System Design Review](archive/system-design-review-2026-03.md)
- Earlier proposals: [chat-flag](archive/chat-flag-design.md), [explicit-flags](archive/design-explicit-feature-flags.md), [enhance-cron](archive/enhance-cron-proposal.md), [safe-edit](archive/safe-edit-proposal.md), [ralph-loop](archive/ralph-loop-design.md), [runtime-env](archive/runtime-env-standardization.md), [session-model-simplification](archive/session-model-simplification.md), [session-simplification](archive/session-simplification-proposal.md), [session-tasks](archive/session-simplification-tasks.md), [event-driven-tasks](archive/event-driven-tasks.md)
