# System Documentation

## Start Here

| Doc | What |
|-----|------|
| [core-principles.md](core-principles.md) | 10 architecture principles. Read this first. |
| [sdk.md](sdk.md) | AgentSDK: 8-method canonical interface. The system's capability surface. |

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

## Proposals (not yet implemented)

| Doc | What |
|-----|------|
| [proposals/master-worker.md](proposals/master-worker.md) | Persistent worker/reviewer sessions with followUp() |
| [proposals/escalation.md](proposals/escalation.md) | Escalation and recovery system |

## Methodology

| Doc | What |
|-----|------|
| [evidence-first.md](evidence-first.md) | How to validate ideas: hypothesis → evidence → build |
| [code-vs-data.md](code-vs-data.md) | When to use guards vs context.md vs workflows |
