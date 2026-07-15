# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3771)

- Date: 2026-07-15
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3771`
- Owner: `app-ops`

## Judgment

At judgment start the persisted metric row was still breaching (`current = 1`) and a fresh live recompute of the contributing integrity component `aks-rp-e2e.process.assignment-state-mismatch-count` also still returned `value = 1`. The exact live contributor was one stale open `project.task` pair for archived task `ops/repair-private-cluster-shared-auth-holder-metadata-drift-20260715` attempt `a_ops_repair-private-cluster-shared-auth-holder-metadata-drift-20260715_20260715040837`.

During this triage window, a sibling app-ops metric-alert session for `aks-rp-e2e.process.assignment-state-mismatch-count` emitted the canonical runtime repair event first. By the time I validated the pair after posting my own same-shape no-op duplicate event, the source of truth had already recovered: `event_pair_runs.close_event_id = 3226119`, fresh assignment-state-mismatch recompute returned `0`, and fresh task-tree-problem-count recompute returned `0`.

That makes alert `3771` stale in persisted alert state rather than a still-live integrity breach. The correct final operation for this alert is therefore `resolve_stale`.

## Evidence checked

### 1) Persisted metric row and recent snapshots still showed the old breach

`metrics` row before snapshot refresh:

- `id = aks-rp-e2e.process.integrity.task-tree-problem-count`
- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1784089328895`

Recent `metric_snapshots`:

- `1784089328895 -> 1`
- `1784089019842 -> 1`
- `1784088708734 -> 1`
- previous two samples were `0`

### 2) The live contributor before recovery was one stale open pair

Fresh recompute before closure:

```json
{"measuredAt":1784089448162,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"mismatches\":[{\"correlationKey\":\"ops/repair-private-cluster-shared-auth-holder-metadata-drift-20260715:a_ops_repair-private-cluster-shared-auth-holder-metadata-drift-20260715_20260715040837\",\"taskId\":\"ops/repair-private-cluster-shared-auth-holder-metadata-drift-20260715\",\"attemptId\":\"a_ops_repair-private-cluster-shared-auth-holder-metadata-drift-20260715_20260715040837\",\"taskState\":null,\"reason\":\"task-missing\",\"sessionId\":null,\"sessionStatus\":null,\"sessionOutcome\":null,\"sessionStartedAt\":null,\"sessionLastActivityAt\":null,\"sessionEndedAt\":null}]}"}
```

Primary-source runtime rows before recovery:

- `event_pair_runs.id = 420985`
- `correlation_key = ops/repair-private-cluster-shared-auth-holder-metadata-drift-20260715:a_ops_repair-private-cluster-shared-auth-holder-metadata-drift-20260715_20260715040837`
- `status = open`
- `close_event_id = null`

Event history initially contained only assignment event `3225378` for that task/attempt.

### 3) The source of truth recovered during this triage window

Runtime `events` now shows two accepted synthetic completion repairs for the same task/attempt pair:

- `3226119` from source `metric-alert-triage-assignment-state-mismatch-count-3772`
- `3226122` from source `metric-alert-triage-task-tree-problem-count-3771`

But `event_pair_runs` proves the actual close happened on the sibling session's earlier event:

- `event_pair_runs.id = 420985`
- `status = closed`
- `close_event_id = 3226119`
- `closed_at = 1784089472160`

So the stale pair is already closed in the source of truth.

### 4) Fresh live recomputes are back in range

Assignment-state-mismatch recompute after recovery:

```json
{"measuredAt":1784089481129,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"mismatches\":[]}"}
```

Task-tree-problem-count recompute after recovery:

```json
{"measuredAt":1784089481266,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

## Why this is `resolve_stale`

The alert row still reflects the earlier `current = 1` sample, but the live source of truth no longer breaches. The one underlying stale open pair has already been closed through the supported canonical event path, and fresh recomputes confirm the integrity metric is back to `0`. No additional task-tree or metric calibration change is needed for alert `3771`; it should clear on the next metrics snapshot / alert reconciliation cycle.

## Next validation

Wait for the next `metrics-snapshot` / alert refresh so persisted `metrics.current` for `aks-rp-e2e.process.integrity.task-tree-problem-count` moves from `1` to `0` and alert `3771` auto-recovers.
