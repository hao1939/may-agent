# may-agent Documentation

May-agent is easiest to understand as:

```text
events move work
metrics expose signals
agents judge and act
workflows make repeated work explicit
projects hold durable goal context
```

## Documentation tiers

Higher tiers govern lower tiers. When documents conflict, update the lower
tier.

| Folder          | Purpose                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `1-principles/` | Stable requirements, goals, and conventions.                            |
| `2a-design/`    | Current architecture and subsystem contracts.                           |
| `2b-manual/`    | How-to guidance derived from design and implementation.                 |
| `3-proposals/`  | Active proposals and convergence trackers only.                         |
| `archive/`      | Historical decisions, reviews, implementation records, and V2 material. |

Each current design records separate `Design status` and `Implementation
status` fields. Stable design documents define contracts and current gaps, not
dated incident narration. Historical documents must link to the current design
that replaced them.

## Start here

Read [system-model.md](2a-design/system-model.md) first for the compact whole
system model. Use [INDEX.md](INDEX.md) for complete topical navigation.

### I want to build an autonomous Agent App

1. [agent-app.md](2a-design/agent-app.md) — package, ownership, optional host attachments
2. [projects.md](2a-design/projects.md) — durable goal and project posture
3. [task-resource-engine.md](2a-design/task-resource-engine.md) — optional task reconciliation
4. [workflows.md](2a-design/workflows.md) — reusable processes owned by agents
5. [sdk.md](2a-design/sdk.md) — stable TypeScript capability surface
6. [workflow-authoring.md](2b-manual/workflow-authoring.md) — implementation guide

### I want to build or fix agent behavior

1. [work-model.md](1-principles/work-model.md) — projects, signals, and ownership
2. [agents.md](2a-design/agents.md) — independent execution and cooperation
3. [skills.md](2a-design/skills.md) — reusable judgment guidance
4. [workflows.md](2a-design/workflows.md) — learned repeatable process
5. [workflow-authoring.md](2b-manual/workflow-authoring.md) — authoring guide
6. [sdk.md](2a-design/sdk.md) — supplied capabilities

### I want to operate the running system

1. [user-guide.md](2b-manual/user-guide.md) — CLI, Docker, socket, and chat commands
2. [metrics.md](2a-design/metrics.md) — live metrics and alerts
3. [event-runtime-audit.md](2b-manual/event-runtime-audit.md) — event delivery audit
4. [guard-runtime-audit.md](2b-manual/guard-runtime-audit.md) — guard signal audit
5. [metric-alerts.md](2b-manual/metric-alerts.md) — alert handling
6. [runtime.md](2a-design/runtime.md) — runtime internals

### I want to change infrastructure

1. [architecture.md](2a-design/architecture.md) — detailed system architecture
2. [system-boundary.md](2a-design/system-boundary.md) — infrastructure boundary
3. [events.md](2a-design/events.md) — event contract
4. [sessions.md](2a-design/sessions.md) — durable execution lifecycle
5. [cron.md](2a-design/cron.md) — time-based event production
6. [storage.md](2a-design/storage.md) — source and projection authority

Historical migration rationale lives under [archive/](archive/README.md), not
in the current reading path.
