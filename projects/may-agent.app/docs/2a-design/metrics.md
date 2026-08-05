# Metrics & Alerts

**Design status:** Accepted.
**Implementation status:** Implemented. Recording and alert evaluation are
mechanical; owner-targeted events wake declared app routes.

## Overview

Metrics are **the system's vital signs**. They measure system health, execution
quality, and progress toward project goals. They are how the system _sees itself_.

The primary question is not "did we evaluate enough sessions?" The primary
question is "is the system completing useful work, and when it fails, does the
right owner act on the failure?" Coverage metrics are kept as liveness/meta
signals only.

Metrics do not directly drive work. The unified work model is:

- A metric breaches → the breach is recorded as state and emitted as an event.
- Every breach resolves to one accountable owner route and carries project
  context when available.
- Project blocked-frontier metrics should first wake the project owner with
  compact blocked/dependency context. The owner classifies blockers, creates or
  links local problem/unblock work, keeps true external waits precise, and
  escalates only when the blocker crosses an ownership boundary.
- A project app consumes the event through a declared event/task selector.
  Periodic app-owner review is the recovery path for a missed or unchanged
  signal; no global agent calls another app's owner directly.
- The agent **judges** what the signal means using goal, facts, history, and a causal theory, then acts, records evidence, or escalates.
- **P0 (urgent) metrics wake the owning app immediately.** Lower priorities use
  the app's declared routing and normal owner-review cadence.

This is intentional. Forking on every breach creates reactive churn. Metrics
are observations that enter an ownership loop, not acceptance decisions.

Built-in metrics are measured by
`projects/may-agent.app/agents/tech-lead/handlers/metrics-snapshot.ts`; custom
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

## Runtime metric catalog

The runtime catalog, not this design document, is the authority for concrete
metric IDs, formulas, targets, thresholds, priorities, and active/retired
status:

- built-in definitions: `ALL_METRICS` in
  `projects/may-agent.app/agents/tech-lead/handlers/metrics-snapshot.ts`;
- current runtime status and custom definitions: the `metrics` table; and
- historical values: `metric_snapshots`.

Do not copy the full catalog into design docs. It changes independently and a
stale table is worse than no table.

Every operational metric definition must state:

- the question it answers;
- accountable owner and optional project;
- source, window, sample requirements, and known blind spots;
- direction, target, threshold, and priority;
- whether it is alerting, watch-only, or retired; and
- what observation closes or recovers an alert.

A formula change that changes meaning requires a new metric ID or an explicit
semantic cutover. Values from different meanings must not be compared as one
series. Retiring a metric preserves history, marks it retired, resolves open
alerts, and stops future measurement.

### Interpretation

A breach is evidence to investigate, not proof of failure. An all-green
dashboard is a bounded statement about the registered measurements, not proof
that useful work is happening. Confirm domain claims with the owning project's
facts, task receipts, workflow evidence, sessions, and traces.

Useful metric classes include:

| Class | Examples of questions |
| --- | --- |
| Infrastructure | Are handlers, delivery, persistence, schedules, and the daemon operating? |
| Execution | Are sessions starting, finishing, and recovering honestly? |
| Evaluation | Is quality review live, substantive, delivered, and closed? |
| Project/domain | Is an owned domain fact outside its expected operating range? |
| Meta-metric | Is measurement itself stale, pinned, noisy, or structurally invalid? |

Project and content metrics should default to watch-only until evidence shows
that an immediate wake improves outcomes. A count of activity is not a quality
measure, and an evidence-backed no-op is not automatically a failure.

Coverage and quality are different. For example, evaluation-lane lag can prove
that a review lane is quiet; it cannot by itself prove why it is quiet or that
more reviews should be created. The owner checks eligibility, schedules,
runtime failures, and skip rules before acting.

## Pipeline

```
metrics-snapshot handler
  -> upserts built-in metric rows
  -> measures events, sessions, projects, and output
  -> records values to metrics + metric_snapshots
  -> custom metric section runs source_query/source_command metrics
  -> alerts are represented in metric_alerts
  -> metric.breach routes to the resolved metric/project owner
  -> matching app selectors may translate it into project work
  -> each owning app reconciles the signal toward an owner disposition
  -> the app's periodic owner review recovers missed or unchanged signals
```

