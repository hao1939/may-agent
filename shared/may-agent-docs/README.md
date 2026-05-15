# may-agent Documentation

May-agent is easiest to understand as:

```
events move work
metrics expose signals
agents judge and act
workflows make repeated work explicit
projects hold durable goal context
```

## Documentation Tiers

Docs follow a hierarchy of truth. Higher tiers govern lower tiers — conflicts are resolved by updating the lower tier.

- **`principles/`** (Tier 1) — Requirements, goals, conventions. Human-authored.
- **`design/`** (Tier 2) — Architecture and subsystem designs. Agent-drafted, human-signed-off.
- **`manual/`** (Tier 2) — How-to guides. Derived from principles + implementation.
- **`proposals/`** (Tier 3) — Plans, specs, historical. May be outdated or superseded.

## Reading Paths

### I want to operate the running system

1. [manual/user-guide.md](manual/user-guide.md) — CLI, Docker, socket, and chat commands
2. [design/metrics.md](design/metrics.md) — what the live metrics mean
3. [manual/metric-alerts.md](manual/metric-alerts.md) — how alerts should be handled
4. [design/runtime.md](design/runtime.md) — runtime internals when something is broken

### I want to build or fix agent behavior

1. [principles/work-model.md](principles/work-model.md) — projects, heartbeats, metrics, and triggers
2. [manual/workflow-authoring.md](manual/workflow-authoring.md) — write workflow-backed behavior
3. [manual/handler-authoring.md](manual/handler-authoring.md) — bridge events to workflows
4. [design/sdk.md](design/sdk.md) — the stable TypeScript surface

### I want to change infra

1. [design/architecture.md](design/architecture.md) — current system architecture
2. [design/infra-surface.md](design/infra-surface.md) — north-star infra boundary
3. [design/infra-surface-refactor-plan.md](design/infra-surface-refactor-plan.md) — active tracker
4. [design/events.md](design/events.md), [design/sessions.md](design/sessions.md), [design/cron.md](design/cron.md) — subsystem details

See [INDEX.md](INDEX.md) for complete navigation.
