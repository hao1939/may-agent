# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3590)

- Date: 2026-07-14
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3590`
- Owner: `app-ops`

## Judgment

This alert is stale in persisted runtime state, not a currently reproducible task-tree integrity defect.

The persisted metric row and latest snapshot still show `current = 2`, but a fresh live recompute immediately after the alert returns `0`, the current task tree still has exactly one root (`project`), app integrity passes, and the only currently open `project.task` event pairs correspond to active live tasks.

Because the metric implementation computes task-tree-problem-count from current live task-tree shape and mismatch audits, a current live value of `0` means the breach that produced alert `3590` is no longer present in the source of truth.

## Evidence checked

### 1) Persisted metric row still shows the old breach

```sql
SELECT id, current, threshold, target, priority, status, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.integrity.task-tree-problem-count';
```

Result excerpt:

- `current = 2`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1783995836324`

### 2) The alert row is still open

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3590;
```

Result excerpt:

- `resolved_at = null`
- message says `current=2, threshold=0, target=0`

### 3) Latest persisted snapshots show a brief spike, then nothing else yet

```sql
SELECT value, sample_size, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.integrity.task-tree-problem-count'
ORDER BY measured_at DESC
LIMIT 10;
```

Result excerpt:

- latest sample at `1783995836324` = `2`
- previous nine samples were all `0`

So the alert is tied to a single recent spike rather than a sustained trend.

### 4) Fresh live recompute is now zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed result:

```json
{"measuredAt":1783996143583,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

### 5) Integrity passes now

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run integrity
```

Observed result:

```text
App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=141
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
  "active_task_ids": [
    "domain/reconcile-traffic-azure-service-mesh-wrapper-layer-draft-shared-carrier-posture-20260714",
    "ops/repair-assignment-state-mismatch-open-pairs-20260714",
    "ops/repair-may-agent-deterministic-approval-reply-projection-20260714"
  ]
}
```

### 7) Currently open `project.task` event pairs are active live work, not orphan mismatches

```sql
SELECT correlation_key, status, owner, opened_at, expected_close_at, closed_at, note
FROM event_pair_runs
WHERE pair_name = 'project.task'
  AND status IN ('open','orphan')
ORDER BY opened_at DESC
LIMIT 20;
```

Observed rows:

- `ops/repair-assignment-state-mismatch-open-pairs-20260714:...`
- `ops/repair-may-agent-deterministic-approval-reply-projection-20260714:...`
- `domain/reconcile-traffic-azure-service-mesh-wrapper-layer-draft-shared-carrier-posture-20260714:...`

Each corresponds to a current active task shown in live task-tree summary, so the current open-pair set does not support an active mismatch count.

## Why this is `resolve_stale`

- The live source of truth is back in range.
- The persisted alert row still reflects an earlier spike.
- No safe runtime write path is available in this session to edit `metric_alerts` directly.
- The correct owner action is therefore to record the stale-state judgment and wait for the next supported metrics snapshot / alert reconciliation cycle to refresh persisted state.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh for `aks-rp-e2e.process.integrity.task-tree-problem-count`.

Expected recovery signal:

- recomputed metric remains `0`
- `metrics.current` refreshes from `2` to `0`
- alert `3590` resolves automatically
