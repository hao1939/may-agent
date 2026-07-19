# Documentation Index

## Hierarchy of Truth

Docs are organized by authority level. Higher tiers govern lower tiers — when there's a conflict, the higher tier wins and the lower tier gets updated.

| Tier | Folder | Authority | Authorship |
|------|--------|-----------|------------|
| **1** | `1-principles/` | Requirements, goals, conventions | Human-authored, human-reviewed |
| **2a** | `2a-design/` | System design & architecture | Agent-drafted, human-signed-off |
| **2b** | `2b-manual/` | How-to guides & references | Derived from principles + implementation |
| **3** | `3-proposals/` | Plans, specs, historical | Ephemeral — may be outdated or superseded |

---

## Tier 1 — Principles

| Doc | What |
|-----|------|
| [core-principles.md](1-principles/core-principles.md) | 11 architecture principles. Read this first. |
| [work-model.md](1-principles/work-model.md) | Unified model: projects hold context, metrics signal, triggers wake, agents judge |
| [evidence-first.md](1-principles/evidence-first.md) | How to validate ideas: hypothesis → evidence → build |
| [code-vs-data.md](1-principles/code-vs-data.md) | When to use guards vs context.md vs workflows |
| [evolution.md](1-principles/evolution.md) | Evidence-backed knowledge encoding and mechanism selection *(draft)* |

## Tier 2 — Design

System architecture and subsystem designs.

| Doc | What |
|-----|------|
| [system-model.md](2a-design/system-model.md) | Compact governing model: objects, ownership, execution, closure, and reliability. Read this before subsystem designs. |
| [architecture.md](2a-design/architecture.md) | System architecture: event bus, metrics, agents, workflows, storage |
| [storage.md](2a-design/storage.md) | Runtime storage: authoritative artifacts, bounded SQLite projections, migration, and maintenance |
| [sdk.md](2a-design/sdk.md) | AgentSDK + WorkflowSDK: the canonical capability surface |
| [events.md](2a-design/events.md) | Event-native architecture: delivery, inbox, event types |
| [event-graph.md](2a-design/event-graph.md) | Event trace graph: causality, closure links, delivery evidence, and graph read model |
| [sessions.md](2a-design/sessions.md) | Session model: lifecycle, state machine, parent links, persistence |
| [runtime.md](2a-design/runtime.md) | Runtime internals: input routing, event loop, LLM call structure |
| [human-control-surfaces.md](2a-design/human-control-surfaces.md) | Shared CLI, Telegram, Web, and console contract: targeted sessions and event-shaped human intents |
| [native-coding-workers.md](2a-design/native-coding-workers.md) | Native coding workers: Codex/Claude CLI adapter model, event contract, session continuity |
| [metrics.md](2a-design/metrics.md) | Metrics: schema, pipeline, alerts, registry, balanced pairs, blind spots |
| [cron.md](2a-design/cron.md) | Cron system: scheduling, handler execution, hot-reload |
| [heartbeat.md](2a-design/heartbeat.md) | Heartbeat: per-agent workflows, data loaders, auto-generation |
| [agents.md](2a-design/agents.md) | Agent cooperation: call/message, session tree, context |
| [projects.md](2a-design/projects.md) | Project system: V3 app layout, lifecycle, task tree, legacy compatibility |
| [project-app-v3.md](2a-design/project-app-v3.md) | Final project-app model: sibling `*.app`, owner-first events, app/runtime/domain boundary |
| [app-project-integrity.md](2a-design/app-project-integrity.md) | Compact integrity contract tying project apps, events, task trees, metrics, and escalation together |
| [app-root-layout.md](2a-design/app-root-layout.md) | Repository-root classification: durable source, runtime state, project workspaces, and scratch |
| [task-tree-engine.md](2a-design/task-tree-engine.md) | Task tree data/tool model: owner review, worker completion, Kanban projection, human steering |
| [default-project-ui.md](2a-design/default-project-ui.md) | Shared project operating readout and structured steering contract |

### Design Status And Convergence

| Doc | Status | What |
|-----|--------|------|
| [system-boundary.md](2a-design/system-boundary.md) | Accepted / mostly implemented | North-star: infra primitives, agent patterns, SDK/control surfaces |
| [system-boundary-tracker.md](proposals/system-boundary-tracker.md) | Historical tracker | Completed/superseded handler-centric migration record; retained outside the accepted design tier |
| [guards.md](2a-design/guards.md) | Accepted / partial | Guards as detection signals with default observability |
| [escalation.md](2a-design/escalation.md) | Accepted / partial | Owner-boundary escalation contract; terminal handling and closure health still converge |
| [telegram-notifications.md](2a-design/telegram-notifications.md) | Accepted / partial | Channel envelope shipped; interaction refinement remains |
| [webui.md](2a-design/webui.md) | Accepted / partial | Web UI design: surfaces, steering, nav; modular-route subsection remains draft |
| [http-boundary.md](2a-design/http-boundary.md) | Accepted / partial | Separate HTTP adapter from webui package |
| [session-eval-trail.md](2a-design/session-eval-trail.md) | Draft / partial | Summary projection plus append-only line evidence beside raw session logs |
| [practice-learning-loop.md](2a-design/practice-learning-loop.md) | Draft / partial | Event-rooted learning loop from eval evidence through owner action and later validation |
| [skills.md](2a-design/skills.md) | Accepted / implemented core | Scoped discovery, bounded catalogs, per-turn invocation, and load evidence |
| [workflows.md](2a-design/workflows.md) | Accepted / implemented core | Validated TypeScript catalogs, entry provenance, lifecycle events, and safe replay |
| [may-console.md](2a-design/may-console.md) | Draft / partial | Terminal REPL over the daemon socket, session switching, and canonical steering intents |
| [web-terminal.md](2a-design/web-terminal.md) | Draft / partial | Browser terminal transport and tmux ownership contract |
| [handler-audit.md](2a-design/handler-audit.md) | Tracker | Handler migration audit governed by architecture, cron, and system-boundary design |