The metrics handler measures and records metrics only. Database retention,
filesystem pruning, WAL management, and compaction are runtime maintenance and
must not run inside `metrics-snapshot` or any agent execution. See
[storage.md](storage.md#retention-and-maintenance).

Project-health observations come from app-owned watchers, controller state, and
bounded metrics. A metric breach may wake the app resolver or owner, but it does
not mutate task meaning. The owner reviews task resources, Conditions, attempts,
project facts, and recent events before deciding whether to return task actions,
calibrate the metric, record an exception, or escalate.

Waiting tasks depend on typed Conditions whose truth comes from a watcher or
semantic event. Metrics may alert on stale observation infrastructure, but task
resync never treats metric age as Condition truth. Historical notes and weak
signals do not make a project active by themselves.

The usual path is app-owner driven. The metric event wakes the app; the app
decides whether to create or repair work, calibrate the signal, accept an
exception, or request human authority. Periodic owner review supplies the
Kubernetes-style safety net without a second alert scheduler.

Agents handling an alert must follow
[metric-alerts.md](../2b-manual/metric-alerts.md): judge the alert, choose one
operation, and either investigate then fix, calibrate, downgrade, upgrade or
escalate, resolve stale state, or document an exception.

## Alert Rules

- `alert_op: "<"` — alert when `current < threshold`.
- `alert_op: ">"` — alert when `current > threshold`.

Owner convention:

1. `metrics.owner` if set.
2. `project:<id>` when the definition names a project but no explicit owner.
3. Metric id prefix if it matches an agent name.
4. the `may-agent.app` platform owner by default.

System-wide metrics with no project stay owned by `may-agent.app`. An explicit
owner wins and is responsible for preserving project context or handing the
issue back when needed.

Ownership routing is runtime behavior, not an agent triage operation. Agents
should not manually reroute alerts by editing `metrics.owner`; if routing is
wrong, fix `metrics.project`, the project row's `owner`, or the resolver code.

Project feedback:

- `metric.breach` preserves the resolved owner and project target.
- A project app must declare a matching selector before it translates that
  signal into `project.owner.requested` or a task intent.
- The event carries `metricId`, current value, threshold, priority, direction,
  snapshot time, alert id, and any recent trend points available.
- The project owner decides what the signal means. The runtime does not create
  task-tree branches, mark tasks blocked, or page a human. The app owner decides
  whether a real human decision exists.
- `metric.recovered` follows the same project owner path so stale alert context
  can be closed or annotated instead of silently disappearing.
- Prefer narrow `metricIds` selectors when only known metrics need app-specific
  handling. A bare selector is appropriate only for an app that intentionally
  owns all matching project metric feedback.

Some built-ins also define handler-local alert config in
`metrics-snapshot.ts` for rate, sustained, or stall semantics.

## Custom Metrics

Define and record metrics through the supplied metric capability rather than
writing runtime tables directly:

```ts
sdk.metrics.define({
  id: "scout.source-check-failures",
  owner: "scout",
  project: "scout-knowledge-lib",
  type: "counter",
  threshold: 3,
  alertOp: ">",
  status: "active",
});

sdk.metrics.record("scout.source-check-failures", failures, {
  sampleSize: checks,
  measuredBy: "scout-source-observer",
});
```

Deterministic infrastructure handlers may define `sourceQuery` or
`sourceCommand` metrics. Agent reasoning should use supplied tools/SDK
capabilities rather than embedding database access into the agent runtime core.

## Balanced interpretation

When a project uses outcome metrics, compare different dimensions where that
reduces gaming:

```
Activity  → "Am I doing the work?"
Impact    → "Is the work making a difference?"
```

This is guidance, not a requirement to invent two metrics for every project.
Use a metric only when its source and meaning are trustworthy. Activity without
impact may indicate busywork; impact without enough observations may be noise.

### Cadence & Phase Awareness

Metrics are **slow-moving signals**. Don't chase them daily.

- **Check weekly**, note direction not absolute value
- **Match to phase**: during experiments, activity metrics may stall (that's fine — you're building evidence). During deployment, watch impact closely.
- **One action per heartbeat, not three.** If multiple metrics are off, pick the one that matters most for your current phase. Chasing all simultaneously causes thrashing.
- **Override signals with judgment:** A metric dip right after deploying a new intervention is expected (lagging indicator). Don't panic-react.

## Metric Lifecycle

Metrics evolve:

1. **Create** — define in the metric registry or project/app metric setup with
   owner, project context when applicable, target, threshold, and closure path
2. **Measure** — metrics-snapshot handler records automatically
3. **Observe** — start watch-only and validate meaning and noise
4. **Alert** — enable a wake only when it improves the ownership loop
5. **Calibrate** — revise threshold, priority, or interpretation from evidence
6. **Retire or replace** — stop a metric whose meaning is weak or obsolete

Meeting a target may mean the system is healthy, the threshold is too weak, or
the metric is no longer useful. Owner judgment decides which.

## Implementation

- **Definition authority:** built-ins in `ALL_METRICS`; custom/current runtime
  definitions and status in the `metrics` table.
- **Snapshot handler:** `projects/may-agent.app/agents/tech-lead/handlers/metrics-snapshot.ts` — auto-registers, measures every 5min, and emits owner-targeted metric events.
- **Alert handling:** each owning app declares its metric selectors and reconciles the signal; its periodic owner review is the recovery safety net.
- **DB schema:** `projects/may-agent/src/lib/db/schema.ts`
- **Retention**: snapshots kept 30 days, pruned after each measurement run
- **Error isolation**: each metric measured independently — one failure doesn't block others

## Metric feedback routing

`metric.breach`, `metric.recovered`, and `metric.stalled` preserve the
metric ID, owner, project target, current value, threshold, priority, alert ID,
measurement time, and bounded trend.

The current routing contract is:

```text
metric service records/evaluates
  -> emit owner-targeted metric event
  -> matching app event/task selector, when declared
     -> deterministic app translation or owner task intent
     -> metric.feedback.routed receipt
  -> periodic app-owner review rechecks unresolved state
```

An app is not selected merely because its owner name resembles the metric
prefix. It must declare a matching selector. Prefer a narrow project or
`metricIds` selector; use a type-only selector only when the app intentionally
owns every matching metric event.

`metric.feedback.routed` proves that the app route accepted the signal. It does
not prove owner judgment, remediation, metric recovery, or project/task
completion. The owning app continues reconciliation until it records a real
disposition.

The owner then chooses one evidence-backed disposition:

- create or repair meaningful domain work;
- repair broken execution or observation;
- calibrate, downgrade, retire, or replace a weak metric;
- record an accepted exception; or
- escalate when the next required action crosses an ownership boundary.

The runtime does not choose that response. It also does not create one task per
alert, mutate task state, satisfy a Condition from metric age, or treat recovery
as proof that related project work is complete. A standing metric-review task is
optional app organization, not a required runtime lane.
