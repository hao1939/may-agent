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
| [evolution.md](1-principles/evolution.md) | Agent evolution model: lesson → skill → workflow → guard → handler *(draft)* |

## Tier 2 — Design

System architecture and subsystem designs.

| Doc | What |
|-----|------|
| [architecture.md](2a-design/architecture.md) | System architecture: event bus, metrics, agents, workflows, storage |
| [sdk.md](2a-design/sdk.md) | AgentSDK + WorkflowSDK: the canonical capability surface |
| [events.md](2a-design/events.md) | Event-native architecture: immutable events, inbox, event types |
| [sessions.md](2a-design/sessions.md) | Session model: lifecycle, state machine, parent links, persistence |
| [runtime.md](2a-design/runtime.md) | Runtime internals: input routing, event loop, LLM call structure |
| [metrics.md](2a-design/metrics.md) | Metrics pipeline: schema, snapshots, alerts, health metrics |
| [cron.md](2a-design/cron.md) | Cron system: scheduling, handler execution, hot-reload |
| [heartbeat.md](2a-design/heartbeat.md) | Heartbeat: per-agent workflows, data loaders, auto-generation |
| [agents.md](2a-design/agents.md) | Agent cooperation: call/message, session tree, context |
| [projects.md](2a-design/projects.md) | Project system: format, lifecycle, handler, shared location |

### Design Decisions

| Doc | Status | What |
|-----|--------|------|
| [infra-surface.md](2a-design/infra-surface.md) | Accepted | North-star: infra primitives, agent patterns, SDK/control surfaces |
| [infra-surface-refactor-plan.md](2a-design/infra-surface-refactor-plan.md) | Active tracker | Phased implementation tracker for infra surface boundaries |
| [unified-events.md](2a-design/unified-events.md) | Shipped | Unified event taxonomy |
| [guards-as-signals.md](2a-design/guards-as-signals.md) | Shipped (partial) | Guards as detection signals with default observability |
| [agent-metrics.md](2a-design/agent-metrics.md) | Approved | Metrics as system vitals; project metrics with balanced pairs |
| [heartbeat-as-agency.md](2a-design/heartbeat-as-agency.md) | Shipped | Heartbeats as the moments agents are autonomous |
| [escalation.md](2a-design/escalation.md) | Partial | Basic routing shipped; lifecycle proposed |
| [telegram-notifications.md](2a-design/telegram-notifications.md) | Partial | Envelope shipped; enrichment proposed |
| [webui.md](2a-design/webui.md) | Shipped (partial) | Web UI design |
| [webui-agents-metrics-tabs.md](2a-design/webui-agents-metrics-tabs.md) | Shipped | Agents/projects/metrics as first-class nav resources |
| [webui-operator-goals.md](2a-design/webui-operator-goals.md) | Draft | Operator-goal-driven UI redesign |
| [http-api-webui-boundary.md](2a-design/http-api-webui-boundary.md) | Accepted | Separate HTTP adapter from webui package |
| [handler-surface-audit.md](2a-design/handler-surface-audit.md) | First slice | Handler infra surface audit |

## Tier 2 — Manual

How-to guides derived from principles and implementation.

| Doc | What |
|-----|------|
| [user-guide.md](2b-manual/user-guide.md) | CLI flags, Docker, socket, chat commands |
| [sdk-quickstart.md](2b-manual/sdk-quickstart.md) | Code examples for all SDK methods |
| [handler-authoring.md](2b-manual/handler-authoring.md) | End-to-end handler writing guide |
| [workflow-authoring.md](2b-manual/workflow-authoring.md) | How to write and invoke workflows |
| [metric-alerts.md](2b-manual/metric-alerts.md) | How agents triage, fix, downgrade, resolve, or escalate alerts |
| [agent-convention.md](2b-manual/agent-convention.md) | Directory layout, convention files, agent.json |

## Tier 3 — Proposals & History

Proposals under consideration and historical docs preserved for context.

| Doc | Status | What |
|-----|--------|------|
| [stigmergic-coordination.md](3-proposals/stigmergic-coordination.md) | Draft | Formalize stigmergic coordination as a first-class pattern |
| [v2-spec.md](3-proposals/v2-spec.md) | Historical | v2 conformance spec |
| [v2-migration-plan.md](3-proposals/v2-migration-plan.md) | Historical | Original v2 migration plan |
| [v2-implementation-notes.md](3-proposals/v2-implementation-notes.md) | Historical | What shipped in v0.2 migration |
| [v2-review-2026-05-06.md](3-proposals/v2-review-2026-05-06.md) | Historical | v2 review checkpoint |

---

## Quick Lookup

| Need | Read |
|------|------|
| Operate or debug a running instance | [user-guide.md](2b-manual/user-guide.md), [metrics.md](2a-design/metrics.md), [runtime.md](2a-design/runtime.md) |
| Handle an alert | [metric-alerts.md](2b-manual/metric-alerts.md), [metrics.md](2a-design/metrics.md), [events.md](2a-design/events.md) |
| Write behavior | [work-model.md](1-principles/work-model.md), [workflow-authoring.md](2b-manual/workflow-authoring.md), [handler-authoring.md](2b-manual/handler-authoring.md) |
| Change infra boundaries | [architecture.md](2a-design/architecture.md), [infra-surface.md](2a-design/infra-surface.md) |
| Update agent conventions | [agent-convention.md](2b-manual/agent-convention.md), [heartbeat.md](2a-design/heartbeat.md), [projects.md](2a-design/projects.md) |
