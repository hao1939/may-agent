# Metrics & Alerts

## Overview

The metrics system measures system health automatically. Metrics are signals:
they point to possible drift, progress, regression, or stale measurement. Agents
judge the meaning using project context, facts, and recent history. Built-in metrics are
owned by `agents/may/handlers/metrics-snapshot.ts`; custom metrics can be added
with `source_query` or `source_command`.

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

## Built-In Health Metrics

**Handler health:**
- `handler.completed-count` — completions in 6h
- `handler.failed-count` — failures in 6h
- `handler.success-rate` — completed / total in 6h
- `handler.heartbeat-coverage` — distinct agents with heartbeat completions in 2h
- `handler.p95-duration` — 95th percentile handler duration in 6h
- `handler.fires-per-hour` — handler starts in 1h

**Session/system health:**
- `session.error-rate-6h` — sessions ending error/interrupted in 6h
- `session.failed-triage-rate-3h` — failed/interrupted sessions that received `needs_improvement` triage
- `system.real-output-24h` — substantive changed files in 24h

**Evaluator health:**
- `evaluator.aftermath-coverage-rate-3h` — aftermath pipeline liveness, not a north-star quality goal
- `evaluator.low-quality-rate-24h` — share of evaluated sessions with `needs_improvement`/`low_quality` verdicts or low quality/efficiency scores
- `evaluator.stale-running-session-count` — running/idle non-evaluator sessions older than the stale cutoff

**Project health:**
- `project.active-count`
- `project.blocked-count`
- `project.stale-active-count`
- `project.iterations-24h`
- `project.blocked-over-6h`

**Status honesty:**
- `metric.stale-active-count`
- `capability.status-reality-mismatch-count`
- `capability.zombie-session-count`

Conformance/tracking metrics such as `v2.*`, trace-completeness,
self-directed rate, process uptime, concurrency peak, tool-preset drift,
project blocked-rate, and dynamic per-agent low-quality streaks are retired from
active alerting unless they become operationally load-bearing again. Their
history can remain in the DB, but they should not be handled as live system
health alerts.

## Metric Types

- `gauge` — point-in-time value, can go up or down.
- `counter` — count/rate of events or output.
- `health` — pass/fail or count-of-failures signal.
- `derived` — computed from other metrics.

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
[manual/metric-alerts.md](manual/metric-alerts.md): judge the alert, choose one
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

## Implementation

- **Snapshot handler:** `agents/may/handlers/metrics-snapshot.ts`
- **Alert reactor:** `agents/may/handlers/metric-alert-reactor.ts`
- **DB schema:** `src/lib/requests.ts`
