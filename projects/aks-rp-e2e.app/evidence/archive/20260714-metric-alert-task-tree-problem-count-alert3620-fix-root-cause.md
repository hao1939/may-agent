# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3620)

- Date: 2026-07-14
- Final operation: `fix_root_cause`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3620`
- Owner: `app-ops`

## Judgment

This breach was real at triage time and safe to repair.

The persisted metric row still showed `current = 1`, a fresh live recompute also returned `value = 1`, and the metric implementation counts open/orphan `project.task` runtime pairs whose correlated task is no longer `active`. The only mismatching open pair belonged to `ops/repair-focus-approval-warning-classification-20260714`, which had already been archived as `done` by planner maintenance, so app-ops could safely close the stale runtime pair through the supported `/api/events` ingress.

## Evidence checked before repair

### 1) Persisted metric row was still breaching

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
- `updated_at = 1784013503328`

### 2) Open alert row was still active

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3620;
```

Result excerpt:

- `resolved_at = null`
- message = `AKS RP E2E task tree integrity problems is above threshold: current=1, threshold=0, target=0`

### 3) Fresh live metric recompute confirmed the breach was still current

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed result before repair:

```json
{"measuredAt":1784013725818,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1}
```

### 4) The live tree was structurally healthy

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run integrity
```

Observed result:

```text
App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=130
```

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree summary
```

Observed excerpt:

```json
{
  "roots": ["project"],
  "active_task_ids": ["domain/map-vm-prerelease-mounted-source-coverage-to-live-tree-20260714"]
}
```

So the single problem was not a root-count or visible tree-structure break.

### 5) The exact runtime mismatch was one stale open `project.task` pair

```sql
SELECT id, pair_name, status, correlation_key, open_event_id, close_event_id, opened_at, closed_at
FROM event_pair_runs
WHERE pair_name = 'project.task' AND status IN ('open','orphan')
ORDER BY opened_at DESC;
```

Relevant pre-repair rows:

1. active legitimate pair:
   - `domain/map-vm-prerelease-mounted-source-coverage-to-live-tree-20260714:a_domain_map-vm-prerelease-mounted-source-coverage-to-live-tree-20260714_20260714071723`
2. stale mismatching pair:
   - `ops/repair-focus-approval-warning-classification-20260714:a_ops_repair-focus-approval-warning-classification-20260714_20260714071226`

### 6) The mismatching task was already archived as done

Archive file:

- `.state/tasks/archive/done-leaves-20260714071802063.json`

Observed fields for `ops/repair-focus-approval-warning-classification-20260714`:

- `state = done`
- `status = done`
- `done_at = 2026-07-14T07:17:23.743Z`
- `trace.worker_started_attempt_id = a_ops_repair-focus-approval-warning-classification-20260714_20260714071226`

That attempt id exactly matched the still-open runtime pair, proving the metric contributor was stale runtime bookkeeping rather than live work.

## Concrete repair applied

I used the already-established supported runtime ingress and emitted an exact synthetic `project.task.completed` close event for the archived task/attempt pair.

Request body:

```json
{
  "type": "project.task.completed",
  "source": "metric-alert-triage-task-tree-problem-count-3620",
  "owner": "project:aks-rp-e2e",
  "target": {
    "project": "aks-rp-e2e",
    "taskId": "ops/repair-focus-approval-warning-classification-20260714"
  },
  "data": {
    "project": "aks-rp-e2e",
    "projectId": "aks-rp-e2e",
    "taskId": "ops/repair-focus-approval-warning-classification-20260714",
    "task_id": "ops/repair-focus-approval-warning-classification-20260714",
    "attemptId": "a_ops_repair-focus-approval-warning-classification-20260714_20260714071226",
    "attempt_id": "a_ops_repair-focus-approval-warning-classification-20260714_20260714071226",
    "status": "done",
    "result": "done",
    "claim": "done",
    "summary": "Synthetic runtime repair completion emitted to close stale open project.task pair after the task had already been archived as done by planner maintenance.",
    "reason": "runtime-pair-repair",
    "repair": true
  }
}
```

Runtime response:

```json
{"ok":true,"triggered":true,"eventType":"project.task.completed","reason":"runtime-pair-repair","workflowStarted":false,"workflowRunId":null,"workflowStatus":null,"featureTestRequest":null,"featureTestFeedback":null}
```

## Validation after repair

### 1) The stale pair is now closed

```sql
SELECT id, pair_name, status, correlation_key, open_event_id, close_event_id, opened_at, closed_at
FROM event_pair_runs
WHERE correlation_key = 'ops/repair-focus-approval-warning-classification-20260714:a_ops_repair-focus-approval-warning-classification-20260714_20260714071226';
```

Observed result:

- `status = closed`
- `close_event_id = 3169167`
- `closed_at = 1784013738336`

### 2) The repair event was accepted

```sql
SELECT id, event_type, source, delivery_status,
       json_extract(data, '$.taskId') AS taskId,
       json_extract(data, '$.attemptId') AS attemptId,
       json_extract(data, '$.repair') AS repair,
       json_extract(data, '$.summary') AS summary
FROM events
WHERE source = 'metric-alert-triage-task-tree-problem-count-3620'
ORDER BY id DESC
LIMIT 5;
```

Observed result excerpt:

- `id = 3169167`
- `event_type = project.task.completed`
- `delivery_status = accepted`
- `taskId = ops/repair-focus-approval-warning-classification-20260714`
- `attemptId = a_ops_repair-focus-approval-warning-classification-20260714_20260714071226`
- `repair = 1`

### 3) Fresh live metric recompute recovered to zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed result after repair:

```json
{"measuredAt":1784013744606,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

### 4) The only remaining open `project.task` pair is legitimate live work

Post-repair open-pair query now shows only:

- `domain/map-vm-prerelease-mounted-source-coverage-to-live-tree-20260714:a_domain_map-vm-prerelease-mounted-source-coverage-to-live-tree-20260714_20260714071723`

That task is still the current live active frontier task, so it is not an integrity mismatch contributor.

## Why this is `fix_root_cause`

This alert was not stale and did not need calibration. A current live recompute still returned `1`, the source of that `1` was one exact stale runtime `project.task` pair for a task already archived as done, and app-ops could safely correct it through the supported runtime event ingress without destructive DB edits. After the repair, the live metric source returned `0`.

## Next validation

Wait for the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.integrity.task-tree-problem-count`. Recovery is fully persisted when `metrics.current` updates from `1` to `0` and alert `3620` auto-recovers.
