# Metric alert triage — `aks-rp-e2e.process.unowned-work-count` — alert `3225`

- Judged at: `2026-07-09T18:00:05Z`
- Chosen operation: `waiting_with_evidence`
- Metric owner: `app-ops`

## Judgment

The alert was a real transient breach at `2026-07-09T04:22:39Z`, but it is not an ongoing unowned-work defect now. The latest persisted snapshot attributed the breach entirely to two active spec-loop follow-up tasks (`reconcile-spec-loop-pending-kms-40` and `reconcile-spec-loop-pending-storage-csi-26`) whose sessions were sampled as `session-not-running`. A fresh current recompute now returns `value=0`, and both corresponding sessions are presently running with current task-tree ownership intact. In this triage environment there is no safe runtime write path to resolve the alert row directly, so the smallest truthful final operation is `waiting_with_evidence` until the next metrics snapshot/alert refresh reconciles the already-healthy live state.

## Evidence checked

### 1. Persisted metric row and snapshot showed a real breach

The alert payload and recent snapshot reported:

- `current=2`
- `threshold=0`
- `target=0`
- latest snapshot note:
  - `staleActiveTaskIds=["reconcile-spec-loop-pending-kms-40","reconcile-spec-loop-pending-storage-csi-26"]`
  - `staleActiveTaskSessions=[{"taskId":"reconcile-spec-loop-pending-kms-40","sessionId":"s_task_reconcile-spec-loop-pending-kms-40","restartReason":"session-not-running"},{"taskId":"reconcile-spec-loop-pending-storage-csi-26","sessionId":"s_task_reconcile-spec-loop-pending-storage-csi-26","restartReason":"session-not-running"}]`
  - `assignmentMismatchKeys=[]`
  - `recoveryUnownedSpecIds=[]`

That means the breach came from stale-active accounting, not missing holders or assignment-mismatch residue.

### 2. Current runtime task tree still owns both contributor tasks

Direct inspection of `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` shows both sampled contributor task ids still exist as active `domain_leaf` tasks with owner `aks-explorer`, live `session_id` fields, and valid spec-loop follow-up scopes:

- `reconcile-spec-loop-pending-kms-40`
- `reconcile-spec-loop-pending-storage-csi-26`

So there is no current unowned unfinished work represented by these entries.

### 3. Both previously stale sessions are now running

Read-only DB inspection of `sessions` now shows:

- `s_task_reconcile-spec-loop-pending-kms-40` → `status=running`
- `s_task_reconcile-spec-loop-pending-storage-csi-26` → `status=running`

Both sessions also have nonzero `opCount` and fresh `lastActivityAt`, which means the prior `session-not-running` classification no longer reflects current state.

### 4. Fresh supported recompute is already healthy

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

Observed result:

```json
{"measuredAt":1783571171520,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-09T04:26:11.652Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

This is the authoritative current measurement path for the metric, and it shows no remaining unowned-work contributors.

## Why `waiting_with_evidence`

- **Not `fix_root_cause`**: there is no current ownerless task to repair; the sampled tasks already have owners and live sessions again.
- **Not `resolve_stale`**: the stale row could be resolved only through a safe runtime write path, which is not available in this session.
- **Not `calibrate_metric`**: the measurement itself was useful and identified a transient stale-active condition; the threshold is not the problem.
- **Not `upgrade_or_escalate`**: current live state is already healthy, and no destructive/human-only action is needed.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.unowned-work-count`. Recovery is confirmed when the persisted `metrics.current` row updates from `2` to `0` and alert `3225` resolves automatically. If a fresh recompute returns `>0` again, reopen only with the exact contributor ids from the new snapshot note.
