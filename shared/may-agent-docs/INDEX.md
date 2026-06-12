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
| [session-eval-trail.md](2a-design/session-eval-trail.md) | Session evaluation trail: summary projection plus append-only line evidence beside raw session logs |
| [practice-learning-loop.md](2a-design/practice-learning-loop.md) | Practice learning loop: sessions become eval trails, human feedback, evolution candidates, and project changes |
| [runtime.md](2a-design/runtime.md) | Runtime internals: input routing, event loop, LLM call structure |
| [human-control-surfaces.md](2a-design/human-control-surfaces.md) | Shared CLI, Telegram, Web, and console contract: targeted sessions and event-shaped human intents |
| [may-console.md](2a-design/may-console.md) | May Console: terminal REPL over the daemon socket, session switching, direct steering |
| [metrics.md](2a-design/metrics.md) | Metrics: schema, pipeline, alerts, registry, balanced pairs, blind spots |
| [cron.md](2a-design/cron.md) | Cron system: scheduling, handler execution, hot-reload |
| [heartbeat.md](2a-design/heartbeat.md) | Heartbeat: per-agent workflows, data loaders, auto-generation |
| [agents.md](2a-design/agents.md) | Agent cooperation: call/message, session tree, context |
| [projects.md](2a-design/projects.md) | Project system: format, lifecycle, handler, shared location |

### Design Decisions

| Doc | Status | What |
|-----|--------|------|
| [system-boundary.md](2a-design/system-boundary.md) | Accepted | North-star: infra primitives, agent patterns, SDK/control surfaces |
| [system-boundary-tracker.md](2a-design/system-boundary-tracker.md) | Active tracker | Phased implementation tracker for system boundary |
| [guards.md](2a-design/guards.md) | Shipped (partial) | Guards as detection signals with default observability |
| [escalation.md](2a-design/escalation.md) | Partial | Basic routing shipped; lifecycle proposed |
| [telegram-notifications.md](2a-design/telegram-notifications.md) | Partial | Envelope shipped; enrichment proposed |
| [webui.md](2a-design/webui.md) | Shipped (partial) | Web UI design: surfaces, steering, nav |
| [http-boundary.md](2a-design/http-boundary.md) | Accepted | Separate HTTP adapter from webui package |
| [handler-audit.md](2a-design/handler-audit.md) | First slice | Handler infra surface audit |

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
| [retired-design-alternatives.md](3-proposals/retired-design-alternatives.md) | Thoughts / alternatives | Useful ideas preserved from deleted legacy design archive |

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
| Operate or debug a running instance | [user-guide.md](2b-manual/user-guide.md), [metrics.md](2a-design/metrics.md), [runtime.md](2a-design/runtime.md) |
| Handle an alert | [metric-alerts.md](2b-manual/metric-alerts.md), [metrics.md](2a-design/metrics.md), [events.md](2a-design/events.md) |
| Write behavior | [work-model.md](1-principles/work-model.md), [workflow-authoring.md](2b-manual/workflow-authoring.md), [handler-authoring.md](2b-manual/handler-authoring.md) |
| Change infra boundaries | [architecture.md](2a-design/architecture.md), [system-boundary.md](2a-design/system-boundary.md) |
| Update agent conventions | [agent-convention.md](2b-manual/agent-convention.md), [heartbeat.md](2a-design/heartbeat.md), [projects.md](2a-design/projects.md) |
