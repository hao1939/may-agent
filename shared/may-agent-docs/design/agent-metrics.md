# Design: System Metrics

**Status**: approved
**Date**: 2026-04-30 (updated 2026-05-09)

## What metrics are for

Metrics are **the system's vital signs**. They measure progress toward project goals (project metrics), execution quality, and overall system health. They are how the system *sees itself*.

The primary question is not "did we evaluate enough sessions?" The primary
question is "is the system completing useful work, and when it fails, does the
right owner act on the failure?" Coverage metrics are kept as liveness/meta
signals only.

Metrics do not directly drive work or make decisions. The unified work model is:

- A metric breaches → the breach is recorded as state and emitted as an event.
- The owning agent sees the signal in a work context: explicit project, implicit heartbeat project, steward audit, or P0 alert task.
- The agent **judges** what the signal means using goal, facts, history, and a causal theory, then acts, records evidence, or escalates.
- Only **P0 (urgent) metrics fork the agent directly**, bypassing the heartbeat. Everything else waits for the agent to look.

This is intentional — see `heartbeat-as-agency.md`. Forking on every breach makes agents reactive; deferring to heartbeats makes them deliberative. Metrics are vitals, not pagers.

## Architecture

```
System Metrics (registry in metrics-snapshot.ts; prioritized set below)
  → Measured by metrics-snapshot handler every 5 min
  → Threshold = alert. No threshold = watch only.

Project Metrics          — "Is this specific work effective?"
  → Defined in each project.md (## Metrics section)
  → Use Balanced Pairs principle
```

## System Metrics

The doc table below highlights the prioritized metrics. See the `metrics` table
in DB or `ALL_METRICS` in `agents/may/handlers/metrics-snapshot.ts` for the
registry of record. Per KE-722, this doc and the runtime registry must agree on
concrete numbers; when in doubt, the registry wins.

The active system set is intentionally small. Metrics that are useful for
research, conformance tracking, coaching detail, or debugging stay out of active
alerting until they become necessary for keeping the loop running.

### Infrastructure

| ID | What it answers | Source | Target | Threshold | Alert |
|----|-----------------|--------|--------|-----------|-------|
| `handler.success-rate` | Are handlers working? | `handler.completed / (completed + failed)` from events (6h) | 0.95 | 0.80 | below |
| `handler.heartbeat-coverage` | Are heartbeat sessions happening broadly? | `COUNT(DISTINCT agent)` from heartbeat sessions (2h) | 8 | 3 | below |
| `agent.heartbeat-dark-count-2h` | Did any scheduled heartbeat agent go dark? | enabled heartbeat cron agents with no heartbeat session in 2h | 0 | 0 | above |
| `agent.config-invalid-count-1h` | Did runtime skip an agent due to invalid config? | durable `agent.config_invalid` events (1h) | 0 | 0 | above |
| `session.error-rate-6h` | Is anything failing? | `error+interrupted / total` from sessions (6h) | 0.10 | 0.30 | above |
| `session.first-turn-error-count-1h` | Is the provider/model failing before the agent can act? | recent error/interrupted sessions whose first assistant transcript row has `stopReason=error` or provider error text | 0 | 0 | above |
| `message.delivery-failed-count-1h` | Are inter-agent messages failing to route? | `message.delivery_failed` events (1h) | 0 | 0 | above |
| `evaluator.stale-running-session-count` | Is work hanging? | running/idle non-evaluator sessions older than stale cutoff | 0 | 0 | above |

### Quality / Output

