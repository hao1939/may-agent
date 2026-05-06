# System Documentation

## Start Here

| Doc | What |
|-----|------|
| [core-principles.md](core-principles.md) | 11 architecture principles. Read this first. |
| [architecture.md](architecture.md) | System architecture: event bus, metrics, agents, workflows, storage |
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
| [agents.md](agents.md) | Agent cooperation: call/fork/message, session tree, context |
| [runtime.md](runtime.md) | Runtime internals: input routing, event loop, LLM call structure |
| [growth.md](growth.md) | Agent growth: philosophy and approach (agent-scope, not infra) |
| [evolution.md](evolution.md) | **How agents extend abilities**: lesson → skill → workflow → guard → handler |

## Manual (How-To Guides)

| Doc | What |
|-----|------|
| [manual/sdk-quickstart.md](manual/sdk-quickstart.md) | Code examples for all 8 SDK methods |
| [manual/handler-authoring.md](manual/handler-authoring.md) | End-to-end handler writing guide |
| [manual/workflow-authoring.md](manual/workflow-authoring.md) | How to write and invoke workflows |
| [manual/user-guide.md](manual/user-guide.md) | CLI flags, Docker, socket, chat commands |
| [manual/agent-convention.md](manual/agent-convention.md) | Directory layout, convention files, agent.json |

## Design

| Doc | What |
|-----|------|
| [design/agent-metrics.md](design/agent-metrics.md) | Metrics as system vitals; project metrics with balanced pairs |
| [design/heartbeat-as-agency.md](design/heartbeat-as-agency.md) | Heartbeats as the moments agents are autonomous |
| [design/webui.md](design/webui.md) | Web UI as a window into the life of the system |
| [design/unified-events.md](design/unified-events.md) | Unified event taxonomy |
| [design/telegram-notifications.md](design/telegram-notifications.md) | Notification routing via Telegram |

## Proposals (not yet implemented)

| Doc | What |
|-----|------|
| [proposals/v2-spec.md](proposals/v2-spec.md) | v2 conformance properties P1–P10 with verification mechanisms |
| [proposals/master-worker.md](proposals/master-worker.md) | Persistent worker/reviewer sessions with followUp() |
| [proposals/escalation.md](proposals/escalation.md) | Escalation and recovery system |

## Methodology

| Doc | What |
|-----|------|
| [evidence-first.md](evidence-first.md) | How to validate ideas: hypothesis → evidence → build |
| [code-vs-data.md](code-vs-data.md) | When to use guards vs context.md vs workflows |
