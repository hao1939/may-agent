# Design: System Metrics

**Status**: approved
**Date**: 2026-04-30

## Architecture

```
System Metrics (6)       — "Is the system healthy and producing?"
  → Measured by metrics-snapshot handler every 5 min
  → Threshold = alert. No threshold = watch only.

Project Metrics          — "Is this specific work effective?"
  → Defined in each project.md (## Metrics section)
  → Use Balanced Pairs principle
```

## System Metrics

6 metrics. 3 infrastructure + 3 output. All measurable today.

### Infrastructure

| ID | What it answers | Source | Target | Threshold | Alert |
|----|-----------------|--------|--------|-----------|-------|
| `handler.success-rate` | Are handlers working? | `handler.completed / (completed + failed)` from events (6h) | 0.95 | 0.80 | below |
| `handler.heartbeat-coverage` | Is any agent dark? | `COUNT(DISTINCT agent)` from heartbeat events (2h) | 8 | 6 | below |
| `session.error-rate-6h` | Is anything failing? | `error+interrupted / total` from sessions (6h) | 0.10 | 0.30 | above |

### Output

| ID | What it answers | Source | Target | Threshold | Alert |
|----|-----------------|--------|--------|-----------|-------|
| `system.real-output-24h` | Is the system producing? | `git log` substantive files changed (24h) | 100 | 30 | below |
| `project.iterations-24h` | Are projects advancing? | `COUNT(*)` from project.iteration events (24h) | 10 | 3 | below |
| `project.blocked-over-6h` | Is work stuck? | `COUNT(*)` from projects where blocked/waiting >6h | 0 | 1 | above |

If all 6 green → system is healthy and producing. If any red → investigate that layer.

## Balanced Pairs (for project metrics)

Every project should track at least 2 metrics on different dimensions:

```
Activity  → "Am I doing the work?"
Impact    → "Is the work making a difference?"
```

Without both, agents optimize pathologically. Examples:

| Project | Activity metric | Impact metric |
|---------|----------------|---------------|
| Skill quality (coach) | skills deployed | eval score improvement |
| System efficiency (optimizer) | iterations completed | output files produced |
| Agent literacy (bob) | baselines measured | gym pass rate |

Anti-gaming: if activity is high but impact is low, the agent is busy but not effective. The impact metric catches it.

### Cadence & Phase Awareness

Metrics are **slow-moving signals**. Don't chase them daily.

- **Check weekly**, note direction not absolute value
- **Match to phase**: during experiments, activity metrics may stall (that's fine — you're building evidence). During deployment, watch impact closely.
- **One action per heartbeat, not three.** If multiple metrics are off, pick the one that matters most for your current phase. Chasing all simultaneously causes thrashing.
- **Override signals with judgment:** A metric dip right after deploying a new intervention is expected (lagging indicator). Don't panic-react.

## Metric Lifecycle

Metrics evolve — meeting a target is not done:

1. **Create** — define in project.md with target
2. **Measure** — metrics-snapshot handler records automatically
3. **Alert** — breach triggers heartbeat attention
4. **Raise target** — target met consistently? Raise the bar or add dimensions
5. **Graduate** — move to watch-only (requires human approval)

A metric at target is a signal the bar is too low. Never coast.

## Implementation Notes

- **Source of truth**: `metrics` table in DB. This doc is design rationale.
- **Handler**: `agents/may/handlers/metrics-snapshot.ts` — auto-registers and measures every 5min
- **Alerting**: `agents/may/handlers/metric-alert-reactor.ts` — emits `metric.breach` events
- **Retention**: snapshots kept 30 days, pruned after each measurement run
- **Error isolation**: each metric measured independently — one failure doesn't block others
