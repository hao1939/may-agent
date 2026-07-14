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

- **`1-principles/`** (Tier 1) — Requirements, goals, conventions. Human-authored.
- **`2a-design/`** (Tier 2a) — Architecture and subsystem designs. Agent-drafted, human-signed-off.
- **`2b-manual/`** (Tier 2b) — How-to guides. Derived from principles + implementation.
- **`3-proposals/`** (Tier 3) — Plans, specs, historical. May be outdated or superseded.

Folder tier expresses authority, not implementation progress. Use these fields
inside a document when status matters:

- **Design status:** `Accepted`, `Draft`, `Tracker`, or `Historical`.
- **Implementation status:** `Implemented`, `Partial`, `Gap`, or `N/A`.

Keep those axes separate. An accepted design may still have implementation
gaps; shipped code does not promote a proposal into authoritative design. A
tracker records convergence work and must link to the accepted design it is
tracking. Historical documents must say which active document replaces them.

Stable design docs define contracts and current gaps, not dated row counts or
incident narration. Put live findings in manuals, task evidence, or dated
proposals and link back to the governing design.

## Reading Paths

### I want to operate the running system

1. [manual/user-guide.md](2b-manual/user-guide.md) — CLI, Docker, socket, and chat commands
2. [design/metrics.md](2a-design/metrics.md) — what the live metrics mean
3. [manual/event-runtime-audit.md](2b-manual/event-runtime-audit.md) — compare live event emitters, consumers, delivery, and pair health against the design
4. [manual/guard-runtime-audit.md](2b-manual/guard-runtime-audit.md) — inspect guard volume, repeat signals, and threshold quality
5. [manual/metric-alerts.md](2b-manual/metric-alerts.md) — how alerts should be handled
6. [design/runtime.md](2a-design/runtime.md) — runtime internals when something is broken

### I want to build or fix agent behavior

1. [principles/work-model.md](1-principles/work-model.md) — projects, heartbeats, metrics, and triggers
2. [manual/workflow-authoring.md](2b-manual/workflow-authoring.md) — write workflow-backed behavior
3. [manual/handler-authoring.md](2b-manual/handler-authoring.md) — bridge events to workflows
4. [design/project-app-v3.md](2a-design/project-app-v3.md) — project apps, owner events, and domain/app boundaries
5. [design/sdk.md](2a-design/sdk.md) — the stable TypeScript surface

Project App V3 is the only current project-app design. Earlier V2 project-app
notes live under `archive/v2/` for history only.

### I want to change infra

1. [design/architecture.md](2a-design/architecture.md) — current system architecture
2. [design/system-boundary.md](2a-design/system-boundary.md) — north-star infra boundary
3. [design/system-boundary-tracker.md](2a-design/system-boundary-tracker.md) — historical migration tracker; follow its links for remaining work
4. [design/events.md](2a-design/events.md), [design/sessions.md](2a-design/sessions.md), [design/cron.md](2a-design/cron.md) — subsystem details

See [INDEX.md](INDEX.md) for complete navigation.