| ID | What it answers | Source | Target | Threshold | Alert |
|----|-----------------|--------|--------|-----------|-------|
| `session.failed-triage-rate-3h` | Are failures being acted on? | failed/interrupted sessions with `needs_improvement` evaluation (3h) | 1.00 | 0.80 | below |
| `eval.llm-coverage-lag-h` | Has the LLM evaluation lane gone silent? | hours since latest `evaluatedByHeuristic=0` evaluation | 1 | 4 | above |
| `eval.llm-evals-24h` | Did enough sessions get deep evaluation recently? | count of non-evaluator `evaluatedByHeuristic=0` evaluations (24h) | 4 | 1 | below |
| `evaluator.low-quality-rate-24h` | Is evaluated work frequently `needs_improvement` or low-scoring? | `needs_improvement`/`low_quality` verdicts or low quality/efficiency scores / all evaluations (24h) | 0.10 | 0.30 | above |
| `system.real-output-24h` | Is the system producing? | `git log` substantive files changed (24h) | 100 | 30 | below |
| `project.iterations-24h` | Are projects advancing? | active project.iteration events (24h) | 10 | 1 | below |
| `project.blocked-over-6h` | Is work stuck? | `COUNT(*)` from projects where blocked/waiting >6h | 2 | 4 | above |
| `metric.stale-active-count` | Is measurement coverage stale? | active metrics without a recent snapshot | 0 | 0 | above |
| `capability.status-reality-mismatch-count` | Does runtime state match durable facts? | stale projects, stale metrics, orphan terminal sessions, missing heartbeat agents | 0 | 3 | above |
| `capability.zombie-session-count` | Are sessions stuck alive? | running/idle sessions older than stale cutoff | 0 | 2 | above |

### Retired From Active Alerting

These metrics were useful while investigating specific questions, but they are
not critical runtime-health signals now: `project.blocked-rate-7d`, `v2.*`,
`capability.session-trace-completeness`,
`capability.self-directed-iteration-rate-24h`,
`capability.process-uptime-h`, `capability.concurrent-session-max-1h`,
`capability.tool-preset-drift-count`, and dynamic
`agent.<name>.low-quality-streak` rows.

Retiring a metric means: keep DB history, mark the metric `retired`, resolve any
open alert for it, and stop measuring it in `metrics-snapshot.ts`.

**Reading the dashboard:** if any prioritized metric is red, treat it as a signal to investigate that layer. **All-green is necessary but not sufficient** — see the structural blind spots below before treating green as evidence of healthy production.

### All-green ≠ healthy: known structural blind spots (KE-726, 2026-05-03)

The "all green → healthy" reading was falsified at 2026-05-03 20:17Z: every prioritized metric was green at the moment the system had been producing zero real project iterations for 7h. Each metric has a floor or counting rule that prevents it from alerting in a specific failure mode the metric *names*:

- `project.iterations-24h` — formerly had an unreachable floor and counted closed-project ghost iterations. The current registry uses threshold `1` and counts only active project iterations.
- `project.active-count` — `threshold=1`. Pinned green by a single row in `status='active'`, regardless of whether that row corresponds to real iteration. A direct DB UPDATE on the row (KE-422 / KE-724) is enough to keep it green.
- `project.blocked-over-6h` — KE-724's same UPDATE additionally clears one of the projects that would otherwise breach this metric (it was reclassified out of `waiting`).
- `project.stale-active-count` — registry `threshold=2`, alert_op=`>`. Demands ≥3 simultaneous stale-active projects to fire, but with `active-count` capped near 1 in practice this metric cannot breach in the failure mode it describes. **Not currently in the prioritized 6** despite being the most direct signal for KE-724-class drift.
- `system.real-output-24h` — can distinguish "system completely dark" from "system alive" but not "substance" from "plumbing."

Read this dashboard as a liveness check on plumbing plus a first-pass quality
signal, not proof of substance. Confirm direction with session transcripts,
project journals, and `project.iteration` events before concluding the system is
producing meaningful work.

### Evaluator LLM Lane Signals

`eval.llm-coverage-lag-h` and `eval.llm-evals-24h` are deliberately separate.
The lag metric catches lane death and is urgent. The count metric catches
sampling starvation and is advisory. A low count is not proof that evaluator
should create more reviews; evaluator should first check whether there were
eligible recent sessions, whether `eval-llm-scan` ran, and whether model/runtime
failures or skip rules prevented useful deep evaluation.

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
- **Handler**: `agents/may/handlers/metrics-snapshot.ts` — auto-registers, measures every 5min, **and emits `metric.breach` events** when `breached && !openAlert` (see `metrics-snapshot.ts:240-279`).
- **Alerting**: `agents/may/handlers/metric-alert-reactor.ts` consumes `metric.breach` events and polls unresolved alerts. P0 forks the owner directly. P1/P2/P3 remain visible as metric context for heartbeat/project/steward handling.
- **Retention**: snapshots kept 30 days, pruned after each measurement run
- **Error isolation**: each metric measured independently — one failure doesn't block others
