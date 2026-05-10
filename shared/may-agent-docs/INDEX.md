# System Documentation

## Start Here

| Doc | What |
|-----|------|
| [core-principles.md](core-principles.md) | 11 architecture principles. Read this first. |
| [architecture.md](architecture.md) | System architecture: event bus, metrics, agents, workflows, storage |
| [work-model.md](work-model.md) | Unified model: projects hold context, metrics signal, triggers wake, agents judge |
| [sdk.md](sdk.md) | AgentSDK + WorkflowSDK: the system's canonical capability surface. |

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
| [evolution.md](evolution.md) | **How agents extend abilities**: lesson → skill → workflow → guard → handler |

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

| Doc | What |
|-----|------|
| [design/agent-metrics.md](design/agent-metrics.md) | Metrics as system vitals; project metrics with balanced pairs |
| [design/guards-as-signals.md](design/guards-as-signals.md) | Draft: guards as detection signals with default observability |
| [design/heartbeat-as-agency.md](design/heartbeat-as-agency.md) | Heartbeats as the moments agents are autonomous |
| [design/infra-surface.md](design/infra-surface.md) | Draft: infra primitives, agent patterns, SDK/control surfaces |
| [design/infra-surface-implementation-plan.md](design/infra-surface-implementation-plan.md) | Draft plan: implement the infra surface in incremental slices |
| [design/infra-surface-refactor-plan.md](design/infra-surface-refactor-plan.md) | Draft plan: finish infra boundary cleanup without broad rewrites |
| [design/webui.md](design/webui.md) | Web UI as a window into the life of the system |
| [design/unified-events.md](design/unified-events.md) | Unified event taxonomy |
| [design/telegram-notifications.md](design/telegram-notifications.md) | Notification routing via Telegram |
| [design/master-worker.md](design/master-worker.md) | Persistent worker/reviewer sessions with followUp() |
| [design/escalation.md](design/escalation.md) | Escalation and recovery system |

## Proposals & History

| Doc | What |
|-----|------|
| [proposals/v2-spec.md](proposals/v2-spec.md) | v2 conformance spec: C1–C10 capabilities, I1–I4 infra, S1–S8 structural |
| [proposals/v2-migration-plan.md](proposals/v2-migration-plan.md) | Historical: original v2 migration plan |
| [proposals/v2-implementation-notes.md](proposals/v2-implementation-notes.md) | Historical: what shipped in v0.2 migration |
| [proposals/v2-review-2026-05-06.md](proposals/v2-review-2026-05-06.md) | Dated snapshot: v2 review checkpoint |
| [proposals/stigmergic-coordination.md](proposals/stigmergic-coordination.md) | Proposal: formalize stigmergic coordination as a first-class pattern alongside `message` |

## Methodology

| Doc | What |
|-----|------|
| [evidence-first.md](evidence-first.md) | How to validate ideas: hypothesis → evidence → build |
| [code-vs-data.md](code-vs-data.md) | When to use guards vs context.md vs workflows |
