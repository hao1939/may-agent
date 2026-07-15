# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.unowned-work-count`

- Alert id: `3664`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Owner: `app-ops`
- Priority: `P0`
- Judged at: `2026-07-14T11:44:32Z`
- Chosen operation: `fix_root_cause`

## Why the breach was real

The persisted runtime metric row still breached when triage began:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1784029173653`

A fresh supported recompute still returned `value=1` and named one exact contributor:

```json
{"measuredAt":1784029414691,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"sampledAt\":\"2026-07-14T11:43:34.770Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[\"ops/challenge-mounted-source-holder-blockers-20260714:a_ops_challenge-mounted-source-holder-blockers-20260714_20260714113231\"],\"assignmentMismatchTasks\":[{\"correlationKey\":\"ops/challenge-mounted-source-holder-blockers-20260714:a_ops_challenge-mounted-source-holder-blockers-20260714_20260714113231\",\"taskId\":\"ops/challenge-mounted-source-holder-blockers-20260714\",\"attemptId\":\"a_ops_challenge-mounted-source-holder-blockers-20260714_20260714113231\",\"taskState\":null,\"reason\":\"task-missing\",\"sessionId\":\"s_task_ops_challenge-mounted-source-holder-blockers-20260714\",\"sessionStatus\":\"done\",\"sessionOutcome\":\"done\",\"sessionStartedAt\":1784028964299,\"sessionLastActivityAt\":1784029048410,\"sessionEndedAt\":1784029048410}],\"recoveryUnownedSpecIds\":[]}"}
```

Live task inspection showed the task was no longer active work:

- `bun run task-tree show ops/challenge-mounted-source-holder-blockers-20260714` now fails with `Task not found`, because planner already accepted and archived it.
- `.state/tasks/archive/done-leaves-20260714114158162.json` records the task as `state: done`, `resolution: completed`, with review summary saying the mounted-source holder audit was accepted and no further tree repair was needed.
- The worker session `s_task_ops_challenge-mounted-source-holder-blockers-20260714` is already `status = done`, `outcome = done`.

So the breach was real, but it came from one stale open `project.task` runtime pair, not from still-ownerless unfinished work.

## Concrete repair applied

I used the established supported runtime ingress `POST http://127.0.0.1:8080/api/events` and emitted an exact synthetic `project.task.completed` repair event for the archived task/attempt pair.

Request body:

```json
{
  "type": "project.task.completed",
  "source": "metric-alert-triage-unowned-work-count-3664",
  "owner": "project:aks-rp-e2e",
  "target": {
    "project": "aks-rp-e2e",
    "taskId": "ops/challenge-mounted-source-holder-blockers-20260714"
  },
  "data": {
    "project": "aks-rp-e2e",
    "projectId": "aks-rp-e2e",
    "taskId": "ops/challenge-mounted-source-holder-blockers-20260714",
    "task_id": "ops/challenge-mounted-source-holder-blockers-20260714",
    "attemptId": "a_ops_challenge-mounted-source-holder-blockers-20260714_20260714113231",
    "attempt_id": "a_ops_challenge-mounted-source-holder-blockers-20260714_20260714113231",
    "status": "done",
    "result": "done",
    "claim": "done",
    "summary": "Synthetic runtime repair completion emitted to close stale open project.task pair after the planner had already accepted and archived the mounted-source holder audit as done.",
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

`event_pair_runs` now shows:

- `correlation_key = ops/challenge-mounted-source-holder-blockers-20260714:a_ops_challenge-mounted-source-holder-blockers-20260714_20260714113231`
- `status = closed`
- `close_event_id = 3180620`
- `closed_at = 1784029465745`

### 2) The repair event was accepted

The new event row shows:

- `id = 3180620`
- `event_type = project.task.completed`
- `source = metric-alert-triage-unowned-work-count-3664`
- `delivery_status = accepted`
- `repair = 1`

### 3) Fresh live metric recompute recovered to zero

```json
{"measuredAt":1784029472154,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-14T11:44:32.216Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

## Why this is `fix_root_cause`

The metric was still correctly signaling a live runtime/process gap when judged, the exact contributor was safely repairable by app-ops, and the supported completion-ingress repair removed that contributor without changing metric policy.

## Next validation

Use the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.unowned-work-count` to confirm persisted `metrics.current` updates from `1` to `0` and alert `3664` auto-recovers.
