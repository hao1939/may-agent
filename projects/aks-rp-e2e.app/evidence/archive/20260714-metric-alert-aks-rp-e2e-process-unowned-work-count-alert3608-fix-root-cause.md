# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.unowned-work-count`

- Alert id: `3608`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Owner: `app-ops`
- Priority: `P0`
- Judged at: `2026-07-14T06:21:15Z`
- Chosen operation: `fix_root_cause`

## Why the breach was real

The original alert snapshot at `2026-07-14T06:06:26Z` named one stale-active task:

- `domain/rp-cluster-lifecycle-new-vnet-pass-writeback-surface-sync-20260714`
- `sessionId = s_task_domain_rp-cluster-lifecycle-new-vnet-pass-writeback-surface-sync-20260714`
- `restartReason = session-not-running`

By the time of triage, the open alert row had already rebased to the **current** live breach, and the persisted metric row still showed a real failure:

- `metrics.current = 5`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1784009828268`
- `metric_alerts.id = 3608` still open with message `current=5`

A fresh supported recompute confirmed the breach was still real and named five current contributors:

```json
{"measuredAt":1784009929364,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":5,"sampleSize":5,"note":"{\"sampledAt\":\"2026-07-14T06:18:49.452Z\",\"staleActiveTaskIds\":[\"domain/windows-vm-prerelease-draft-family-surface-reconcile-20260714\",\"ops/diagnose-missing-waiting-metric-staleness-20260714\"],\"staleActiveTaskSessions\":[{\"taskId\":\"domain/windows-vm-prerelease-draft-family-surface-reconcile-20260714\",\"sessionId\":\"s_task_domain_windows-vm-prerelease-draft-family-surface-reconcile-20260714\",\"restartReason\":\"session-not-running\"},{\"taskId\":\"ops/diagnose-missing-waiting-metric-staleness-20260714\",\"sessionId\":\"s_task_ops_diagnose-missing-waiting-metric-staleness-20260714\",\"restartReason\":\"session-not-running\"}],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[\"domain/rp-cluster-lifecycle-new-vnet-pass-writeback-surface-sync-20260714:a_domain_rp-cluster-lifecycle-new-vnet-pass-writeback-surface-sync-20260714_20260714055706\",\"domain/localdns-residual-family-sync-and-holder-reduction-20260714:a_domain_localdns-residual-family-sync-and-holder-reduction-20260714_20260714060128\",\"domain/rp-nodepool-operations-row3-residual-holder-path-reconcile-20260714:a_domain_rp-nodepool-operations-row3-residual-holder-path-reconcile-20260714_20260714060251\"],\"assignmentMismatchTasks\":[{\"correlationKey\":\"domain/rp-cluster-lifecycle-new-vnet-pass-writeback-surface-sync-20260714:a_domain_rp-cluster-lifecycle-new-vnet-pass-writeback-surface-sync-20260714_20260714055706\",\"taskId\":\"domain/rp-cluster-lifecycle-new-vnet-pass-writeback-surface-sync-20260714\",\"attemptId\":\"a_domain_rp-cluster-lifecycle-new-vnet-pass-writeback-surface-sync-20260714_20260714055706\",\"taskState\":null},{\"correlationKey\":\"domain/localdns-residual-family-sync-and-holder-reduction-20260714:a_domain_localdns-residual-family-sync-and-holder-reduction-20260714_20260714060128\",\"taskId\":\"domain/localdns-residual-family-sync-and-holder-reduction-20260714\",\"attemptId\":\"a_domain_localdns-residual-family-sync-and-holder-reduction-20260714_20260714060128\",\"taskState\":null},{\"correlationKey\":\"domain/rp-nodepool-operations-row3-residual-holder-path-reconcile-20260714:a_domain_rp-nodepool-operations-row3-residual-holder-path-reconcile-20260714_20260714060251\",\"taskId\":\"domain/rp-nodepool-operations-row3-residual-holder-path-reconcile-20260714\",\"attemptId\":\"a_domain_rp-nodepool-operations-row3-residual-holder-path-reconcile-20260714_20260714060251\",\"taskState\":null}],\"recoveryUnownedSpecIds\":[]}"}
```

The exact task/session checks showed:

- `domain/windows-vm-prerelease-draft-family-surface-reconcile-20260714` was still `active` in the task tree, but runtime `sessions` showed its worker session had already finished with `status='done'`.
- `ops/diagnose-missing-waiting-metric-staleness-20260714` was still `active` in the task tree, but runtime `sessions` showed its worker session had already ended and the evidence artifact already existed.
- Three earlier domain tasks were already archived under `.state/tasks/archive/...` as done/replaced, yet their `project.task` pair rows were still open:
  - `domain/rp-cluster-lifecycle-new-vnet-pass-writeback-surface-sync-20260714`
  - `domain/localdns-residual-family-sync-and-holder-reduction-20260714`
  - `domain/rp-nodepool-operations-row3-residual-holder-path-reconcile-20260714`

## Concrete repair applied

### 1. Moved stale-active leaves to review through the safe task-tree path

I used the supported task-tree completion command to take the three ownerless active leaves out of `active` once their artifacts already existed:

- `domain/windows-vm-prerelease-draft-family-surface-reconcile-20260714`
- `ops/diagnose-missing-waiting-metric-staleness-20260714`
- `ops/repair-focus-draft-family-approval-dispatch-20260714`

After these commands, `task-tree summary` showed those leaves under `frontier.review` instead of `frontier.active`.

### 2. Closed stale open `project.task` pairs through the supported runtime ingress

I then emitted exact synthetic `project.task.completed` repair events via `POST http://127.0.0.1:8080/api/events` for every stale open pair that was no longer backed by an active worker:

1. `domain/rp-cluster-lifecycle-new-vnet-pass-writeback-surface-sync-20260714`
2. `domain/localdns-residual-family-sync-and-holder-reduction-20260714`
3. `domain/rp-nodepool-operations-row3-residual-holder-path-reconcile-20260714`
4. `domain/windows-vm-prerelease-draft-family-surface-reconcile-20260714`
5. `ops/diagnose-missing-waiting-metric-staleness-20260714`
6. `domain/schedulerctrl-apiservervnet-validating-webhook-draft-family-surface-reconcile-20260714`
7. `ops/repair-focus-draft-family-approval-dispatch-20260714`

Each runtime response was the same accepted close result:

```json
{"ok":true,"triggered":true,"eventType":"project.task.completed","reason":"runtime-pair-repair","workflowStarted":false,"workflowRunId":null,"workflowStatus":null,"featureTestRequest":null,"featureTestFeedback":null}
```

The `schedulerctrl` pair was discovered during the repair itself: after the first five repairs, a fresh recompute exposed one newly-open stale pair for `domain/schedulerctrl-apiservervnet-validating-webhook-draft-family-surface-reconcile-20260714`. Task-tree/archive evidence showed that task had already been replaced before worker start and archived as settled history, so I closed that pair too. A later recompute then exposed one more stale-active leaf, `ops/repair-focus-draft-family-approval-dispatch-20260714`, whose session had already finished with `status='done'`; I moved it to review and closed its pair as well.

## Validation after repair

### 1. Repair completion events were accepted for all seven stale task/attempt pairs

Runtime `events` now shows seven accepted `project.task.completed` rows with:

- `source = metric-alert-triage-unowned-work-count-3608`
- `delivery_status = accepted`
- `repair = 1`

including ids `3166631`, `3166634`, `3166637`, `3166640`, `3166643`, `3166675`, and `3166682`.

### 2. The only remaining open project.task pair is a legitimate live active task

After repair, `event_pair_runs` open rows shrank to a single current active assignment:

- `ops/reconcile-shared-auth-owner-return-family-shape-20260714:a_ops_reconcile-shared-auth-owner-return-family-shape-20260714_20260714061800`

That row is still backed by a live `frontier.active` task, so it is not an unowned-work contributor.

### 3. Fresh metric recompute recovered to zero

The final supported recompute returned:

```json
{"measuredAt":1784010075696,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-14T06:21:15.729Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

## Why this is `fix_root_cause`

This alert was not just a stale historical row. The open alert had rebased to a real current breach (`current=5`), and a fresh owner-side recompute named concrete live contributors. App-ops could safely repair those contributors by (1) moving already-finished stale-active leaves out of `active`, and (2) closing the exact stale `project.task` pair rows through the supported runtime event ingress instead of editing the database directly. The live metric source now returns `0` with no contributors.

## Next validation

Wait for the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.unowned-work-count`. Recovery is confirmed when persisted `metrics.current` updates from `5` to `0` and alert `3608` auto-recovers.
