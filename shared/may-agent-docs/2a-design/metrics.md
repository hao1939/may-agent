# Metrics & Alerts

## Overview

Metrics are **the system's vital signs**. They measure system health, execution
quality, and progress toward project goals. They are how the system *sees itself*.

The primary question is not "did we evaluate enough sessions?" The primary
question is "is the system completing useful work, and when it fails, does the
right owner act on the failure?" Coverage metrics are kept as liveness/meta
signals only.

Metrics do not directly drive work. The unified work model is:

- A metric breaches → the breach is recorded as state and emitted as an event.
- The owning agent sees the signal in a work context: explicit project, implicit heartbeat project, steward audit, or P0 alert task.
- The agent **judges** what the signal means using goal, facts, history, and a causal theory, then acts, records evidence, or escalates.
- Only **P0 (urgent) metrics fork the agent directly**, bypassing the heartbeat. Everything else waits for the agent to look.

This is intentional — see `heartbeat.md`. Forking on every breach makes agents
reactive; deferring to heartbeats makes them deliberative. Metrics are vitals,
not pagers.

Built-in metrics are owned by `agents/may/handlers/metrics-snapshot.ts`; custom
metrics can be added with `source_query` or `source_command`.

## Schema

```sql
CREATE TABLE metrics (
  id TEXT PRIMARY KEY,
  name TEXT,
  type TEXT,          -- 'gauge' | 'counter' | 'health' | 'derived'
  owner TEXT,
  current REAL,
  target REAL,
  threshold REAL,
  unit TEXT,
  priority TEXT,
  status TEXT DEFAULT 'active',
  blocker TEXT,
  project TEXT,
  source TEXT,
  source_query TEXT,
  source_command TEXT,
  config TEXT,          -- JSON: additional metric configuration
  sensitivity REAL,
  measure_interval INTEGER,
  created_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT 0,
  closed_at INTEGER,
  alert_op TEXT,     -- '<' alert when below, '>' alert when above
  speed TEXT,
  description TEXT,
  direction TEXT
);

CREATE TABLE metric_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id TEXT,
  value REAL,
  sample_size INTEGER,
  measured_at INTEGER,
  measured_by TEXT,
  note TEXT
);
```

## Metric Types

- `gauge` — point-in-time value, can go up or down.
- `counter` — count/rate of events or output.
- `health` — pass/fail or count-of-failures signal.
- `derived` — computed from other metrics.

## System Metrics Registry

The tables below are the prioritized metrics. See the `metrics` table in DB or
`ALL_METRICS` in `agents/may/handlers/metrics-snapshot.ts` for the registry of
record. Per KE-722, this doc and the runtime registry must agree on concrete
numbers; when in doubt, the registry wins.

The active system set is intentionally small. Metrics useful for research,
conformance tracking, coaching detail, or debugging stay out of active alerting
until they become necessary for keeping the loop running.

### Infrastructure

| ID | What it answers | Source | Target | Threshold | Alert |
|----|-----------------|--------|--------|-----------|-------|
| `handler.success-rate` | Are handlers working? | `handler.completed / (completed + failed)` from events (6h) | 0.95 | 0.80 | below |
| `handler.heartbeat-coverage` | Are heartbeat sessions happening broadly? | `COUNT(DISTINCT agent)` from heartbeat sessions (2h) | 8 | 3 | below |
| `agent.heartbeat-dark-count-2h` | Did any scheduled heartbeat agent go dark? | enabled heartbeat cron agents with no heartbeat session in 2h | 0 | 0 | above |
| `agent.config-invalid-count-1h` | Did runtime skip an agent due to invalid config? | durable `agent.config_invalid` events (1h) | 0 | 0 | above |
| `session.error-rate-6h` | Is anything failing? | `error+interrupted / total` from sessions (6h) | 0.10 | 0.30 | above |
| `session.first-turn-error-count-1h` | Is the provider/model failing before the agent can act? | recent error/interrupted sessions whose first assistant transcript row has `stopReason=error` or provider error text | 0 | 5 | above |
| `message.delivery-failed-count-1h` | Are inter-agent messages failing to route? | `message.delivery_failed` events (1h) | 0 | 0 | above |
| `evaluator.stale-running-session-count` | Is work hanging? | running/idle non-evaluator sessions older than stale cutoff | 0 | 0 | above |

### Quality / Output

| ID | What it answers | Source | Target | Threshold | Alert |
|----|-----------------|--------|--------|-----------|-------|
| `session.failed-triage-rate-3h` | Are failures being acted on? | failed/interrupted sessions with `needs_improvement` evaluation (3h) | 1.00 | 0.80 | below |
| `eval.llm-coverage-lag-h` | Has the LLM evaluation lane gone silent? | hours since latest `evaluatedByHeuristic=0` evaluation | 1 | 4 | above |
| `eval.llm-evals-24h` | Did enough sessions get deep evaluation recently? | count of non-evaluator `evaluatedByHeuristic=0` evaluations (24h) | 4 | 1 | below |
| `evaluator.low-quality-rate-24h` | Is evaluated work frequently `needs_improvement` or low-scoring? (dashboard-only, P3) | `needs_improvement`/`low_quality` verdicts or low quality/efficiency scores / all evaluations (24h) | 0.10 | 0.80 | above |
| `evaluator.substantive-low-quality-rate-24h` | Of *substantive* evaluations, are quality failures frequent? | substantive needs-improvement count / substantive evaluations (24h) | 0.10 | 0.30 | above |
| `system.real-output-24h` | Is the system producing? | `git log` substantive files changed (24h) | 100 | 30 | below |
| `project.iterations-24h` | How much active-project work happened? | active project.iteration events (24h) | 0 | 0 | watch-only |
| `project.blocked-over-6h` | Is work stuck on true blockers? | `COUNT(*)` from projects where blocked >6h | 0 | 4 | above |
| `metric.stale-active-count` | Is measurement coverage stale? | active metrics without a recent snapshot | 0 | 2 | above |
| `capability.status-reality-mismatch-count` | Does runtime state match durable facts? | stale projects, stale metrics, orphan terminal sessions, missing heartbeat agents | 0 | 3 | above |
| `capability.zombie-session-count` | Are sessions stuck alive? | running/idle sessions older than stale cutoff | 0 | 2 | above |

