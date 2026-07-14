# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3698)

- Date: 2026-07-14
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3698`
- Owner: `app-ops`

## Judgment

This alert is stale in persisted runtime state, not a currently reproducible task-tree integrity defect.

The persisted metric row still shows `current = 3` and alert `3698` is still open, but a fresh live recompute now returns `0` and the current app integrity audit passes. Because this metric is computed from current live task-tree shape and mismatch audits, a current live value of `0` means the breach behind alert `3698` is no longer present in the source of truth.

## Evidence checked

### 1) Persisted metric row still shows the old breach

```sql
SELECT id, current, threshold, target, priority, status, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.integrity.task-tree-problem-count';
```

Result excerpt:

- `current = 3`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1784050948062`

### 2) The alert row is still open

```sql
SELECT id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3698;
```

Result excerpt:

- `resolved_at = null`
- message says `current=3, threshold=0, target=0`

### 3) Latest persisted snapshots show a brief spike rather than sustained failure

```sql
SELECT value, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.integrity.task-tree-problem-count'
ORDER BY measured_at DESC
LIMIT 10;
```

Result excerpt:

- latest sample at `1784050948062` = `3`
- immediately previous sample at `1784050648046` = `0`
- the series alternates between zero and brief spikes, not a sustained degraded state

### 4) Fresh live recompute is now zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed result:

```json
{"measuredAt":1784051248996,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

### 5) Integrity passes now

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run integrity
```

Observed result:

```text
[warn] domain workspace still contains tasks/; app-control task trees belong in aks-rp-e2e.app/tasks/
[warn] domain workspace still contains agents/; app-control agent workspace belongs in aks-rp-e2e.app/agents/
App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=130
```

## Why this is `resolve_stale`

- The live source of truth is back in range.
- The persisted metric row and alert row still reflect the older spike.
- No safe runtime write path is available in this session to edit `metric_alerts` directly.
- The correct owner action is therefore to record the stale-state judgment and wait for the next supported metrics snapshot / alert reconciliation cycle to refresh persisted state.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh for `aks-rp-e2e.process.integrity.task-tree-problem-count`.

Expected recovery signal:

- recomputed metric remains `0`
- `metrics.current` refreshes from `3` to `0`
- alert `3698` resolves automatically
