# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3612)

- Date: 2026-07-14
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3612`
- Owner: `app-ops`

## Judgment

This alert is stale relative to the current source of truth.

The alert row is still open and still records the earlier `current=4` spike, but the persisted metric row has already refreshed back to `0`, the latest persisted snapshot is `0`, a fresh live recompute returns `0`, integrity passes, the live task tree still has exactly one `project` root, and the only open `project.task` event pair corresponds to the currently active live task.

Because `task-tree-problem-count` is computed from current live task-tree integrity state, a recovered persisted metric row plus a fresh recompute of `0` means the breach behind alert `3612` is no longer present. The remaining problem is stale alert lifecycle state, not an active task-tree integrity defect.

## Evidence checked

### 1) The metric row has already recovered to in-range

```sql
SELECT id, current, threshold, target, priority, status, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.integrity.task-tree-problem-count';
```

Result excerpt:

- `current = 0`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1784010086839`

### 2) The alert row is still open and still carries the old spike text

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3612;
```

Result excerpt:

- `resolved_at = null`
- message = `AKS RP E2E task tree integrity problems is above threshold: current=4, threshold=0, target=0`

So the alert lifecycle row is lagging the current metric source of truth.

### 3) Latest persisted snapshots show a brief spike followed by recovery

```sql
SELECT value, sample_size, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.integrity.task-tree-problem-count'
ORDER BY measured_at DESC
LIMIT 10;
```

Result excerpt:

- latest sample at `1784010086839` = `0`
- previous sample at `1784009780035` = `4`
- the eight earlier samples before that were all `0` except one earlier transient `3`

This is a transient-spike pattern, not a sustained current breach.

### 4) Fresh live recompute is now zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed result:

```json
{"measuredAt":1784010112821,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
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
App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=132
```

### 6) Live task-tree summary still shows exactly one root

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree summary
```

Observed excerpt:

```json
{
  "roots": ["project"],
  "active_task_ids": ["ops/reconcile-shared-auth-owner-return-family-shape-20260714"],
  "tree_counts": {"active": 2, "blocked": 125, "done": 1, "review": 4},
  "counts": {"done": 1, "blocked": 123, "review": 3, "active": 1}
}
```

### 7) The only open `project.task` event pair matches the one live active task

```sql
SELECT correlation_key, status, owner, opened_at, expected_close_at, closed_at, note
FROM event_pair_runs
WHERE pair_name = 'project.task'
  AND status IN ('open','orphan')
ORDER BY opened_at DESC
LIMIT 20;
```

Observed row:

- `ops/reconcile-shared-auth-owner-return-family-shape-20260714:...`
- `status = open`
- `note = opened by project.task.assigned`

That open pair matches the current live active task in task-tree summary, so it is not evidence of an orphan or assignment-state mismatch driving the integrity metric.

## Why this is `resolve_stale`

- The persisted metric row is already back in range.
- A fresh live recompute also returns `0`.
- Integrity and task-tree shape are currently healthy.
- The alert row is the stale surface that has not yet caught up with the recovered metric state.
- With only read-only runtime DB access in this session, the correct action is to record the stale-state judgment and let the supported alert reconciliation path close the stale row.

## Next validation

Next validation point: the next metrics snapshot / alert refresh should either resolve alert `3612` automatically or keep the metric at `0` while exposing only alert-row lifecycle lag.

Expected steady-state signal:

- recomputed metric remains `0`
- persisted `metrics.current` stays `0`
- alert `3612` resolves without any destructive/manual DB edit
