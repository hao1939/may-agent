# Repair note — unowned-work assignment mismatch for done attempt

Task: `ops/repair-unowned-work-assignment-mismatch-done-attempt-20260709n`

Date: 2026-07-09

## Scope

Clear the exact `aks-rp-e2e.process.unowned-work-count` assignment-mismatch contributor:

- task id: `ops/repair-app-ops-review-evidence-path-metadata-20260709j`
- attempt id: `a_ops_repair-app-ops-review-evidence-path-metadata-20260709j_20260709114550`
- correlation key: `ops/repair-app-ops-review-evidence-path-metadata-20260709j:a_ops_repair-app-ops-review-evidence-path-metadata-20260709j_20260709114550`

## Before repair

### Task-tree state

`bun run task-tree show ops/repair-app-ops-review-evidence-path-metadata-20260709j` showed the task was already terminal:

- `state: "done"`
- `status: "done"`
- `resolution: "completed"`
- `done_at: "2026-07-09T11:48:06.604Z"`
- `trace.current_attempt_id: "a_ops_repair-app-ops-review-evidence-path-metadata-20260709j_20260709114550"`

### Runtime pair bookkeeping

Live `event_pair_runs` still had the assignment row open for that exact attempt:

```json
{
  "id": 336223,
  "pair_name": "project.task",
  "correlation_key": "ops/repair-app-ops-review-evidence-path-metadata-20260709j:a_ops_repair-app-ops-review-evidence-path-metadata-20260709j_20260709114550",
  "status": "open",
  "owner": "project:aks-rp-e2e",
  "open_event_id": 2940644,
  "close_event_id": null,
  "opened_at": 1783597550493,
  "expected_close_at": 1783611950493,
  "closed_at": null,
  "note": "opened by project.task.assigned"
}
```

### Unowned-work metric before repair

Fresh recompute:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

Output before repair:

```json
{"measuredAt":1783597830571,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":2,"sampleSize":2,"note":"{\"sampledAt\":\"2026-07-09T11:50:30.651Z\",\"staleActiveTaskIds\":[\"ops/repair-compact-ccp-agent-reviewed-exception-mixed-frontier-holder-20260709l\"],\"staleActiveTaskSessions\":[{\"taskId\":\"ops/repair-compact-ccp-agent-reviewed-exception-mixed-frontier-holder-20260709l\",\"sessionId\":\"s_task_ops_repair-compact-ccp-agent-reviewed-exception-mixed-frontier-holder-20260709l\",\"restartReason\":\"session-not-running\"}],\"assignmentMismatchKeys\":[\"ops/repair-app-ops-review-evidence-path-metadata-20260709j:a_ops_repair-app-ops-review-evidence-path-metadata-20260709j_20260709114550\"],\"assignmentMismatchTasks\":[{\"correlationKey\":\"ops/repair-app-ops-review-evidence-path-metadata-20260709j:a_ops_repair-app-ops-review-evidence-path-metadata-20260709j_20260709114550\",\"taskId\":\"ops/repair-app-ops-review-evidence-path-metadata-20260709j\",\"attemptId\":\"a_ops_repair-app-ops-review-evidence-path-metadata-20260709j_20260709114550\",\"taskState\":\"done\"}],\"recoveryUnownedSpecIds\":[]}"}
```

## Root cause

The metric was truthful: `openTaskAssignmentStateMismatchDetails()` counts open/orphan `event_pair_runs` rows for `pair_name='project.task'` whose correlated task is missing or not `active`.

This task had already been reviewed to `done`, but its matching runtime `project.task` pair row was still open. So the contributor was stale runtime assignment bookkeeping, not bad task-tree state.

## Smallest truthful repair applied

No task-tree file or source file needed to change.

I used the supported runtime ingress `POST /api/events` to emit the missing completion event for the already-done attempt:

```json
{
  "type": "project.task.completed",
  "source": "ops-repair-unowned-work-assignment-mismatch-done-attempt-20260709n",
  "owner": "project:aks-rp-e2e",
  "target": {
    "project": "aks-rp-e2e",
    "taskId": "ops/repair-app-ops-review-evidence-path-metadata-20260709j"
  },
  "data": {
    "project": "aks-rp-e2e",
    "projectId": "aks-rp-e2e",
    "taskId": "ops/repair-app-ops-review-evidence-path-metadata-20260709j",
    "task_id": "ops/repair-app-ops-review-evidence-path-metadata-20260709j",
    "attemptId": "a_ops_repair-app-ops-review-evidence-path-metadata-20260709j_20260709114550",
    "attempt_id": "a_ops_repair-app-ops-review-evidence-path-metadata-20260709j_20260709114550",
    "status": "done",
    "result": "done",
    "claim": "done",
    "summary": "Synthetic runtime repair completion emitted to close stale open project.task pair after the task was already reviewed done.",
    "reason": "runtime-pair-repair",
    "repair": true
  }
}
```

Runtime response:

```json
{"ok":true,"triggered":true,"eventType":"project.task.completed","reason":"runtime-pair-repair","workflowStarted":false,"workflowRunId":null,"workflowStatus":null,"featureTestRequest":null,"featureTestFeedback":null}
```

## After repair

### Runtime completion event recorded

A new `events` row exists for the exact task/attempt pair:

```json
{
  "id": 2940970,
  "event_type": "project.task.completed",
  "source": "ops-repair-unowned-work-assignment-mismatch-done-attempt-20260709n",
  "owner": "project:aks-rp-e2e",
  "status": "pending",
  "delivery_status": "accepted",
  "timestamp": 1783597930034,
  "taskId": "ops/repair-app-ops-review-evidence-path-metadata-20260709j",
  "attemptId": "a_ops_repair-app-ops-review-evidence-path-metadata-20260709j_20260709114550",
  "result": "done",
  "repair": 1
}
```

### Pair row closed

The same `event_pair_runs` row now shows closed bookkeeping:

```json
{
  "id": 336223,
  "pair_name": "project.task",
  "correlation_key": "ops/repair-app-ops-review-evidence-path-metadata-20260709j:a_ops_repair-app-ops-review-evidence-path-metadata-20260709j_20260709114550",
  "status": "closed",
  "owner": "project:aks-rp-e2e",
  "open_event_id": 2940644,
  "close_event_id": 2940970,
  "opened_at": 1783597550493,
  "expected_close_at": 1783611950493,
  "closed_at": 1783597930034,
  "note": "opened by project.task.assigned"
}
```

### Unowned-work metric after repair

Fresh recompute after the runtime close event:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

Output after repair:

```json
{"measuredAt":1783597930678,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-09T11:52:10.745Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

## Persisted metric lag note

The persisted `metrics` row had not refreshed yet at the time of this repair note:

```json
{
  "id": "aks-rp-e2e.process.unowned-work-count",
  "current": 1,
  "updated_at": 1783597847872
}
```

That remaining `metrics.current=1` is bounded async lag only: the live recompute is already `0`, the stale assignment pair is now closed, and no assignment-mismatch contributors remain.

## Changed files / mutations

- File written: `evidence/archive/ops-repair-unowned-work-assignment-mismatch-done-attempt-20260709n.md`
- Runtime mutation applied: one supported `POST /api/events` synthetic `project.task.completed` repair event
- No task-tree JSON was edited directly
- No source code file changed