### Additional Built-In Metrics

These are measured but not in the prioritized tables above:

- `handler.completed-count` — completions in 6h
- `handler.failed-count` — failures in 6h
- `handler.p95-duration` — 95th percentile handler duration in 6h
- `handler.fires-per-hour` — handler starts in 1h
- `evaluator.aftermath-coverage-rate-3h` — aftermath pipeline liveness, not a north-star quality goal
- `project.active-count` — observable count of projects currently pushing; not a health target by itself
- `project.blocked-count` — true blocked projects only
- `project.stale-active-count`

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

### All-Green ≠ Healthy: Known Structural Blind Spots (KE-726)

**Reading the dashboard:** if any prioritized metric is red, treat it as a signal to investigate that layer. **All-green is necessary but not sufficient** — see below before treating green as evidence of healthy production.

The "all green → healthy" reading was falsified at 2026-05-03 20:17Z: every prioritized metric was green at the moment the system had been producing zero real project iterations for 7h. Each metric has a floor or counting rule that prevents it from alerting in a specific failure mode the metric *names*:

- `project.iterations-24h` — formerly had an unreachable floor and counted closed-project ghost iterations. It now counts only active project iterations and is watch-only because zero active iterations can be healthy when every project is waiting on valid watch conditions.
- `project.active-count` — formerly required `>=1`, which encouraged fake active projects. It is now observability only: zero active projects is healthy when waiting projects have clear resume signals.
- `project.blocked-over-6h` — now counts only true `blocked` projects. `waiting` is a normal watch state and should not page by itself.
- `project.stale-active-count` — registry `threshold=2`, alert_op=`>`. Demands ≥3 simultaneous stale-active projects to fire, but with `active-count` capped near 1 in practice this metric cannot breach in the failure mode it describes. **Not currently in the prioritized set** despite being the most direct signal for KE-724-class drift.
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

## Pipeline

```
metrics-snapshot handler
  -> upserts built-in metric rows
  -> measures events, sessions, projects, and output
  -> records values to metrics + metric_snapshots
  -> custom metric section runs source_query/source_command metrics
  -> alerts are represented in metric_alerts
  -> metric-alert-reactor handles metric.breach events or unresolved alerts
```

The usual path is project/context-driven: agents see metric state and unresolved
alerts, read the relevant project context when one exists, and decide what the
signal means. `metric-alert-reactor` forks an owner directly only for P0
breaches; lower-priority alerts remain visible for heartbeat/project/steward
handling.

Agents handling an alert must follow
[manual/metric-alerts.md](../2b-manual/metric-alerts.md): judge the alert, choose one
operation, and either investigate then fix, calibrate, downgrade, upgrade or
escalate, resolve stale state, or document an exception.

## Alert Rules

- `alert_op: "<"` — alert when `current < threshold`.
- `alert_op: ">"` — alert when `current > threshold`.

Owner convention:

1. `metrics.owner` if set.
2. `projects.owner` when `metrics.owner` is empty and `metrics.project` points
   to a project row.
3. Metric id prefix if it matches an agent name.
4. `may` by default.

System-wide `project.*` metrics with no `metrics.project` stay owned by `may`.
Project-scoped metrics route to the project owner only when they do not declare
their own `metrics.owner`.

Ownership routing is runtime behavior, not an agent triage operation. Agents
should not manually reroute alerts by editing `metrics.owner`; if routing is
wrong, fix `metrics.project`, the project row's `owner`, or the resolver code.

Some built-ins also define handler-local alert config in
`metrics-snapshot.ts` for rate, sustained, or stall semantics.

## Custom Metrics

Agents can add domain metrics by inserting rows with a query or command:

```sql
INSERT INTO metrics (id, name, owner, type, source_query, threshold, alert_op, status)
VALUES (
  'coach.skill-eff',
  'Skill effectiveness',
  'coach',
  'gauge',
  'SELECT avg(score) FROM evaluations WHERE agent = "coach"',
  0.4,
  '<',
  'active'
);
```

The snapshot handler runs custom `source_query` / `source_command` rows and
records their values.

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

## Implementation

- **Source of truth**: `metrics` table in DB. This doc is design rationale.
- **Snapshot handler:** `agents/may/handlers/metrics-snapshot.ts` — auto-registers, measures every 5min, emits `metric.breach` events when `breached && !openAlert`
- **Alert reactor:** `agents/may/handlers/metric-alert-reactor.ts` — consumes `metric.breach` events. P0 forks the owner directly. P1+ remain visible for heartbeat/project/steward handling.
- **DB schema:** `src/lib/db/schema.ts`
- **Retention**: snapshots kept 30 days, pruned after each measurement run
- **Error isolation**: each metric measured independently — one failure doesn't block others
