# Metrics & Alerts

## Overview

The metrics system measures system health automatically. If a metric exists, it's watched.

## Schema

```sql
CREATE TABLE metrics (
  id TEXT PRIMARY KEY, name TEXT, owner TEXT, current REAL,
  target REAL, threshold REAL, unit TEXT,
  type TEXT, status TEXT, speed TEXT, alert_op TEXT,
  source_query TEXT, source_command TEXT,
  created_at INTEGER, updated_at INTEGER
);

CREATE TABLE metric_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id TEXT NOT NULL, value REAL NOT NULL,
  sample_size INTEGER, measured_at INTEGER NOT NULL, measured_by TEXT
);
```

## Built-in Health Metrics (12)

**Handler (6):** completed-count, failed-count, success-rate, heartbeat-coverage, p95-duration, fires-per-hour

**Project (6):** active-count, blocked-count, stale-active-count, iterations-24h, blocked-rate-7d, blocked-over-6h

## Pipeline

```
metrics-snapshot handler (every 5min)
  → queries events + projects tables
  → records to metrics + metric_snapshots
  → metric-alert-reactor detects breaches
  → emits metric.breach event
  → agent sees breach in heartbeat inbox
```

## Alert Rules

- `alert_op: "<"` — alert when `current < threshold` (too low)
- `alert_op: ">"` — alert when `current > threshold` (too high)

## Custom Metrics

```sql
INSERT INTO metrics (id, name, owner, source_query, threshold, alert_op, status)
VALUES ('coach.skill-eff', 'Skill effectiveness', 'coach',
  'SELECT avg(score) FROM evaluations WHERE agent="coach"', 0.4, '<', 'active');
```

The snapshot handler auto-runs `source_query`, records value, checks thresholds.

## Implementation

- **Snapshot:** `agents/may/handlers/metrics-snapshot.ts`
- **Alerts:** `agents/may/handlers/metric-alert-reactor.ts`
- **Schema:** `src/lib/requests.ts`
