# Metric alert triage — resolve_stale — `aks-rp-e2e.process.unowned-work-count`

- Alert id: `4245`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Owner: `app-ops`
- Priority: `P0`
- Judged at: `2026-07-28T09:06:41Z`
- Chosen operation: `resolve_stale`

## Judgment

Alert `4245` was real at sampling time but is stale by triage time.

The persisted metric row and open alert still show the breaching snapshot from `2026-07-28T09:03:17Z` (`current=1`), but a fresh owner-side recompute now returns `0` with no contributors. The exact task named in the alert snapshot is no longer active unowned work; it has already advanced into an exact external wait on pipeline run `174086236`.

## Evidence checked

### 1. Persisted metric state is still breaching

Runtime DB still shows:

- `metrics.current = 1`
- `metrics.threshold = 0`
- `metrics.target = 0`
- `metrics.priority = P0`
- `metrics.updated_at = 1785229395963` (`2026-07-28T09:03:15.963Z`)
- open alert `metric_alerts.id = 4245` with `resolved_at = null`

The latest stored breaching snapshot cites one contributor:

- `staleActiveTaskIds = ["domain/normalize-plain-scenario-carrier-storage-csi-tests-storage-csi-volume-snapshot-restore.ts-61bd1571"]`
- `staleActiveTaskSessions = [{"taskId":"domain/normalize-plain-scenario-carrier-storage-csi-tests-storage-csi-volume-snapshot-restore.ts-61bd1571","sessionId":null,"restartReason":"missing-session"}]`

### 2. Fresh live recompute is healthy now

A fresh owner-side metric sample now returns zero contributors:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

Result:

```json
{"measuredAt":1785229474884,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-28T09:04:36.585Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

### 3. The cited task is no longer active; it has already moved into an exact wait

Current task-tree state for the cited task now shows:

- `phase = "waiting"`
- `state = "blocked"`
- `status.conditionIds = ["pipeline-run-174086236-completed"]`
- summary: `Queued exact live verification run 174086236 for spec.storage-csi.volume-snapshot-restore at c65951290e69734d83b5b2f386b300f504e0607d.`

So the exact stale-active condition from the alert snapshot is no longer present. The work remains owned by `aks-explorer`, but it is now truthfully represented as an external wait, not as unfinished work without an active owner.

### 4. The current visible frontier agrees that the task left the active packet

Fresh frontier output shows current active tasks are:

- `compact/repair-compact-feature-app-routing-representation-b95841cec2`
- `compact/repair-compact-feature-fleet-representation-2bada93f77`
- `domain/normalize-plain-scenario-carrier-workload-autoscaler-tests-vpa-upgrade-survival-runtime.ts-fabc373b`
- `domain/reconcile-rp-master-validation-if-match-94e1e378-live-child-attention-routing-20260728`

The cited `storage-csi-volume-snapshot-restore` task is no longer listed in `active`.

## Why `resolve_stale`

There is no current unowned-work contributor left for app-ops to repair safely in this session. The breach came from a transient state transition before the task settled into its exact wait. The current authoritative metric source is already back in range (`0`), so the still-open alert row is lagging current reality.

This workflow does not provide a safe runtime write path to resolve `metric_alerts` directly, so the concrete action here is to record the stale-state judgment durably and let the next metrics snapshot / alert lifecycle close the row normally.

## Next validation

Validate on the next `metrics-snapshot` / alert recovery cycle for `aks-rp-e2e.process.unowned-work-count`.

Expected result:

- persisted `metrics.current` updates from `1` to `0`, and
- alert `4245` resolves automatically.
