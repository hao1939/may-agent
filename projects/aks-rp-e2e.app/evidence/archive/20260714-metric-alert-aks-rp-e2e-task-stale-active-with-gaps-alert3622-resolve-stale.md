# Metric alert triage — `aks-rp-e2e.task.stale-active-with-gaps` (alert 3622)

- Date: 2026-07-14
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.task.stale-active-with-gaps`
- Alert id: `3622`
- Owner: `app-ops`

## Judgment

This specific alert is stale relative to current runtime state and has already
recovered in the live metric lifecycle.

The breach existed briefly (`value=1` at `1784013808444`), but the current
metric row now reports `current=0`, alert `3622` already has a non-null
`resolved_at`, and the recovery event for the same alert was emitted at
`1784014168632`. Current active leaves with attached sessions are also healthy:
`reconcile-spec-loop-pending-secops-fips` and
`ops/reconcile-localdns-frontier-family-shape-after-quota-narrowing-20260714`
both still have running task-worker sessions with nonzero `opCount` and recent
`lastActivityAt`, so there is no present stale-active condition to repair.

## Evidence checked

### 1) Alert 3622 is already resolved in runtime DB

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3622;
```

Result excerpt:

- `resolved_at = 1784014168609`
- `created_at = 1784013854181`

### 2) The metric row is currently healthy

```sql
SELECT id, current, threshold, target, priority, status, updated_at, project
FROM metrics
WHERE id = 'aks-rp-e2e.task.stale-active-with-gaps';
```

Result excerpt:

- `current = 0`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`

### 3) Recent snapshots show a transient spike, not an ongoing breach

```sql
SELECT value, sample_size, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.task.stale-active-with-gaps'
ORDER BY measured_at DESC
LIMIT 5;
```

Result excerpt:

- latest persisted sample at `1784014118752` = `0`
- previous sample at `1784013808444` = `1`
- earlier samples before that were `0`

### 4) Metric lifecycle emitted both breach and recovery for the same alert

```sql
SELECT event_type, timestamp
FROM events
WHERE data LIKE '%aks-rp-e2e.task.stale-active-with-gaps%'
  AND event_type IN ('metric.breach', 'metric.recovered')
ORDER BY timestamp DESC
LIMIT 2;
```

Result excerpt:

- `metric.recovered` at `1784014168632` for alert `3622`
- `metric.breach` at `1784013854207` for alert `3622`

### 5) Current active work is attached to healthy running sessions

Current active task-tree leaves include:

- `reconcile-spec-loop-pending-secops-fips`
- `ops/reconcile-localdns-frontier-family-shape-after-quota-narrowing-20260714`

Matching running sessions now show:

- `s_task_reconcile-spec-loop-pending-secops-fips` → `status=running`, `opCount=25`, recent `lastActivityAt`
- `s_task_ops_reconcile-localdns-frontier-family-shape-after-quota-narrowing-20260714` → `status=running`, `opCount=3`, recent `lastActivityAt`

That means the current live frontier is not carrying an obviously dead active
leaf.

### 6) Metric definition still matches intended policy

`projects/aks-rp-e2e.app/scripts/register-project-metrics.ts` still defines
this metric as a P0 stuck-state detector:

> "the task tree says work is active, but at least one active leaf has no
> healthy worker session while model path gaps or unverified specs remain"

So this alert should remain enabled; the right judgment for alert `3622` is not
calibration, but acknowledging that this particular row already recovered.

## Why this is `resolve_stale`

- The current source of truth is healthy (`metrics.current = 0`).
- The alert row itself is no longer open (`resolved_at` is set).
- The event stream already recorded `metric.recovered` for alert `3622`.
- Current active leaves are backed by healthy running sessions, so there is no
  live stale-active leaf left for app-ops to repair now.
- A prior same-family alert (`3607`) did require real repair, so the metric is
  still useful; this alert instance is simply already resolved.

## Next validation

Next validation point: the next `metrics-snapshot` should continue to keep
`aks-rp-e2e.task.stale-active-with-gaps` at `0`; if a later sample returns `1`
again, that would be a fresh breach rather than unfinished work from alert
`3622`.
