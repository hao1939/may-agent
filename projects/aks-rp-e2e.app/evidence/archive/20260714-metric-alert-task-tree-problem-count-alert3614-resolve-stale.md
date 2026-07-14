# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3614)

- Date: 2026-07-14
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3614`
- Owner: `app-ops`

## Judgment

This alert is stale relative to the current live source of truth.

The persisted metric row still says `current=1` from sample `1784010399580`, and alert `3614` remains open from that same breach window. But a fresh live recompute now returns `value=0`, `bun run integrity` reports `App integrity OK`, and `bun run task-tree summary` shows exactly one root (`project`). That means the underlying task-tree integrity defect is no longer present now; the stale surface is the persisted alert/metric lifecycle waiting for the next snapshot refresh.

## Evidence checked

### 1) Persisted metric row is still breaching

```sql
SELECT id, current, threshold, target, priority, status, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.integrity.task-tree-problem-count';
```

Result excerpt:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1784010399580`

### 2) Alert row is still open

```sql
SELECT id, metric_id, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3614;
```

Result excerpt:

- `resolved_at = null`
- message = `AKS RP E2E task tree integrity problems is above threshold: current=1, threshold=0, target=0`

### 3) Recent persisted snapshots show a transient spike pattern

```sql
SELECT value, sample_size, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.integrity.task-tree-problem-count'
ORDER BY measured_at DESC
LIMIT 5;
```

Result excerpt:

- latest persisted sample at `1784010399580` = `1`
- previous persisted sample at `1784010086839` = `0`
- earlier sample at `1784009780035` = `4`
- earlier samples before that were `0`

This is a brief-spike pattern rather than evidence of a sustained ongoing structural break.

### 4) Fresh live recompute is already healthy

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed result:

```json
{"measuredAt":1784010470362,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
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
App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=128
```

### 6) Live task-tree summary shows the expected single root

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree summary
```

Observed excerpt:

```json
{
  "roots": ["project"],
  "active_task_ids": ["ops/harden-approval-blocker-refresh-preserve-waiting-for-20260714"],
  "counts": {"done": 1, "blocked": 123, "active": 1}
}
```

## Why this is `resolve_stale`

- The live metric source now returns `0`.
- App integrity is currently OK.
- The live task tree still has exactly one root.
- The remaining inconsistency is the stale persisted breach/alert lifecycle, not a current structural task-tree defect.
- This session only has read-only DB access, so the safe action is to record the stale-state judgment and let the next snapshot/alert refresh reconcile the stale row instead of making ad hoc DB edits.

## Next validation

Next validation point: the next `metrics-snapshot` / alert refresh should move the persisted metric back to `0` and clear alert `3614` automatically.
