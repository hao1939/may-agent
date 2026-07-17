# Metric alert triage — `aks-rp-e2e.process.unowned-work-count` (alert 4029)

- Date: 2026-07-17
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Alert id: `4029`
- Owner: `app-ops`

## Judgment

Alert `4029` is stale at triage time.

The persisted runtime metric row and open alert still reflect the pre-repair sample (`current = 1`), but the live source of truth has already recovered:

- `event_pair_runs.id = 505603` is now `status = closed` with `close_event_id = 3389422`
- event `3389422` is the accepted `project.task.completed` runtime-pair repair for task `ops/apply-rp-cluster-lifecycle-terminal-review-closure-gap-state-mutations-20260717`
- a fresh direct recompute now returns `value = 0`, `sampleSize = 0`, and no `assignmentMismatchKeys`

That means the remaining discrepancy is alert/snapshot lifecycle lag, not live unfinished work without an owner. The correct owner action in this read-only triage environment is to record the stale-state judgment and let the next supported `metrics-snapshot` / alert reconciliation cycle converge persisted runtime state.

## Evidence checked

### 1) Persisted metric row still shows the old breach

```sql
SELECT id, current, threshold, target, priority, status, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.unowned-work-count';
```

Observed result excerpt:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1784288846980`

### 2) Alert 4029 is still open in persisted alert state

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 4029;
```

Observed result excerpt:

- `message = "AKS RP E2E unfinished work without active owner is above threshold: current=1, threshold=0, target=0"`
- `resolved_at = null`
- `created_at = 1784288270624`

### 3) Recent stored snapshots still name the old orphan pair

Latest stored snapshots before refresh:

- `1784288846980 -> value = 1`
- `1784288549922 -> value = 1`
- `1784288239934 -> value = 1`

All three stored notes name the same contributor:

- `assignmentMismatchKeys[0] = ops/apply-rp-cluster-lifecycle-terminal-review-closure-gap-state-mutations-20260717:a_ops_apply-rp-cluster-lifecycle-terminal-review-closure-gap-state-mutations-20260717_20260717021549`
- `reason = task-missing`

### 4) The source-of-truth pair is already closed

```sql
SELECT id, pair_name, correlation_key, open_event_id, close_event_id, owner, status, opened_at, closed_at
FROM event_pair_runs
WHERE id = 505603;
```

Observed result excerpt:

- `pair_name = project.task`
- `status = closed`
- `close_event_id = 3389422`
- `closed_at = 1784288933099`

### 5) The closing repair event exists and matches the repaired orphan pair

```sql
SELECT id, event_type, source, owner, timestamp,
       json_extract(data, '$.taskId') AS taskId,
       json_extract(data, '$.attemptId') AS attemptId,
       json_extract(data, '$.reason') AS reason,
       json_extract(data, '$.repair') AS repair,
       json_extract(data, '$.summary') AS summary
FROM events
WHERE id = 3389422;
```

Observed result excerpt:

- `event_type = project.task.completed`
- `source = agent:aks-explorer`
- `owner = agent:app-ops`
- `taskId = ops/apply-rp-cluster-lifecycle-terminal-review-closure-gap-state-mutations-20260717`
- `attemptId = a_ops_apply-rp-cluster-lifecycle-terminal-review-closure-gap-state-mutations-20260717_20260717021549`
- `reason = runtime-pair-repair`
- `repair = 1`

### 6) Fresh direct recompute is back in range

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.unowned-work-count -- --json
```

Observed result:

```json
{"measuredAt":1784289153436,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-17T11:52:33.468Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

This proves the live contributor set is empty now.

## Why this is `resolve_stale`

The breach was real when sampled, but the live condition has already recovered through the canonical runtime-pair repair path before this triage completed. What remains open is only the persisted alert lifecycle, which is one sample behind the repaired source of truth. No calibration, downgrade, or additional task-tree mutation is justified.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh after this judgment. Expected state:

- `metrics.current` moves from `1` to `0`
- a new `metric_snapshots` row records `value = 0` with empty `assignmentMismatchKeys`
- alert `4029` auto-recovers unless a genuinely new unowned-work contributor appears
