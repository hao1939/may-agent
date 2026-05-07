# Metrics & Alerts

## Overview

The metrics system measures system health automatically. Built-in metrics are
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

## Built-In Health Metrics (14)

**Handler health:**
- `handler.completed-count` — completions in 6h
- `handler.failed-count` — failures in 6h
- `handler.success-rate` — completed / total in 6h
- `handler.heartbeat-coverage` — distinct agents with heartbeat completions in 2h
- `handler.p95-duration` — 95th percentile handler duration in 6h
- `handler.fires-per-hour` — handler starts in 1h

**Session/system health:**
- `session.error-rate-6h` — sessions ending error/interrupted in 6h
- `system.real-output-24h` — substantive changed files in 24h

**Project health:**
- `project.active-count`
- `project.blocked-count`
- `project.stale-active-count`
- `project.iterations-24h`
- `project.blocked-rate-7d`
- `project.blocked-over-6h`

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

The usual human-facing path is still heartbeat-driven: agents see metric state
and unresolved alerts during heartbeat context and decide what to do. The
`metric-alert-reactor` can also fork an owner directly for unresolved breaches.

## Alert Rules

- `alert_op: "<"` — alert when `current < threshold`.
- `alert_op: ">"` — alert when `current > threshold`.

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