## Tier 2 — Manual

How-to guides derived from principles and implementation.

| Doc | What |
|-----|------|
| [user-guide.md](2b-manual/user-guide.md) | CLI flags, Docker, socket, chat commands |
| [sdk-quickstart.md](2b-manual/sdk-quickstart.md) | Code examples for all SDK methods |
| [handler-authoring.md](2b-manual/handler-authoring.md) | End-to-end handler writing guide |
| [workflow-authoring.md](2b-manual/workflow-authoring.md) | How to write and invoke workflows |
| [metric-alerts.md](2b-manual/metric-alerts.md) | How agents triage, fix, downgrade, resolve, or escalate alerts |
| [event-runtime-audit.md](2b-manual/event-runtime-audit.md) | How to compare live event emitters, consumers, delivery, and pair health against the design |
| [guard-runtime-audit.md](2b-manual/guard-runtime-audit.md) | How to inspect live guard volume, repeat signals, and threshold quality |
| [agent-convention.md](2b-manual/agent-convention.md) | Directory layout, convention files, agent.json |

## Tier 3 — Proposals & History

Proposals under consideration and historical docs preserved for context.

| Doc | Status | What |
|-----|--------|------|
| [agent-app-boundary-refinement.md](3-proposals/agent-app-boundary-refinement.md) | Draft | Make agent execution independently runnable, move workflows under agents, and treat Kubernetes-style task reconciliation as optional autonomy; identity renaming is explicitly deferred. |
| [implementation-simplification.md](3-proposals/implementation-simplification.md) | Draft / partial implementation | Converge direct and hosted agent-definition/tool loading, eliminate hidden direct capability loss, and make Gym restrictions explicit and reviewable. |
| [agent-app-scenario-audit-2026-07-16.md](3-proposals/agent-app-scenario-audit-2026-07-16.md) | Design review | Exercise the Agent App proposal against idle, production, Gym, live-diagnostic, parallel, multi-app, and recovery scenarios |
| [agent-app-runtime-model.md](3-proposals/agent-app-runtime-model.md) | Draft / partial implementation | Unify app and owner agent as one public Agent App while keeping policy and durable task runtime as separate, evaluable layers |
| [system-operations-model.md](3-proposals/system-operations-model.md) | Accepted concepts / partial implementation | Ops health as may-agent.app responsibility; remaining migration is tracked in the document |
| [chat-agent-separation.md](3-proposals/chat-agent-separation.md) | Draft / partial implementation | Separate persistent chat execution from bounded jobs while preserving the shared event and trace model |
| [stigmergic-coordination.md](3-proposals/stigmergic-coordination.md) | Draft | Formalize stigmergic coordination as a first-class pattern |
| [retired-design-alternatives.md](3-proposals/retired-design-alternatives.md) | Thoughts / alternatives | Useful ideas preserved from deleted legacy design archive |

Old V2 project-app proposals were moved to [`archive/v2/`](archive/v2/). They
are historical only; [project-app-v3.md](2a-design/project-app-v3.md) is the
single current project-app design.

Dated implementation records under [`proposals/`](proposals/) are historical
evidence, not Tier 2 contracts. Completed records remain useful for migration
rationale; unresolved findings must link to the active design or tracker that
owns convergence.

---

## Removed Archive

The old `2a-design/archive-legacy-shared-designs/` files were deleted because
their direct-read statuses conflicted with active docs. Useful ideas were
preserved in
[retired-design-alternatives.md](3-proposals/retired-design-alternatives.md).

---

## Quick Lookup

| Need | Read |
|------|------|
| Understand the whole system | [system-model.md](2a-design/system-model.md), [core-principles.md](1-principles/core-principles.md) |
| Operate or debug a running instance | [user-guide.md](2b-manual/user-guide.md), [metrics.md](2a-design/metrics.md), [event-runtime-audit.md](2b-manual/event-runtime-audit.md), [guard-runtime-audit.md](2b-manual/guard-runtime-audit.md), [runtime.md](2a-design/runtime.md) |
| Handle an alert | [metric-alerts.md](2b-manual/metric-alerts.md), [metrics.md](2a-design/metrics.md), [events.md](2a-design/events.md) |
| Write behavior | [work-model.md](1-principles/work-model.md), [skills.md](2a-design/skills.md), [workflows.md](2a-design/workflows.md), [workflow-authoring.md](2b-manual/workflow-authoring.md), [handler-authoring.md](2b-manual/handler-authoring.md) |
| Change infra boundaries | [architecture.md](2a-design/architecture.md), [system-boundary.md](2a-design/system-boundary.md) |
| Update agent conventions | [agent-convention.md](2b-manual/agent-convention.md), [heartbeat.md](2a-design/heartbeat.md), [projects.md](2a-design/projects.md) |
