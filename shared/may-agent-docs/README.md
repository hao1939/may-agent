# may-agent Documentation

May-agent is easiest to understand as:

```
events move work
metrics expose signals
agents judge and act
workflows make repeated work explicit
projects hold durable goal context
```

Start with the shortest path that matches your job.

## Reading Paths

### I want to operate the running system

1. [manual/user-guide.md](manual/user-guide.md) — CLI, Docker, socket, and chat commands
2. [metrics.md](design/metrics.md) — what the live metrics mean
3. [manual/metric-alerts.md](manual/metric-alerts.md) — how alerts should be handled
4. [runtime.md](design/runtime.md) — runtime internals when something is broken

### I want to build or fix agent behavior

1. [work-model.md](principles/work-model.md) — projects, heartbeats, metrics, and triggers
2. [manual/workflow-authoring.md](manual/workflow-authoring.md) — write workflow-backed behavior
3. [manual/handler-authoring.md](manual/handler-authoring.md) — bridge events to workflows
4. [sdk.md](design/sdk.md) — the stable TypeScript surface

### I want to change infra

1. [architecture.md](design/architecture.md) — current system architecture
2. [design/infra-surface.md](design/infra-surface.md) — north-star infra boundary
3. [design/infra-surface-refactor-plan.md](design/infra-surface-refactor-plan.md) — active tracker
4. [events.md](design/events.md), [sessions.md](design/sessions.md), [cron.md](design/cron.md) — subsystem details

### I want to understand the history

Read [INDEX.md](INDEX.md). Historical proposals are kept there but should not
override the current architecture, runtime, work model, or manual docs.

## Agent Skills

Reusable operating protocols live in [../skills](../skills). They are not a
replacement for infra design; they are short guides agents can use when a task
matches a known pattern.

Most useful system skills:

- `system-investigation` — debug runtime, metrics, alerts, sessions, handlers, and workflows.
- `reading-metrics` — treat metrics as signals, not automatic judgments.
- `project-loop-driver` — move a durable project through intensive work and monitoring.
- `control-plane-operation` — use events, workflows, SDK, and socket without bypassing infra.

Skills only help when the task or workflow actually provides them. Do not rely
on agents to discover the skill library on their own.

See [INDEX.md](INDEX.md) for complete navigation.
