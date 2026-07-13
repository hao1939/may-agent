# Metric alert triage: `aks-rp-e2e.process.unowned-work-count` alert 3450

## Decision

Chosen operation: `waiting_with_evidence`

## Why

The alert breached at `current=1` because the metric snapshot taken at `2026-07-11T23:45:32.258Z` still counted one stale active task:

- `domain/reconcile-rp-operation-status-polling-unpublished-slice-20260711`
- stale session: `s_task_domain_reconcile-rp-operation-status-polling-unpublished-slice-20260711`
- restart reason: `session-no-activity`

By the time of this triage, that stale carrier had already been requeued and replaced with a fresh active retry session:

- task trace `stale_active_requeued_at`: `2026-07-11T23:47:48.333Z`
- fresh assigned session: `s_task_domain_reconcile-rp-operation-status-polling-unpublished-slice-20260711_retry_20260711234817`
- fresh worker start: `2026-07-11T23:48:20.789Z`
- fresh session `lastActivityAt`: `1783813734769`

A live recompute during triage returned the metric to in-range:

```json
{
  "measuredAt": 1783813765719,
  "value": 0,
  "sampleSize": 0,
  "note": "{\"sampledAt\":\"2026-07-11T23:49:25.811Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"
}
```

## Judgment

This is not a current ownerless-work breach. It is a transient stale-active sampling window that lagged behind the planner's fresh requeue. Because the live metric now recomputes to `0`, the correct action is to wait for the next normal metrics snapshot / recovery lifecycle rather than inventing a new repair or recalibrating the metric.

## Next validation

- Wait for the next scheduled `metrics-snapshot` for `aks-rp-e2e.process.unowned-work-count`.
- Expect the snapshot to remain at `0` and the alert lifecycle to move toward recovery/closure.
- Reopen only if the metric returns above threshold with a new contributor set.
