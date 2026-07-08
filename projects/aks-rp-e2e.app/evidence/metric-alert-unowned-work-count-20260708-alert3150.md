# Metric alert triage — aks-rp-e2e.process.unowned-work-count (alert 3150)

- Alert id: `3150`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Judged at: `2026-07-08T13:16:00Z`
- Chosen operation: `resolve_stale`

## Current judgment

This alert is stale now.

The stored metric row and open alert still reflect an earlier sampled breach:

- metric `current=1`
- `threshold=0`
- `updated_at=1783516498872`
- open alert `3150` still has `resolved_at = null`

That sampled breach was attributed to one stale-active contributor:

- `rerun-spec-storage-csi-file-private-endpoint-provision-20260708-followup`
- sampled with restart reason `session-not-running`

## Evidence checked

### Stored snapshot that triggered the alert

Latest stored snapshot row:

```json
{"value":1,"sample_size":1,"measured_at":1783516498872,"measured_by":"agent:may","note":"{\"sampledAt\":\"2026-07-08T13:14:58.989Z\",\"staleActiveTaskIds\":[\"rerun-spec-storage-csi-file-private-endpoint-provision-20260708-followup\"],\"staleActiveTaskSessions\":[{\"taskId\":\"rerun-spec-storage-csi-file-private-endpoint-provision-20260708-followup\",\"sessionId\":\"s_task_rerun-spec-storage-csi-file-private-endpoint-provision-20260708-followup\",\"restartReason\":\"session-not-running\"}],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

### Current live recompute

A fresh recompute immediately after the alert now returns zero contributors:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
{"measuredAt":1783516560740,"value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-08T13:16:00.827Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

### Session state for the cited contributor

The session cited in the sampled breach is no longer running; it has already completed:

- `sessionId`: `s_task_rerun-spec-storage-csi-file-private-endpoint-provision-20260708-followup`
- `agent`: `aks-explorer`
- `status`: `done`
- `startedAt`: `1783516285000`
- `endedAt`: `1783516498176`
- `opCount`: `39`
- `lastActivityAt`: `1783516498176`

The session payload also shows the task trace had already recorded `worker_started_at: 2026-07-08T13:11:24.926Z`, so the sampled `session-not-running` contributor was a transient stale-active accounting window rather than durable ownerless work.

## Why `resolve_stale`

The currently authoritative live metric source has already recovered to `0`, and the only cited contributor is a completed follow-up session that is no longer active. The open alert row is lagging the current recovered state rather than signaling unfinished unowned work that still needs repair.

This environment does not provide a safe runtime write path to resolve `metric_alerts` directly, so the correct action is to record the stale/recovered evidence and let the next metrics lifecycle signal clear the alert.

## Next validation signal

Validate on the next `metrics-snapshot` / alert recovery cycle for `aks-rp-e2e.process.unowned-work-count`. Expected result: the metric remains `0` and alert `3150` clears as recovered.
