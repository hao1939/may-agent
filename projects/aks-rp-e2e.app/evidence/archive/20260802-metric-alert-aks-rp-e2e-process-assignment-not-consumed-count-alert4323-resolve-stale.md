# Metric alert triage — resolve_stale — `aks-rp-e2e.process.assignment.not-consumed-count`

- Alert id: `4323`
- Metric id: `aks-rp-e2e.process.assignment.not-consumed-count`
- Chosen operation: `resolve_stale`
- Judged at: `2026-08-02T04:13:40Z`

## Why this operation

The alert is already recovered. The only queued assignment in the breaching snapshot was a stale `scenario-normalization` attempt from a previous runtime. Runtime recovery interrupted that orphaned attempt, retried the task on a fresh attempt, and the next metric snapshot returned to `0` with no remaining queued assignments.

## Evidence checked

### Runtime metric row now healthy

Runtime `metrics` row currently shows:

- `current = 0`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1785643855028`

### Breach snapshot

`metric_snapshots` recorded the breach at `1785643393298`:

```json
{"assignments":[{"taskId":"scenario-normalization","attemptId":"r_50_463dfc69-8545-462b-bee7-417f07bccb4a","assignedAt":"2026-08-02T03:56:18.526Z","taskState":"active"}]}
```

### The offending assignment was a previous-runtime orphan

`/app/projects/aks-rp-e2e.app/.state/tasks/state.json` now records attempt `r_50_463dfc69-8545-462b-bee7-417f07bccb4a` as:

- `taskId = scenario-normalization`
- `state = interrupted`
- `startedAt = 2026-08-02T03:56:18.526Z`
- `finishedAt = 2026-08-02T04:08:05.931Z`
- `summary = "Interrupted reconciliation scenario-normalization belonged to a previous runtime; retrying from current task evidence"`
- `failureReason = previous-runtime-attempt-requeued`

### Recovery produced a fresh consumed attempt

After the orphan was interrupted, runtime emitted a fresh reconcile/dispatch sequence for the same task:

- `project.task.reconcile.started` at `1785643859094` for attempt `r_50_d620f2e9-6668-4f85-a2f1-6578443e6e12`
- `handler.workflow_dispatched(status=started)` at `1785643866832`
- `workflow.started` for `wr_1785643877985_wdxy` at `1785643877995`
- `handler.workflow_dispatched(status=done)` at `1785643895219`
- `project.task.reconciled` at `1785643895963`

### Recovery signal already closed the alert

- `metric.recovered` event `4861208` fired at `1785643785397` with `alertId = 4323` and `current = 0`
- `metric_alerts.id = 4323` has `resolved_at = 1785643785347`
- live recompute now returns:

```json
{"measuredAt":1785644020645,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"assignments\":[]}"}
```

## Judgment

This was a truthful transient alert on an orphaned assignment row that runtime recovery has already repaired. No additional app or metric change is needed from this triage step.

## Next validation

- Next `metrics-snapshot` should keep `aks-rp-e2e.process.assignment.not-consumed-count = 0` unless another assignment survives recovery or fails to dispatch.
