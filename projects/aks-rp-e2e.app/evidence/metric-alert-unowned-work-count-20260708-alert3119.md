# Metric alert triage — aks-rp-e2e.process.unowned-work-count (alert 3119)

- Alert id: `3119`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Judged at: `2026-07-08T11:03:48Z`
- Chosen operation: `resolve_stale`

## Current judgment

This alert is a transient stale-active spike, not a still-breaching current condition.

The runtime metric row still shows the older sampled breach:

- `current=2`
- `threshold=0`
- `updated_at=1783508469205`

That sampled breach came from two active tasks whose sessions had not started running yet at sample time:

- `reconcile-spec-traffic-applink-bounded-authority-review-20260708`
- `reconcile-compact-live-workflow-family-split-20260708`

## Evidence checked

Recent stored snapshots show the metric flipped from `0` to `2` at `2026-07-08T11:01:09Z` with those two `staleActiveTaskIds`.

Direct task inspection immediately after the alert showed both cited tasks were still truthfully active and had worker start traces already recorded:

- `reconcile-spec-traffic-applink-bounded-authority-review-20260708`
  - `state: active`
  - `session_id: s_task_reconcile-spec-traffic-applink-bounded-authority-review-20260708`
  - `trace.worker_started_at: 2026-07-08T11:01:32.613Z`
- `reconcile-compact-live-workflow-family-split-20260708`
  - `state: active`
  - `session_id: s_task_reconcile-compact-live-workflow-family-split-20260708`
  - `trace.worker_started_at: 2026-07-08T11:01:33.832Z`

A fresh recompute a few minutes later briefly showed one different transient contributor:

```json
{"measuredAt":1783508584576,"value":1,"sampleSize":1,"note":"{\"sampledAt\":\"2026-07-08T11:03:04.752Z\",\"staleActiveTaskIds\":[\"reconcile-spec-loop-pending-net-integration-8\"],\"staleActiveTaskSessions\":[{\"taskId\":\"reconcile-spec-loop-pending-net-integration-8\",\"sessionId\":\"s_task_reconcile-spec-loop-pending-net-integration-8_retry_20260708110116\",\"restartReason\":\"session-not-running\"}],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

That task then advanced to `state: review` with worker completion already recorded:

- `reconcile-spec-loop-pending-net-integration-8`
  - `state: review`
  - `trace.last_worker_completed_at: 2026-07-08T11:03:06.006Z`

A second fresh recompute then showed full recovery:

```json
{"measuredAt":1783508628589,"value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-08T11:03:48.720Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

## Why `resolve_stale`

The open alert row reflects an earlier sample, but the current metric source no longer breaches. The issue was transient stale-active sampling around just-started or just-finished worker transitions, not durable ownerless work.

Because this session does not have a safe runtime write path for `metric_alerts`, the correct action is to record the evidence and let the next metrics lifecycle signal confirm recovery rather than trying to mutate the runtime DB directly.

## Next validation signal

Validate on the next `metrics-snapshot` / alert recovery cycle for `aks-rp-e2e.process.unowned-work-count`. Expected result: the metric remains `0` and alert `3119` clears as recovered.