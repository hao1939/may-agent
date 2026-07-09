# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.unowned-work-count`

- Alert id: `3273`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Judged at: `2026-07-09T12:05:09Z`
- Chosen operation: `fix_root_cause`

## Why the breach was real

A fresh direct recompute during triage still showed a live breach, so this was not only a stale alert row:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

Observed before repair:

```json
{"measuredAt":1783598573865,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":2,"sampleSize":2,"note":"{\"sampledAt\":\"2026-07-09T12:02:53.991Z\",\"staleActiveTaskIds\":[\"verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607091159\",\"reconcile-compact-loop-package-partial-202607091159\"],\"staleActiveTaskSessions\":[{\"taskId\":\"verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607091159\",\"sessionId\":\"s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607091159\",\"restartReason\":\"session-not-running\"},{\"taskId\":\"reconcile-compact-loop-package-partial-202607091159\",\"sessionId\":\"s_task_reconcile-compact-loop-package-partial-202607091159\",\"restartReason\":\"session-not-running\"}],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

The exact contributors were two active leaves whose `session_id` values had no matching runtime `sessions` rows:

- `verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607091159`
- `reconcile-compact-loop-package-partial-202607091159`

`task-tree show` confirmed both were still marked `active` with assigned attempts and worker-start timestamps, while a runtime query of `sessions` for:

- `s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607091159`
- `s_task_reconcile-compact-loop-package-partial-202607091159`

returned zero rows.

## Concrete repair applied

### 1. Return the stale active leaves to truthful backlog state

I used the task-tree safe mutation path to clear the false active ownership claim:

```bash
cd /app/projects/aks-rp-e2e.app && \
  bun run task-tree requeue-active verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607091159 \
    --reason "unowned-work metric repair: session s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607091159 absent from runtime sessions; requeue for clean reassignment"

cd /app/projects/aks-rp-e2e.app && \
  bun run task-tree requeue-active reconcile-compact-loop-package-partial-202607091159 \
    --reason "unowned-work metric repair: session s_task_reconcile-compact-loop-package-partial-202607091159 absent from runtime sessions; requeue for clean reassignment"
```

After this, `task-tree frontier` showed both tasks as `runnable` backlog instead of `active`, and each task trace recorded `stale_active_requeued_at` plus the exact repair reason.

### 2. Close the stale open `project.task` pair rows left behind by the requeue

After the requeue, the metric still read `value=2`, but the contributors changed from stale-active tasks to assignment mismatches. The recompute showed these exact open correlation keys:

- `verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607091159:a_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607091159_20260709115940`
- `reconcile-compact-loop-package-partial-202607091159:a_reconcile-compact-loop-package-partial-202607091159_20260709115941`

`event_pair_runs` confirmed both rows were still `status='open'` even though the tasks were already back in `backlog`.

I used the supported runtime ingress `POST /api/events` to emit exact matching synthetic `project.task.completed` close events for the lost attempts:

### Repair event 1

```json
{
  "type": "project.task.completed",
  "source": "metric-alert-triage-unowned-work-count-3273",
  "owner": "project:aks-rp-e2e",
  "target": {
    "project": "aks-rp-e2e",
    "taskId": "verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607091159"
  },
  "data": {
    "project": "aks-rp-e2e",
    "projectId": "aks-rp-e2e",
    "taskId": "verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607091159",
    "task_id": "verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607091159",
    "attemptId": "a_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607091159_20260709115940",
    "attempt_id": "a_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607091159_20260709115940",
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

### Repair event 2

```json
{
  "type": "project.task.completed",
  "source": "metric-alert-triage-unowned-work-count-3273",
  "owner": "project:aks-rp-e2e",
  "target": {
    "project": "aks-rp-e2e",
    "taskId": "reconcile-compact-loop-package-partial-202607091159"
  },
  "data": {
    "project": "aks-rp-e2e",
    "projectId": "aks-rp-e2e",
    "taskId": "reconcile-compact-loop-package-partial-202607091159",
    "task_id": "reconcile-compact-loop-package-partial-202607091159",
    "attemptId": "a_reconcile-compact-loop-package-partial-202607091159_20260709115941",
    "attempt_id": "a_reconcile-compact-loop-package-partial-202607091159_20260709115941",
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

### Pair rows closed

`event_pair_runs` after repair showed both exact correlation keys closed:

- fleet pair → `status=closed`, `close_event_id=2941619`
- package-partial pair → `status=closed`, `close_event_id=2941616`

### Fresh metric recompute recovered to zero

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

Observed after repair:

```json
{"measuredAt":1783598709024,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-09T12:05:09.056Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

## Why this is `fix_root_cause`

The alert described real unfinished work without a live owner: two task leaves still claimed active ownership after their runtime sessions disappeared, and after reclaiming them the runtime still held two stale open `project.task` pair rows for those abandoned attempts. Requeueing the leaves and then closing the exact stale pair rows removed the actual contributors instead of changing metric thresholds, priority, or alert lifecycle metadata.

## Next validation

Wait for the next `metrics-snapshot` / alert evaluation cycle to refresh the persisted metric row and auto-recover alert `3273` from the current live value `0`.
