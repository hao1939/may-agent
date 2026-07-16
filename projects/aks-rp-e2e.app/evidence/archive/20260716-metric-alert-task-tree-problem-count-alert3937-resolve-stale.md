# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3937)

- Date: 2026-07-16
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3937`
- Owner: `app-ops`

## Judgment

This alert is already resolved in runtime state and is stale only in the workflow prompt.

The prompt carried an earlier snapshot where the metric still read `current = 1` and alert `3937` was open. By the time of this triage, the persisted runtime metric row had already recovered to `current = 0`, alert `3937` had a non-null `resolved_at`, the latest stored metric snapshot was `0`, a fresh owner-side recompute also returned `0`, and the live task tree summary showed the expected single `project` root.

That means there is no live task-tree integrity breach left for app-ops to repair in this session. The correct owner action is to record that the alert payload is stale relative to current runtime truth.

## Evidence checked

### 1) The alert row from the prompt now shows resolved

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3937;
```

Result excerpt:

- `resolved_at = 1784204982981`
- `created_at = 1784203511797`
- message still reflects the earlier breach: `current=1, threshold=0, target=0`

### 2) There is no longer any open alert row for this metric

```sql
SELECT id, metric_id, message, resolved_at, created_at
FROM metric_alerts
WHERE metric_id = 'aks-rp-e2e.process.integrity.task-tree-problem-count'
  AND resolved_at IS NULL
ORDER BY created_at DESC;
```

Result excerpt:

- `0 rows`

### 3) The persisted metric row is already back in range

```sql
SELECT id, current, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.integrity.task-tree-problem-count';
```

Result excerpt:

- `current = 0`
- `updated_at = 1784204814906`

### 4) Latest stored snapshots show the breach already recovered

```sql
SELECT value, measured_at, measured_by
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.integrity.task-tree-problem-count'
ORDER BY measured_at DESC
LIMIT 5;
```

Result excerpt:

- latest sample at `1784204814906` = `0`
- four prior samples at `1784204486420`, `1784204156670`, `1784203823920`, and `1784203162714` were `1`

### 5) Fresh owner-side recompute also returns zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed result:

```json
{"measuredAt":1784204977713,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

### 6) Live task tree currently has the expected one-root shape

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree summary
```

Observed excerpt:

```json
{
  "roots": ["project"],
  "active_task_ids": ["domain/fix-storage-csi-disk-pvc-compact-direct-path"]
}
```

### 7) A planner repair completed just before recovery landed

```sql
SELECT sessionId, status, source, startedAt, endedAt, outcome
FROM sessions
WHERE sessionId = 's_project_planner_planning_update_20260716122226_dqu88h';
```

Result excerpt:

- `status = done`
- `source = workflow:project-planner`
- `endedAt = 1784204897541`

This places a successful planner repair in the same recovery window as the persisted metric flip to `0` (`metrics.updated_at = 1784204814906`) and the later alert resolution (`metric_alerts.resolved_at = 1784204982981`).

## Why this is `resolve_stale`

- The workflow payload described a real earlier breach, but current runtime state no longer does.
- The alert row itself is already resolved.
- The persisted metric row is already `0`.
- A fresh recompute agrees with the persisted recovered state.
- No further root-cause repair or calibration is needed from this session.

## Next validation

Next validation point: the next `metrics-snapshot` for `aks-rp-e2e.process.integrity.task-tree-problem-count` should remain `0`, and no new open alert row should appear unless a fresh task-tree integrity regression is introduced.
