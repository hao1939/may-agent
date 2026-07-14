# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3596)

- Date: 2026-07-14
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3596`
- Owner: `app-ops`

## Judgment

This alert was a transient stale-state alert, not a currently reproducible task-tree integrity defect.

At alert creation, the metric briefly spiked to `3`. A fresh live recompute after the just-finished westus2 family-membership repair returned `0`, integrity passed, the live task tree had a single `project` root, and there were no open or orphan `project.task` event pairs. During this triage window, the next metric refresh also updated the persisted metric row back to `0` and auto-resolved alert `3596`. That confirms the source-of-truth breach behind the alert was already gone by the time triage completed.

## Evidence checked

### 1) The alert was caused by a brief persisted spike, and the metric row is now recovered

Initial observed persisted state during triage:

```sql
SELECT id, current, threshold, target, priority, status, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.integrity.task-tree-problem-count';
```

Initial result excerpt:

- `current = 3`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1784006995620`

Later in the same triage window, the same row refreshed to:

- `current = 0`
- `updated_at = 1784007306988`

### 2) The alert row has now auto-resolved

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3596;
```

Result excerpt:

- `resolved_at = 1784007356345`
- message still records the original breach text `current=3, threshold=0, target=0`

This is the expected stale/transient pattern: the alert records the earlier spike, while the source-of-truth metric has already recovered.

### 3) Latest persisted snapshots show one spike followed by recovery

```sql
SELECT value, sample_size, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.integrity.task-tree-problem-count'
ORDER BY measured_at DESC
LIMIT 10;
```

Result excerpt:

- latest sample at `1784007306988` = `0`
- previous sample at `1784006995620` = `3`
- the eight earlier samples before that were all `0`

So the alert is tied to one brief spike followed immediately by recovery, not a sustained trend.

### 4) Recent app-ops repair finished before this triage verification

Relevant session:

```sql
SELECT sessionId, status, source, startedAt, endedAt
FROM sessions
WHERE sessionId = 's_task_ops_reconcile-shared-westus2-capacity-family-membership-post-localdns-split-20260714';
```

Result excerpt:

- `status = done`
- `source = workflow:task-worker`
- `endedAt = 1784007322460`

That worker wrote `evidence/archive/ops-reconcile-shared-westus2-capacity-family-membership-post-localdns-split-20260714.md`, documenting the westus2 family-membership repair that removed stale LocalDNS auto-default and compact app-monitoring membership from the shared wait.

### 5) Fresh live recompute is now zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed result:

```json
{"measuredAt":1784007337605,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

### 6) Integrity passes now

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run integrity
```

Observed result:

```text
App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=135
```

### 7) Live task-tree summary still shows exactly one root and no active integrity fallout

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree summary
```

Observed excerpt:

```json
{
  "roots": ["project"],
  "active_task_ids": [],
  "tree_counts": {"review": 2, "blocked": 132, "done": 1}
}
```

### 8) There are no currently open or orphan `project.task` event pairs

```sql
SELECT correlation_key, status, owner, opened_at, expected_close_at, closed_at, note
FROM event_pair_runs
WHERE pair_name = 'project.task'
  AND status IN ('open','orphan')
ORDER BY opened_at DESC
LIMIT 20;
```

Observed result:

- zero rows

## Why this is `resolve_stale`

- The live source of truth is back in range.
- The breach was transient and already cleared by the westus2 family-membership repair.
- The persisted metric row refreshed to `0` during this triage window.
- Alert `3596` auto-resolved without any destructive/manual runtime edits.
- The correct owner action is therefore to record that this was a stale/transient alert, not to recalibrate the metric or open a new repair loop.

## Next validation

Next validation point: the next `metrics-snapshot` should keep `aks-rp-e2e.process.integrity.task-tree-problem-count = 0`.

Expected steady-state signal:

- recomputed metric remains `0`
- persisted `metrics.current` stays `0`
- no new open alert is created unless a fresh integrity regression occurs
