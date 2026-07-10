# Metric alert triage — resolve_stale — `aks-rp-e2e.process.unowned-work-count`

- Alert id: `3383`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Judged at: `2026-07-10T17:23:55Z`
- Chosen operation: `resolve_stale`

## Why this alert is stale now

The open alert row still reflects a transient stale-active snapshot, but fresh source-of-truth checks already show the breach has recovered.

### Alert and metric rows at triage time

Runtime inspection showed:

- `metric_alerts.id = 3383` remained open with `resolved_at = null`
- `metrics.current = 1`, `threshold = 0`, `target = 0`, `priority = P0`
- latest persisted snapshot (`measured_at = 1783710774047`) recorded one contributor:
  - `domain/review-vm-prerelease-run-28721673014-overdue-frontier-family-20260710`
  - session id `s_task_domain_review-vm-prerelease-run-28721673014-overdue-frontier-family-20260710`
  - restart reason `session-not-running`

### Current live recompute already recovered

A fresh supported recompute from the app command surface returned:

```json
{"measuredAt":1783710820501,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-10T19:13:40.745Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

That means the current contributor set is empty and the live metric is already back in range.

### The cited task/session also already converged

The allegedly unowned task now shows completed worker output rather than an active stale worker:

- `task-tree show domain/review-vm-prerelease-run-28721673014-overdue-frontier-family-20260710`
  - `state: review`
  - `status: review`
  - `trace.last_worker_result: done`
  - `trace.last_worker_completed_at: 2026-07-10T19:12:54.273Z`
- runtime `sessions` row for `s_task_domain_review-vm-prerelease-run-28721673014-overdue-frontier-family-20260710`
  - `status: done`
  - `endedAt: 1783710773404`
  - `lastActivityAt: 1783710773404`

## Judgment

This alert is stale because the persisted breaching snapshot caught the task at the worker/session completion boundary, but a fresh recompute and the current task/session state now agree that there is no unfinished work without an owner.

No root-cause repair is needed from app-ops in this session because the underlying task already completed and the supported metric sampler now returns `0`. The remaining issue is alert lifecycle lag until the next metric snapshot/recovery pass updates the runtime rows.

## Next validation

Use the next `metrics-snapshot` cycle for `aks-rp-e2e.process.unowned-work-count` to confirm the persisted metric row returns to `0` and alert `3383` auto-recovers.
