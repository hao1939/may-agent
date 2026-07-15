# Metric alert triage — `aks-rp-e2e.process.assignment-state-mismatch-count` (alert 3724)

- Date: 2026-07-14
- Final operation: `fix_root_cause`
- Metric id: `aks-rp-e2e.process.assignment-state-mismatch-count`
- Alert id: `3724`
- Owner: `app-ops`

## Judgment

This breach was real at triage time and safe to repair.

A fresh live recompute still returned `value = 1`, and the metric note named exactly one mismatch contributor: archived helper task `ops/dispatch-disabled-alert-approval-followup-control-plane-20260714` with attempt `a_ops_dispatch-disabled-alert-approval-followup-control-plane-20260714_20260714210605`. The live task tree no longer contained that task, the single disabled-alert human wait remained represented separately at `ops/wait-disabled-alert-alias-runtime-owner-decision-20260709j-owner-normalized`, and runtime `event_pair_runs` still had the helper task's `project.task` pair open. That made this a stale runtime bookkeeping gap, not live work.

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
- `updated_at = 1784064751890`

### 2) Open alert row was still active

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3724;
```

Observed result excerpt:

- `resolved_at = null`
- message = `AKS RP E2E assignment state mismatch count is above threshold: current=1, threshold=0, target=0`

### 3) Fresh live metric recompute confirmed the breach was current

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.assignment-state-mismatch-count --json
```

Observed result before repair:

```json
{"measuredAt":1784064886737,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"mismatches\":[{\"correlationKey\":\"ops/dispatch-disabled-alert-approval-followup-control-plane-20260714:a_ops_dispatch-disabled-alert-approval-followup-control-plane-20260714_20260714210605\",\"taskId\":\"ops/dispatch-disabled-alert-approval-followup-control-plane-20260714\",\"attemptId\":\"a_ops_dispatch-disabled-alert-approval-followup-control-plane-20260714_20260714210605\",\"taskState\":null,\"reason\":\"task-missing\",\"sessionId\":null,\"sessionStatus\":null,\"sessionOutcome\":null,\"sessionStartedAt\":null,\"sessionLastActivityAt\":null,\"sessionEndedAt\":null}]}"}
```

### 4) The exact runtime mismatch was one stale open `project.task` pair

```sql
SELECT id, pair_name, correlation_key, open_event_id, close_event_id, owner, status, opened_at, expected_close_at, closed_at
FROM event_pair_runs
WHERE correlation_key = 'ops/dispatch-disabled-alert-approval-followup-control-plane-20260714:a_ops_dispatch-disabled-alert-approval-followup-control-plane-20260714_20260714210605';
```

Observed result before repair:

- `id = 406551`
- `status = open`
- `open_event_id = 3201522`
- `close_event_id = null`

### 5) The disabled-alert wait remained represented separately

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts show ops/wait-disabled-alert-alias-runtime-owner-decision-20260709j-owner-normalized
```

Observed result excerpt:

- `state = blocked`
- `owner = app-ops`
- blocker preserves the four approval/wait tuples and explicitly says to keep pair-run cleanup separate.

## Concrete repair applied

I used the supported runtime ingress `POST http://127.0.0.1:8080/api/events` and emitted an exact synthetic `project.task.completed` repair event with source `metric-alert-triage-assignment-state-mismatch-count-3724` for the archived helper task/attempt pair.

Request body:

```json
{
  "type": "project.task.completed",
  "source": "metric-alert-triage-assignment-state-mismatch-count-3724",
  "owner": "project:aks-rp-e2e",
  "target": {
    "project": "aks-rp-e2e",
    "taskId": "ops/dispatch-disabled-alert-approval-followup-control-plane-20260714"
  },
  "data": {
    "project": "aks-rp-e2e",
    "projectId": "aks-rp-e2e",
    "taskId": "ops/dispatch-disabled-alert-approval-followup-control-plane-20260714",
    "task_id": "ops/dispatch-disabled-alert-approval-followup-control-plane-20260714",
    "attemptId": "a_ops_dispatch-disabled-alert-approval-followup-control-plane-20260714_20260714210605",
    "attempt_id": "a_ops_dispatch-disabled-alert-approval-followup-control-plane-20260714_20260714210605",
    "sessionId": "s_task_ops_dispatch-disabled-alert-approval-followup-control-plane-20260714_ed-alert-approval-followup-control-plane-20260714_20260714210605",
    "status": "done",
    "result": "done",
    "claim": "done",
    "summary": "Synthetic runtime repair completion emitted to close the stale open project.task pair after duplicate helper task ops/dispatch-disabled-alert-approval-followup-control-plane-20260714 was immediately replaced and archived in favor of the already-applied same-lineage disabled-alert approval dispatch and refreshed governing wait.",
    "reason": "runtime-pair-repair",
    "repair": true
  }
}
```

The HTTP response itself timed out on daemon socket delivery:

```json
{"ok":false,"triggered":false,"error":"daemon socket delivery failed at /app/.state/instances/background/may.sock: Socket timeout"}
```

But primary-source runtime evidence showed the event was still accepted and applied, so I trusted the runtime state over the transient HTTP error.

## Validation after repair

### 1) The repair event was accepted

```sql
SELECT id, event_type, source, owner, timestamp, status, delivery_status,
       json_extract(data, '$.taskId') AS taskId,
       json_extract(data, '$.attemptId') AS attemptId,
       json_extract(data, '$.reason') AS reason,
       json_extract(data, '$.repair') AS repair
FROM events
WHERE json_valid(data)=1 AND source = 'metric-alert-triage-assignment-state-mismatch-count-3724'
ORDER BY id DESC;
```

Observed result:

- `id = 3203368`
- `event_type = project.task.completed`
- `delivery_status = accepted`
- `taskId = ops/dispatch-disabled-alert-approval-followup-control-plane-20260714`
- `attemptId = a_ops_dispatch-disabled-alert-approval-followup-control-plane-20260714_20260714210605`
- `reason = runtime-pair-repair`
- `repair = 1`

### 2) The stale pair is now closed

```sql
SELECT id, pair_name, correlation_key, open_event_id, close_event_id, owner, status, opened_at, expected_close_at, closed_at
FROM event_pair_runs
WHERE correlation_key = 'ops/dispatch-disabled-alert-approval-followup-control-plane-20260714:a_ops_dispatch-disabled-alert-approval-followup-control-plane-20260714_20260714210605';
```

Observed result after repair:

- `status = closed`
- `close_event_id = 3203368`
- `closed_at = 1784065016708`

### 3) Fresh live metric recompute recovered to zero

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.assignment-state-mismatch-count --json
```

Observed result after repair:

```json
{"measuredAt":1784065026348,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"mismatches\":[]}"}
```

### 4) Persisted metric row and alert have not refreshed yet

At session end, persisted runtime state still showed:

- `metrics.current = 1`
- `metric_alerts.resolved_at = null`

So the remaining step is only the normal snapshot/alert refresh cycle, not another repair.

## Why this is `fix_root_cause`

The alert was still signaling a real live process gap when judged. App-ops could safely repair the exact stale runtime pair through the supported completion ingress without changing metric policy, and the live metric source immediately recovered to `0` while the single human wait stayed intact.

## Next validation

Use the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.assignment-state-mismatch-count` to confirm persisted `metrics.current` updates from `1` to `0` and alert `3724` auto-recovers.
