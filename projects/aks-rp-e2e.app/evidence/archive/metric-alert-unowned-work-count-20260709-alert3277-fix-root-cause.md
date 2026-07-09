# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.unowned-work-count`

- Alert id: `3277`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Judged at: `2026-07-09T12:36:11Z`
- Chosen operation: `fix_root_cause`

## Why the breach was real

The persisted alert snapshot named one stale-active contributor:

- `verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607091220`
- missing runtime session: `s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607091220`

By the time of this triage, that specific Fleet verify task had already recovered: runtime `sessions` showed `s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607091220` completed with `status='done'`.

A fresh supported recompute still showed a real current breach, but the live contributor had changed:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

Observed before repair:

```json
{"measuredAt":1783600452098,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"sampledAt\":\"2026-07-09T12:34:12.203Z\",\"staleActiveTaskIds\":[\"reconcile-compact-loop-package-partial-202607091231\"],\"staleActiveTaskSessions\":[{\"taskId\":\"reconcile-compact-loop-package-partial-202607091231\",\"sessionId\":\"s_task_reconcile-compact-loop-package-partial-202607091231\",\"restartReason\":\"session-not-running\"}],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

`task-tree show reconcile-compact-loop-package-partial-202607091231` showed the task was still `active` with:

- `trace.worker_started_attempt_id = a_reconcile-compact-loop-package-partial-202607091231_20260709123128`
- `session_id = s_task_reconcile-compact-loop-package-partial-202607091231`

A runtime `sessions` query for that exact session id returned zero rows, so the task tree was claiming active ownership without a live worker session.

## Concrete repair applied

### 1. Requeue the stale active task through the safe task-tree command

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree requeue-active reconcile-compact-loop-package-partial-202607091231 --reason "unowned-work metric repair: session s_task_reconcile-compact-loop-package-partial-202607091231 absent from runtime sessions; requeue for clean reassignment"
```

After the requeue, `task-tree show` reported:

- `state: "backlog"`
- `status: "backlog"`
- `trace.stale_active_requeued_at: "2026-07-09T12:35:23.016Z"`
- `trace.previous_attempt_id: "a_reconcile-compact-loop-package-partial-202607091231_20260709123128"`

### 2. Close the stale open `project.task` pair row left behind by the requeue

After the requeue, a fresh recompute still showed `value=1`, but the contributor had changed from stale-active to assignment mismatch:

```json
{"measuredAt":1783600530833,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"sampledAt\":\"2026-07-09T12:35:30.889Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"assignmentMismatchKeys\":[\"reconcile-compact-loop-package-partial-202607091231:a_reconcile-compact-loop-package-partial-202607091231_20260709123128\"],\"assignmentMismatchTasks\":[{\"correlationKey\":\"reconcile-compact-loop-package-partial-202607091231:a_reconcile-compact-loop-package-partial-202607091231_20260709123128\",\"taskId\":\"reconcile-compact-loop-package-partial-202607091231\",\"attemptId\":\"a_reconcile-compact-loop-package-partial-202607091231_20260709123128\",\"taskState\":\"backlog\"}],\"recoveryUnownedSpecIds\":[]}"}
```

`event_pair_runs` confirmed the exact stale open pair row:

- correlation key: `reconcile-compact-loop-package-partial-202607091231:a_reconcile-compact-loop-package-partial-202607091231_20260709123128`
- `status = 'open'`
- `open_event_id = 2942698`

I used the supported runtime ingress `POST /api/events` to emit the missing completion event for that abandoned attempt:

```json
{
  "type": "project.task.completed",
  "source": "metric-alert-triage-unowned-work-count-3277",
  "owner": "project:aks-rp-e2e",
  "target": {
    "project": "aks-rp-e2e",
    "taskId": "reconcile-compact-loop-package-partial-202607091231"
  },
  "data": {
    "project": "aks-rp-e2e",
    "projectId": "aks-rp-e2e",
    "taskId": "reconcile-compact-loop-package-partial-202607091231",
    "task_id": "reconcile-compact-loop-package-partial-202607091231",
    "attemptId": "a_reconcile-compact-loop-package-partial-202607091231_20260709123128",
    "attempt_id": "a_reconcile-compact-loop-package-partial-202607091231_20260709123128",
    "status": "blocked",
    "result": "blocked",
    "claim": "blocked",
    "summary": "Synthetic runtime repair completion emitted to close stale open project.task pair after stale-active requeue returned this lost worker attempt to backlog.",
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

### Runtime completion event recorded

A new `events` row now exists for the exact task/attempt pair:

```json
{
  "id": 2942855,
  "event_type": "project.task.completed",
  "source": "metric-alert-triage-unowned-work-count-3277",
  "owner": "project:aks-rp-e2e",
  "status": "pending",
  "delivery_status": "accepted",
  "timestamp": 1783600561368,
  "taskId": "reconcile-compact-loop-package-partial-202607091231",
  "attemptId": "a_reconcile-compact-loop-package-partial-202607091231_20260709123128",
  "result": "blocked",
  "repair": 1
}
```

### Pair row closed

`event_pair_runs` for the exact correlation key now shows:

```json
{
  "id": 336729,
  "pair_name": "project.task",
  "correlation_key": "reconcile-compact-loop-package-partial-202607091231:a_reconcile-compact-loop-package-partial-202607091231_20260709123128",
  "owner": "project:aks-rp-e2e",
  "status": "closed",
  "open_event_id": 2942698,
  "close_event_id": 2942855,
  "opened_at": 1783600288926,
  "closed_at": 1783600561368,
  "note": "opened by project.task.assigned"
}
```

### Fresh metric recompute recovered to zero

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

Observed after repair:

```json
{"measuredAt":1783600571421,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-09T12:36:11.460Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

## Why this is `fix_root_cause`

The metric breach was real at triage time. The live contributor was a task leaf left `active` after its worker session disappeared, and requeueing that leaf exposed a second truthful contributor: the stale open `project.task` pair row for the abandoned attempt. Requeueing the task and closing the exact stale pair row removed the actual contributors and returned the live metric to `0` without changing thresholds, priority, or alert metadata.

## Next validation

Wait for the next `metrics-snapshot` / alert evaluation cycle to refresh the persisted metric row and auto-recover alert `3277` from the current live value `0`.
