# Metric alert triage — aks-rp-e2e.process.integrity.task-tree-problem-count (alert 2867)

- Alert id: `2867`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Judged at: `2026-07-07T02:27:50Z`
- Chosen operation: `waiting_with_evidence`

## Why this is not an active integrity defect

The persisted metric row and alert were breaching at alert creation time:

- `metrics.current = 1`
- `metrics.updated_at = 1783398695364`
- open alert row `metric_alerts.id = 2867`, `resolved_at = null`

But the live measurement and integrity check already recovered during this triage:

- `bun run metrics:sample aks-rp-e2e.process.integrity.task-tree-problem-count --json`
  returned `{"measuredAt":1783398846977,"value":0}`
- `bun run integrity` returned `App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=277`

So the breach is currently stale/transient rather than a still-live task-tree problem.

## Why the operation is waiting_with_evidence

This workflow has read-only database access. I can verify that the alert row is still open, but I do not have a safe runtime write path here to resolve `metric_alerts.id=2867` manually.

Because the live source of truth is already back to `0`, there is no root cause left for me to repair in the task tree. The remaining action is for the normal metrics/alert lifecycle to observe the recovered value on the next snapshot and close the alert through the supported runtime path.

## Evidence checked

1. `metrics` row still showed `current=1`, `threshold=0`, `priority=P0`.
2. `metric_alerts` row `2867` remained open with `resolved_at = null`.
3. Fresh metric sample returned `value=0`.
4. Fresh integrity run returned `App integrity OK`.

## Next validation

Wait for the next `metrics-snapshot` / recovery cycle to refresh the persisted metric row and close alert `2867` if the recovered `0` persists.
