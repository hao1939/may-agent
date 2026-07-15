# Metric alert triage — `aks-rp-e2e.process.assignment-state-mismatch-count` (alert 3772)

- Date: 2026-07-15
- Final operation: `fix_root_cause`
- Metric id: `aks-rp-e2e.process.assignment-state-mismatch-count`
- Alert id: `3772`
- Owner: `app-ops`

## Judgment

The breach was real and safe to repair.

A fresh live recompute still returned `value = 1`, and the metric note named exactly one mismatch contributor: archived task `ops/repair-private-cluster-shared-auth-holder-metadata-drift-20260715` with attempt `a_ops_repair-private-cluster-shared-auth-holder-metadata-drift-20260715_20260715040837`. The live task tree no longer contained that task, runtime `event_pair_runs` still had its `project.task` pair open, and there was no session row for the archived task session id. That made the alert a stale runtime bookkeeping gap, not live work.

## Evidence checked before repair

### 1) Persisted metric row was still breaching

```sql
SELECT id, current, threshold, target, priority, status, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.assignment-state-mismatch-count';
```

Observed result excerpt:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1784089328895`

### 2) Fresh live metric recompute confirmed the breach was current

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.assignment-state-mismatch-count -- --json
```

Observed result before repair:

```json
{"measuredAt":1784089438488,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"mismatches\":[{\"correlationKey\":\"ops/repair-private-cluster-shared-auth-holder-metadata-drift-20260715:a_ops_repair-private-cluster-shared-auth-holder-metadata-drift-20260715_20260715040837\",\"taskId\":\"ops/repair-private-cluster-shared-auth-holder-metadata-drift-20260715\",\"attemptId\":\"a_ops_repair-private-cluster-shared-auth-holder-metadata-drift-20260715_20260715040837\",\"taskState\":null,\"reason\":\"task-missing\",\"sessionId\":null,\"sessionStatus\":null,\"sessionOutcome\":null,\"sessionStartedAt\":null,\"sessionLastActivityAt\":null,\"sessionEndedAt\":null}]}"}
```

### 3) The exact runtime mismatch was one stale open `project.task` pair

```sql
SELECT id, pair_name, correlation_key, open_event_id, close_event_id, owner, status, opened_at, expected_close_at, closed_at, note
FROM event_pair_runs
WHERE pair_name = 'project.task'
  AND correlation_key = 'ops/repair-private-cluster-shared-auth-holder-metadata-drift-20260715:a_ops_repair-private-cluster-shared-auth-holder-metadata-drift-20260715_20260715040837';
```

Observed result before repair:

- `id = 420985`
- `status = open`
- `open_event_id = 3225378`
- `close_event_id = null`

### 4) Runtime event history showed only the open assignment event

```sql
SELECT id, event_type, source, owner, timestamp, status, delivery_status
FROM events
WHERE id = 3225378;
```

Observed result excerpt:

- `event_type = project.task.assigned`
- `source = agent:aks-explorer`
- `delivery_status = accepted`

## Concrete repair applied

I used the supported runtime ingress `POST http://127.0.0.1:8080/api/events` and emitted one bounded synthetic `project.task.completed` repair event for the archived task/attempt pair.

Request body:

```json
{
  "type": "project.task.completed",
  "source": "metric-alert-triage-assignment-state-mismatch-count-3772",
  "owner": "project:aks-rp-e2e",
  "target": {
    "project": "aks-rp-e2e",
    "taskId": "ops/repair-private-cluster-shared-auth-holder-metadata-drift-20260715"
  },
  "data": {
    "project": "aks-rp-e2e",
    "projectId": "aks-rp-e2e",
    "taskId": "ops/repair-private-cluster-shared-auth-holder-metadata-drift-20260715",
    "task_id": "ops/repair-private-cluster-shared-auth-holder-metadata-drift-20260715",
    "attemptId": "a_ops_repair-private-cluster-shared-auth-holder-metadata-drift-20260715_20260715040837",
    "attempt_id": "a_ops_repair-private-cluster-shared-auth-holder-metadata-drift-20260715_20260715040837",
    "sessionId": "s_task_ops_repair-private-cluster-shared-auth-holder-metadata-drift-20260715_luster-shared-auth-holder-metadata-drift-20260715_20260715040837",
    "session_id": "s_task_ops_repair-private-cluster-shared-auth-holder-metadata-drift-20260715_luster-shared-auth-holder-metadata-drift-20260715_20260715040837",
    "status": "done",
    "result": "done",
    "claim": "done",
    "summary": "Synthetic runtime repair completion emitted to close the stale open project.task pair after the task was replaced and archived before worker start.",
    "reason": "runtime-pair-repair",
    "repair": true
  }
}
```

Observed HTTP response:

```json
{"ok":true,"triggered":true,"eventType":"project.task.completed","reason":"runtime-pair-repair","workflowStarted":false,"workflowRunId":null,"workflowStatus":null,"featureTestRequest":null,"featureTestFeedback":null}
```

## Validation after repair

### 1) The repair event was accepted

```sql
SELECT id, event_type, source, owner, timestamp, status, delivery_status,
       json_extract(data, '$.taskId') AS taskId,
       json_extract(data, '$.attemptId') AS attemptId,
       json_extract(data, '$.reason') AS reason,
       json_extract(data, '$.repair') AS repair
FROM events
WHERE json_valid(data)=1 AND source = 'metric-alert-triage-assignment-state-mismatch-count-3772'
ORDER BY id DESC;
```

Observed result:

- `id = 3226119`
- `event_type = project.task.completed`
- `delivery_status = accepted`
- `taskId = ops/repair-private-cluster-shared-auth-holder-metadata-drift-20260715`
- `attemptId = a_ops_repair-private-cluster-shared-auth-holder-metadata-drift-20260715_20260715040837`
- `reason = runtime-pair-repair`
- `repair = 1`

### 2) The stale pair is now closed

```sql
SELECT id, pair_name, correlation_key, open_event_id, close_event_id, owner, status, opened_at, expected_close_at, closed_at, note
FROM event_pair_runs
WHERE pair_name = 'project.task'
  AND correlation_key = 'ops/repair-private-cluster-shared-auth-holder-metadata-drift-20260715:a_ops_repair-private-cluster-shared-auth-holder-metadata-drift-20260715_20260715040837';
```

Observed result after repair:

- `status = closed`
- `close_event_id = 3226119`
- `closed_at = 1784089472160`

### 3) Fresh live metric recompute recovered to zero

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.assignment-state-mismatch-count -- --json
```

Observed result after repair:

```json
{"measuredAt":1784089477305,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"mismatches\":[]}"}
```

### 4) Persisted metric row is still awaiting the next snapshot refresh

At session end, persisted runtime state still showed:

- `metrics.current = 1`
- open alert `3772` still depends on snapshot-based refresh

So the remaining step is only the normal metric snapshot / alert reconciliation cycle, not another repair.

## Why this is `fix_root_cause`

The alert was signaling a real live process gap when judged. App-ops could safely repair the exact stale runtime pair through the supported event ingress without changing metric policy, and the live metric source immediately recovered to `0`.

## Next validation

Use the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.assignment-state-mismatch-count` to confirm persisted `metrics.current` updates from `1` to `0` and alert `3772` auto-recovers.
