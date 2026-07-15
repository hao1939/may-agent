# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3691)

- Date: 2026-07-14
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3691`
- Owner: `app-ops`

## Judgment

This alert is stale in persisted runtime state, not a currently reproducible task-tree integrity defect.

The persisted metric row and open alert still show `current = 2`, but a fresh live recompute of the metric source command now returns `0`. The metric definition computes `task-tree-problem-count` from current live task-tree integrity state, so a current live value of `0` means the breach behind alert `3691` is no longer present in the source of truth.

The most likely cause of the stale alert is timing: alert `3691` was opened from the `1784048838701` sample, then planner work completed at `1784049034962`, and a fresh recompute at `1784049051206` already returned `0` before the next supported metrics snapshot refreshed the persisted `metrics.current` row.

## Evidence checked

### 1) Persisted metric row still shows the old breach

```sql
SELECT id, current, threshold, target, priority, project, source_command, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.integrity.task-tree-problem-count';
```

Result excerpt:

- `current = 2`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `source_command = bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count`
- `updated_at = 1784048838701`

### 2) The alert row is still open

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3691;
```

Result excerpt:

- `resolved_at = null`
- message says `current=2, threshold=0, target=0`

### 3) Latest persisted snapshots show the spike that created this alert

```sql
SELECT value, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.integrity.task-tree-problem-count'
ORDER BY measured_at DESC
LIMIT 10;
```

Result excerpt:

- latest sample at `1784048838701` = `2`
- two immediately prior samples at `1784048531640` and `1784048224031` were `0`

### 4) Fresh live recompute is now zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed result:

```json
{"measuredAt":1784049051206,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

### 5) Metric implementation reads current live task-tree integrity state

Source excerpt from `scripts/project-metrics.ts`:

```ts
"aks-rp-e2e.process.integrity.task-tree-problem-count": () => ({
  value: tasks.taskTreeProblemCount,
}),
```

And metric registration describes it as:

> P0 process signal: the task tree has structural integrity problems such as a root count other than one. This can hide work outside the intended project tree, so planner repair or intentional archive/disposition is required.

### 6) Recent owner sessions line up with a transient spike that was already repaired

Relevant sessions:

- `s_project_planner_planning_update_20260714170819_61bmmz` finished at `1784049034962`
- `s_project_planner_event_review_20260714171036_rc6hk1` finished at `1784049064322`
- alert `3691` was created earlier at `1784048891978`

So the live recompute returning `0` after those planner completions is consistent with a repaired source-of-truth state that the persisted metric row has not refreshed yet.

## Why this is `resolve_stale`

- The live source of truth is back in range.
- The persisted metric row and alert row still reflect an earlier spike.
- No safe runtime write path is available in this session to edit `metric_alerts` directly.
- The correct owner action is therefore to record the stale-state judgment and let the next supported metrics snapshot / alert reconciliation cycle refresh persisted state and auto-resolve the alert.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh for `aks-rp-e2e.process.integrity.task-tree-problem-count`.

Expected recovery signal:

- recomputed metric remains `0`
- `metrics.current` refreshes from `2` to `0`
- alert `3691` resolves automatically
