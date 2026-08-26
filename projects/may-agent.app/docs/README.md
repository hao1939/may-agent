# May System Documentation

This directory is the single design and operating-documentation home for the
May system, including the Host in `projects/may-agent`. Runtime code
repositories do not keep parallel design folders. When code changes a
contract, update the corresponding document here in the same change.

The system is easiest to understand as one loop:

```text
event -> Task owned by an App -> one bounded attempt -> result or another wake
```

An App owns each durable outcome. The Host stores events and Tasks, runs
bounded attempts, and recovers unfinished work. An attempt may use an agent or
workflow, but neither becomes another work owner.

For May, the ordinary model is simply: a human talks to **May** (`app:may`),
which answers directly or links the Conversation Topic to typed work in the
responsible App. The bounded frontend request ends after May answers or
publishes typed follow-up intent; May's normal visible conversation Task then
follows durable work and returns useful updates to Conversation. Execution
diagnostics may name the bounded executor, for example `agent:may`; that
executor owns no Task. The **Host Operations App** (`app:may-agent`) owns Tasks
that change the Host. There is no separate architectural component called
“May agent.”

## Documentation tiers

Higher tiers govern lower tiers. When documents conflict, update the lower
tier.

| Folder          | Purpose                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `1-principles/` | Stable requirements, goals, and conventions.                            |
| `2a-design/`    | Current architecture and subsystem contracts.                           |
| `2b-manual/`    | How-to guidance derived from design and implementation.                 |
| `proposals/`    | Active proposals/trackers only; absent when there are none.             |
| `archive/`      | Historical decisions, reviews, implementation records, and V2 material. |

Each current design records separate `Design status` and `Implementation
status` fields. Stable design documents define implemented contracts and
explicit current gaps, not dated incident narration. A proposal moves to the
archive after its accepted rules enter current design, or after a rejection
record names the selected alternative.

## Start here

Read [system-model.md](2a-design/system-model.md) first for the compact whole
system model. Use [INDEX.md](INDEX.md) for complete topical navigation.

### I want to build an autonomous App

1. [agent-app.md](2a-design/agent-app.md) — package, ownership, and host attachments
2. [projects.md](2a-design/projects.md) — durable goal and project posture
3. [task-resource-engine.md](2a-design/task-resource-engine.md) — the one durable work loop
4. [workflows.md](2a-design/workflows.md) — reusable processes owned by agents
5. [sdk.md](2a-design/sdk.md) — stable TypeScript capability surface
6. [workflow-authoring.md](2b-manual/workflow-authoring.md) — implementation guide
7. [agent-app-adoption-playbook.md](2b-manual/agent-app-adoption-playbook.md) — adoption checklist

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
3. [event-runtime-audit.md](2b-manual/event-runtime-audit.md) — Event admission audit
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
