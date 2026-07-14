# Metric alert triage — `aks-rp-e2e.process.assignment-state-mismatch-count` (alert 3613)

- Date: 2026-07-14
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.assignment-state-mismatch-count`
- Alert id: `3613`
- Owner: `app-ops`

## Judgment

This alert row is stale. The breach that opened alert `3613` has already recovered in the live metric source and in the persisted metric row, but the alert row still has `resolved_at = null`.

## Evidence checked

### 1) The persisted metric row is now back in range

```sql
SELECT id, current, threshold, target, priority, status, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.assignment-state-mismatch-count';
```

Observed result excerpt:

- `current = 0`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1784010086839`

### 2) The alert row is still open and still describes the old spike

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3613;
```

Observed result excerpt:

- `message = "AKS RP E2E assignment state mismatch count is above threshold: current=3, threshold=0, target=0"`
- `resolved_at = null`
- `created_at = 1784009846185`

### 3) Latest persisted snapshots show the spike already decayed to zero

```sql
SELECT value, sample_size, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.assignment-state-mismatch-count'
ORDER BY measured_at DESC
LIMIT 10;
```

Observed result excerpt:

- latest snapshot: `value = 0` at `1784010086839`
- prior snapshot: `value = 3` at `1784009780035`
- the eight earlier snapshots in the returned window were all `0`

So the alert came from a single brief spike and the persisted metric state has already returned to normal.

### 4) A recovery event for this exact post-alert incident already exists

```sql
SELECT id, event_type, source, owner, timestamp, delivery_status,
       json_extract(data, '$.metricId') AS metricId,
       json_extract(data, '$.current') AS current
FROM events
WHERE event_type = 'metric.recovered'
  AND json_extract(data, '$.metricId') = 'aks-rp-e2e.process.assignment-state-mismatch-count'
  AND timestamp >= 1784009846185
ORDER BY timestamp DESC
LIMIT 10;
```

Observed result:

- `id = 3166764`
- `event_type = metric.recovered`
- `timestamp = 1784010138355`
- `delivery_status = accepted`
- `current = 0`

That means the runtime has already recorded recovery for the same alert window.

### 5) Fresh live recompute also returns zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.assignment-state-mismatch-count --json
```

Observed result:

```json
{"measuredAt":1784010101289,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

### 6) Current open project.task pairs match active live work, not stale mismatches

```sql
SELECT correlation_key, status, owner, opened_at, expected_close_at, closed_at, note
FROM event_pair_runs
WHERE pair_name = 'project.task'
  AND status IN ('open','orphan')
ORDER BY opened_at DESC
LIMIT 20;
```

Observed result:

- only one row is open: `ops/reconcile-shared-auth-owner-return-family-shape-20260714:a_ops_reconcile-shared-auth-owner-return-family-shape-20260714_20260714061800`
- that row is still `status = open`

Current task-tree summary confirms this is active live work, not a mismatch contributor:

- `frontier.active` includes `ops/reconcile-shared-auth-owner-return-family-shape-20260714`
- `frontier.active` also includes `domain/windows-vm-prerelease-draft-family-surface-reconcile-20260714`
- `roots = ["project"]`

## Why this is `resolve_stale`

The alert row still reflects a prior brief spike, but both the persisted metric row and a fresh live recompute already show `0`, and a `metric.recovered` event for this same post-alert window has already been accepted. The remaining issue is alert lifecycle lag, not a live assignment-state mismatch.

## Next validation

Validate on the next alert-lifecycle refresh for alert `3613` or the next `metrics-snapshot`. Expected state:

- `metrics.current` remains `0`
- alert `3613` gains a non-null `resolved_at`
- no new `project.task` mismatches appear in fresh recomputes
