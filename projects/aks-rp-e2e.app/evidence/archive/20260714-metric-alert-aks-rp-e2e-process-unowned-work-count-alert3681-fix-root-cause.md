# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.unowned-work-count`

- Alert id: `3681`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Owner: `app-ops`
- Priority: `P0`
- Judged at: `2026-07-14T16:33:02Z`
- Chosen operation: `fix_root_cause`

## Why the breach was real

The persisted runtime metric row still breached during triage:

- `current = 2`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1784046670420`

A fresh supported recompute still returned `value=2` and named two exact assignment mismatches:

```json
{"measuredAt":1784046752579,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":2,"sampleSize":2,"note":"{\"sampledAt\":\"2026-07-14T16:32:32.686Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[\"ops/repair-nonapproval-escalation-open-lineage-closure-20260714:a_ops_repair-nonapproval-escalation-open-lineage-closure-20260714_20260714161551\",\"ops/repair-focus-controller-redispatch-gap-20260714:a_ops_repair-focus-controller-redispatch-gap-20260714_20260714161917\"],\"assignmentMismatchTasks\":[{\"correlationKey\":\"ops/repair-nonapproval-escalation-open-lineage-closure-20260714:a_ops_repair-nonapproval-escalation-open-lineage-closure-20260714_20260714161551\",\"taskId\":\"ops/repair-nonapproval-escalation-open-lineage-closure-20260714\",\"attemptId\":\"a_ops_repair-nonapproval-escalation-open-lineage-closure-20260714_20260714161551\",\"taskState\":null,\"reason\":\"task-missing\",\"sessionId\":\"s_task_ops_repair-nonapproval-escalation-open-lineage-closure-20260714\",\"sessionStatus\":\"done\",\"sessionOutcome\":\"done\",\"sessionStartedAt\":1784046202156,\"sessionLastActivityAt\":1784046308721,\"sessionEndedAt\":1784046308721},{\"correlationKey\":\"ops/repair-focus-controller-redispatch-gap-20260714:a_ops_repair-focus-controller-redispatch-gap-20260714_20260714161917\",\"taskId\":\"ops/repair-focus-controller-redispatch-gap-20260714\",\"attemptId\":\"a_ops_repair-focus-controller-redispatch-gap-20260714_20260714161917\",\"taskState\":null,\"reason\":\"task-missing\",\"sessionId\":\"s_task_ops_repair-focus-controller-redispatch-gap-20260714\",\"sessionStatus\":\"done\",\"sessionOutcome\":\"done\",\"sessionStartedAt\":1784046201708,\"sessionLastActivityAt\":1784046317753,\"sessionEndedAt\":1784046317753}],\"recoveryUnownedSpecIds\":[]}"}
```

Those two tasks had already been archived as `state: done` / `resolution: replaced` in `.state/tasks/archive/done-leaves-20260714162913512.json`, so the live breach was stale open `project.task` pair bookkeeping rather than still-runnable ownerless work.

## Concrete repair applied

I used the supported runtime ingress `POST http://127.0.0.1:8080/api/events` and emitted two exact synthetic `project.task.completed` repair events with source `metric-alert-triage-unowned-work-count-3681` for the archived task/attempt pairs:

1. `ops/repair-nonapproval-escalation-open-lineage-closure-20260714`
2. `ops/repair-focus-controller-redispatch-gap-20260714`

Each runtime response was accepted:

```json
{"ok":true,"triggered":true,"eventType":"project.task.completed","reason":"runtime-pair-repair","workflowStarted":false,"workflowRunId":null,"workflowStatus":null,"featureTestRequest":null,"featureTestFeedback":null}
```

## Validation after repair

### 1) Both stale pair runs are now closed

`event_pair_runs` now shows:

- `ops/repair-nonapproval-escalation-open-lineage-closure-20260714:a_ops_repair-nonapproval-escalation-open-lineage-closure-20260714_20260714161551`
  - `status = closed`
  - `close_event_id = 3187354`
- `ops/repair-focus-controller-redispatch-gap-20260714:a_ops_repair-focus-controller-redispatch-gap-20260714_20260714161917`
  - `status = closed`
  - `close_event_id = 3187357`

### 2) The repair completion events were accepted

Runtime `events` shows two accepted `project.task.completed` rows with:

- `source = metric-alert-triage-unowned-work-count-3681`
- `delivery_status = accepted`
- `repair = 1`

### 3) Fresh live metric recompute recovered to zero

```json
{"measuredAt":1784046782644,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-14T16:33:02.752Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

## Why this is `fix_root_cause`

The alert was still correctly signaling a live process gap when judged. App-ops could safely repair the exact stale `project.task` pair rows through the supported completion ingress, and the live metric source immediately recovered to `0` without changing metric policy.

## Next validation

Use the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.unowned-work-count` to confirm persisted `metrics.current` updates from `2` to `0` and alert `3681` auto-recovers.
