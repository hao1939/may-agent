# Metrics & Alerts

## Overview

The metrics system measures system health automatically. No manual configuration — if a metric exists, it's watched.

## Schema

```sql
-- Metric definitions
CREATE TABLE metrics (
  id TEXT PRIMARY KEY,
  name TEXT, owner TEXT, current REAL,
  target REAL, threshold REAL, unit TEXT,
  type TEXT,    -- 'health' | 'domain'
  status TEXT,  -- 'active' | 'paused'
  speed TEXT,   -- 'fast' (5min) | 'daily'
  alert_op TEXT,  -- '<' (alert when below) | '>' (alert when above)
  source_query TEXT, source_command TEXT,
  created_at INTEGER, updated_at INTEGER
);

-- Time-series snapshots
CREATE TABLE metric_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id TEXT NOT NULL,
  value REAL NOT NULL,
  sample_size INTEGER,
  measured_at INTEGER NOT NULL,
  measured_by TEXT
);
```

## Built-in Health Metrics (12)

**Handler health (6):**
- `handler.completed-count` — completions in 6h (threshold: >10)
- `handler.failed-count` — failures in 6h (threshold: <3)
- `handler.success-rate` — ratio (threshold: >0.80)
- `handler.heartbeat-coverage` — distinct agents with heartbeat (threshold: >6)
- `handler.p95-duration` — 95th percentile ms (threshold: <600000)
- `handler.fires-per-hour` — total fires (threshold: >15)

**Project health (6):**
- `project.active-count`, `project.blocked-count`, `project.stale-active-count`
- `project.iterations-24h`, `project.blocked-rate-7d`, `project.blocked-over-6h`

## Pipeline

```
metrics-snapshot handler (every 5min)
  → queries events table + projects table
  → records values to metrics + metric_snapshots
  → metric-alert-reactor handler detects breaches
  → emits metric.breach event
  → agent sees breach in heartbeat inbox
```

## Alert Rules

- `alert_op: "<"` — alert when `current < threshold` (too low)
- `alert_op: ">"` — alert when `current > threshold` (too high)

## Custom Metrics

Agents add domain metrics by INSERT:
```sql
INSERT INTO metrics (id, name, owner, source_query, threshold, alert_op, status)
VALUES ('coach.skill-eff', 'Skill effectiveness', 'coach',
  'SELECT avg(score) FROM evaluations WHERE agent="coach"', 0.4, '<', 'active');
```

The snapshot handler auto-runs `source_query`, records the value, checks thresholds.

## Implementation

- **Snapshot handler:** `agents/may/handlers/metrics-snapshot.ts`
- **Alert reactor:** `agents/may/handlers/metric-alert-reactor.ts`
- **DB schema:** `src/lib/requests.ts` (metrics + metric_snapshots tables)
