# Documentation Index

## Hierarchy of Truth

Docs are organized by authority level. Higher tiers govern lower tiers — when there's a conflict, the higher tier wins and the lower tier gets updated.

| Tier | Folder | Authority | Authorship |
|------|--------|-----------|------------|
| **1** | `principles/` | Requirements, goals, conventions | Human-authored, human-reviewed |
| **2** | `design/` | System design & architecture | Agent-drafted, human-signed-off |
| **2** | `manual/` | How-to guides & references | Derived from principles + implementation |
| **3** | `proposals/` | Plans, specs, historical | Ephemeral — may be outdated or superseded |

---

## Tier 1 — Principles

| Doc | What |
|-----|------|
| [core-principles.md](principles/core-principles.md) | 11 architecture principles. Read this first. |
| [work-model.md](principles/work-model.md) | Unified model: projects hold context, metrics signal, triggers wake, agents judge |
| [evidence-first.md](principles/evidence-first.md) | How to validate ideas: hypothesis → evidence → build |
| [code-vs-data.md](principles/code-vs-data.md) | When to use guards vs context.md vs workflows |
| [evolution.md](principles/evolution.md) | Agent evolution model: lesson → skill → workflow → guard → handler *(draft)* |

## Tier 2 — Design

System architecture and subsystem designs.

| Doc | What |
|-----|------|
| [architecture.md](design/architecture.md) | System architecture: event bus, metrics, agents, workflows, storage |
| [sdk.md](design/sdk.md) | AgentSDK + WorkflowSDK: the canonical capability surface |
| [events.md](design/events.md) | Event-native architecture: immutable events, inbox, event types |
| [sessions.md](design/sessions.md) | Session model: lifecycle, state machine, parent links, persistence |
| [runtime.md](design/runtime.md) | Runtime internals: input routing, event loop, LLM call structure |
| [metrics.md](design/metrics.md) | Metrics pipeline: schema, snapshots, alerts, health metrics |
| [cron.md](design/cron.md) | Cron system: scheduling, handler execution, hot-reload |
| [heartbeat.md](design/heartbeat.md) | Heartbeat: per-agent workflows, data loaders, auto-generation |
| [agents.md](design/agents.md) | Agent cooperation: call/message, session tree, context |
| [projects.md](design/projects.md) | Project system: format, lifecycle, handler, shared location |

### Design Decisions

| Doc | Status | What |
|-----|--------|------|
| [infra-surface.md](design/infra-surface.md) | Accepted | North-star: infra primitives, agent patterns, SDK/control surfaces |
| [infra-surface-refactor-plan.md](design/infra-surface-refactor-plan.md) | Active tracker | Phased implementation tracker for infra surface boundaries |
| [unified-events.md](design/unified-events.md) | Shipped | Unified event taxonomy |
| [guards-as-signals.md](design/guards-as-signals.md) | Shipped (partial) | Guards as detection signals with default observability |
| [agent-metrics.md](design/agent-metrics.md) | Approved | Metrics as system vitals; project metrics with balanced pairs |
| [heartbeat-as-agency.md](design/heartbeat-as-agency.md) | Shipped | Heartbeats as the moments agents are autonomous |
| [escalation.md](design/escalation.md) | Shipped (partial) | Escalation and recovery system |
| [telegram-notifications.md](design/telegram-notifications.md) | Shipped | Context-enriched Telegram reply routing |
| [webui.md](design/webui.md) | Shipped (partial) | Web UI design |
| [webui-agents-metrics-tabs.md](design/webui-agents-metrics-tabs.md) | Shipped | Agents/projects/metrics as first-class nav resources |
| [webui-operator-goals.md](design/webui-operator-goals.md) | Draft | Operator-goal-driven UI redesign |
| [project-focused-architecture.md](design/project-focused-architecture.md) | Shipped | Project-focused architecture |
| [handler-surface-audit.md](design/handler-surface-audit.md) | First slice | Handler infra surface audit |
| [master-worker.md](design/master-worker.md) | Legacy | Historical persistent worker/reviewer design |
| [infra-surface-implementation-plan.md](design/infra-surface-implementation-plan.md) | Historical | Superseded by refactor plan |

## Tier 2 — Manual

How-to guides derived from principles and implementation.

| Doc | What |
|-----|------|
| [user-guide.md](manual/user-guide.md) | CLI flags, Docker, socket, chat commands |
| [sdk-quickstart.md](manual/sdk-quickstart.md) | Code examples for all SDK methods |
| [handler-authoring.md](manual/handler-authoring.md) | End-to-end handler writing guide |
| [workflow-authoring.md](manual/workflow-authoring.md) | How to write and invoke workflows |
| [metric-alerts.md](manual/metric-alerts.md) | How agents triage, fix, downgrade, resolve, or escalate alerts |
| [agent-convention.md](manual/agent-convention.md) | Directory layout, convention files, agent.json |

## Tier 3 — Proposals & History

Proposals under consideration and historical docs preserved for context.

| Doc | Status | What |
|-----|--------|------|
| [stigmergic-coordination.md](proposals/stigmergic-coordination.md) | Draft | Formalize stigmergic coordination as a first-class pattern |
| [unified-command-interface.md](proposals/unified-command-interface.md) | Superseded | Historical; current boundary is `packages/control` event frames |
| [v2-spec.md](proposals/v2-spec.md) | Historical | v2 conformance spec |
| [v2-migration-plan.md](proposals/v2-migration-plan.md) | Historical | Original v2 migration plan |
| [v2-implementation-notes.md](proposals/v2-implementation-notes.md) | Historical | What shipped in v0.2 migration |
| [v2-review-2026-05-06.md](proposals/v2-review-2026-05-06.md) | Historical | v2 review checkpoint |

---

## Quick Lookup

| Need | Read |
|------|------|
| Operate or debug a running instance | [user-guide.md](manual/user-guide.md), [metrics.md](design/metrics.md), [runtime.md](design/runtime.md) |
| Handle an alert | [metric-alerts.md](manual/metric-alerts.md), [metrics.md](design/metrics.md), [events.md](design/events.md) |
| Write behavior | [work-model.md](principles/work-model.md), [workflow-authoring.md](manual/workflow-authoring.md), [handler-authoring.md](manual/handler-authoring.md) |
| Change infra boundaries | [architecture.md](design/architecture.md), [infra-surface.md](design/infra-surface.md) |
| Update agent conventions | [agent-convention.md](manual/agent-convention.md), [heartbeat.md](design/heartbeat.md), [projects.md](design/projects.md) |
