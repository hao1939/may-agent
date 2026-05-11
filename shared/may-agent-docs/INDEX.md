# System Documentation

## Start Here

| Doc | What |
|-----|------|
| [core-principles.md](core-principles.md) | 11 architecture principles. Read this first. |
| [architecture.md](architecture.md) | System architecture: event bus, metrics, agents, workflows, storage |
| [work-model.md](work-model.md) | Unified model: projects hold context, metrics signal, triggers wake, agents judge |
| [sdk.md](sdk.md) | AgentSDK + WorkflowSDK: the system's canonical capability surface |

## Subsystems

| Doc | What |
|-----|------|
| [sessions.md](sessions.md) | Session model: lifecycle, state machine, parent links, persistence |
| [events.md](events.md) | Event-native architecture: immutable events, inbox, event types |
| [cron.md](cron.md) | Cron system: scheduling, handler execution, hot-reload |
| [heartbeat.md](heartbeat.md) | Heartbeat: per-agent workflows, data loaders, auto-generation |
| [metrics.md](metrics.md) | Metrics pipeline: schema, snapshots, alerts, health metrics |
| [projects.md](projects.md) | Project system: format, lifecycle, handler, shared location |
| [agents.md](agents.md) | Agent cooperation: call/message, session tree, context |
| [runtime.md](runtime.md) | Runtime internals: input routing, event loop, LLM call structure |
| [evolution.md](evolution.md) | How agents extend abilities: lesson -> skill -> workflow -> guard -> handler |

## Manual (How-To Guides)

| Doc | What |
|-----|------|
| [manual/sdk-quickstart.md](manual/sdk-quickstart.md) | Code examples for all 7 SDK methods |
| [manual/handler-authoring.md](manual/handler-authoring.md) | End-to-end handler writing guide |
| [manual/workflow-authoring.md](manual/workflow-authoring.md) | How to write and invoke workflows |
| [manual/metric-alerts.md](manual/metric-alerts.md) | How agents triage, fix, downgrade, resolve, or escalate metric alerts |
| [manual/user-guide.md](manual/user-guide.md) | CLI flags, Docker, socket, chat commands |
| [manual/agent-convention.md](manual/agent-convention.md) | Directory layout, convention files, agent.json |

## Design

Active design docs and shipped decisions.

| Doc | Status | What |
|-----|--------|------|
| [design/infra-surface.md](design/infra-surface.md) | Draft | North-star: infra primitives, agent patterns, SDK/control surfaces |
| [design/infra-surface-refactor-plan.md](design/infra-surface-refactor-plan.md) | In progress | Canonical phased implementation tracker for infra surface boundaries |
| [design/infra-surface-implementation-plan.md](design/infra-surface-implementation-plan.md) | Historical | Superseded early implementation tracker; use the refactor plan for new work |
| [design/handler-surface-audit.md](design/handler-surface-audit.md) | In progress | Audit of handler infra surface boundaries |
| [design/guards-as-signals.md](design/guards-as-signals.md) | In progress | Guards as detection signals with default observability |
| [design/agent-metrics.md](design/agent-metrics.md) | Approved | Metrics as system vitals; project metrics with balanced pairs |
| [design/heartbeat-as-agency.md](design/heartbeat-as-agency.md) | Shipped | Heartbeats as the moments agents are autonomous |
| [design/unified-events.md](design/unified-events.md) | Shipped | Unified event taxonomy |
| [design/escalation.md](design/escalation.md) | Shipped (partial) | Escalation and recovery system |
| [design/master-worker.md](design/master-worker.md) | Legacy | Historical persistent worker/reviewer design; `project` is the default project driver |
| [design/telegram-notifications.md](design/telegram-notifications.md) | Shipped | Context-enriched Telegram reply routing |
| [design/webui.md](design/webui.md) | Shipped (partial) | Web UI as a window into the life of the system |
| [design/webui-agents-metrics-tabs.md](design/webui-agents-metrics-tabs.md) | Shipped | Agents/projects/metrics as first-class nav resources (refines webui.md) |
| [design/webui-operator-goals.md](design/webui-operator-goals.md) | Draft | Operator-goal-driven UI redesign (refines webui.md) |

## Proposals & History

Proposals under consideration and historical docs preserved for context.

| Doc | Status | What |
|-----|--------|------|
| [proposals/stigmergic-coordination.md](proposals/stigmergic-coordination.md) | Draft | Formalize stigmergic coordination as a first-class pattern |
| [proposals/unified-command-interface.md](proposals/unified-command-interface.md) | Superseded | Historical command-registry draft; current adapter boundary is `packages/control` event frames |
| [proposals/v2-spec.md](proposals/v2-spec.md) | Historical | v2 conformance spec: C1-C10 capabilities, I1-I4 infra, S1-S8 structural |
| [proposals/v2-migration-plan.md](proposals/v2-migration-plan.md) | Historical | Original v2 migration plan |
| [proposals/v2-implementation-notes.md](proposals/v2-implementation-notes.md) | Historical | What shipped in v0.2 migration |
| [proposals/v2-review-2026-05-06.md](proposals/v2-review-2026-05-06.md) | Historical | v2 review checkpoint (2026-05-06) |

## Methodology

| Doc | What |
|-----|------|
| [evidence-first.md](evidence-first.md) | How to validate ideas: hypothesis -> evidence -> build |
| [code-vs-data.md](code-vs-data.md) | When to use guards vs context.md vs workflows |
