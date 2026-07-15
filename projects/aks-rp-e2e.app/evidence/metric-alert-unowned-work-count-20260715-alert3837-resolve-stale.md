# Metric alert triage — `aks-rp-e2e.process.unowned-work-count` (alert 3837)

- Alert id: `3837`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Judged at: `2026-07-15T14:29:03Z`
- Chosen operation: `resolve_stale`

## Current judgment

Alert `3837` is stale now.

The stored metric row and open alert still show the earlier breach (`current=1`, `resolved_at=null`), but the current live recompute is already back to `0` with no contributors.

## Evidence checked

### 1. Stored snapshot that triggered alert 3837

Latest stored sampled breach for this alert:

```json
{"value":1,"sample_size":1,"measured_at":1784124461684,"measured_by":"agent:may","note":"{\"sampledAt\":\"2026-07-15T14:07:41.831Z\",\"staleActiveTaskIds\":[\"fix-network-acns-basic-retina-update-retina-enterprise-run-172310203\"],\"staleActiveTaskSessions\":[{\"taskId\":\"fix-network-acns-basic-retina-update-retina-enterprise-run-172310203\",\"sessionId\":\"s_task_fix-network-acns-basic-retina-update-retina-enterprise-run-172310203_sic-retina-update-retina-enterprise-run-172310203_20260715135114\",\"restartReason\":\"session-no-activity\"}],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

So alert `3837` was opened for one stale active task: `fix-network-acns-basic-retina-update-retina-enterprise-run-172310203`.

### 2. The cited stale-active task has already been requeued out of the bad active state

Current live `task-tree show` for `fix-network-acns-basic-retina-update-retina-enterprise-run-172310203` shows:

- `state: "backlog"`
- `trace.stale_active_requeued_at: "2026-07-15T14:24:49.843Z"`
- `trace.stale_active_requeue_reason: "metric-alert stale-active-with-gaps triage alert3836: task-worker session has >10m stale activity and no completion signal while verification gaps remain; return this fix-forward leaf to backlog for a fresh truthful attempt"`

That means the specific stale-active condition sampled by alert `3837` is no longer present in live task-tree state.

### 3. The old assignment/session pair for that task is already closed

Runtime `event_pair_runs` now shows the old pair is closed:

```json
{
  "correlation_key": "fix-network-acns-basic-retina-update-retina-enterprise-run-172310203:a_fix-network-acns-basic-retina-update-retina-enterprise-run-172310203_20260715135114",
  "status": "closed",
  "closed_at": 1784125609572,
  "note": "superseded by new task attempt"
}
```

This removed the temporary assignment-mismatch contributor that appeared during requeue.

### 4. Fresh live recompute is healthy now

A fresh owner-side recompute now returns zero contributors:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.unowned-work-count --json
```

Result:

```json
{"measuredAt":1784125743495,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-15T14:29:03.753Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

### 5. Persisted alert state is still lagging behind live state

The runtime DB still shows:

- metric row `current=1`
- alert `3837` with `resolved_at=null`

So the visible open alert is lagging the currently recovered live measurement.

## Why `resolve_stale`

The currently authoritative live metric source has already recovered to `0`, and the exact stale-active task named in the triggering snapshot has been requeued out of the bad active state. There is no current unowned-work contributor left to repair.

This session does not have a safe runtime write path to edit `metric_alerts` directly, so the concrete action here is to record the stale-state judgment durably and let the next metrics lifecycle signal reconcile the persisted alert row.

## Next validation signal

Validate on the next `metrics-snapshot` / alert recovery cycle for `aks-rp-e2e.process.unowned-work-count`. Expected result: the metric persists at `0` and alert `3837` clears as recovered.
