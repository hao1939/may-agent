# Metric alert triage — `aks-rp-e2e.process.unowned-work-count` — alert `3252`

- Judged at: `2026-07-09T07:47:30Z`
- Chosen operation: `waiting_with_evidence`
- Metric owner: `app-ops`

## Judgment

The alert was a real transient breach, but it is not live unowned work now.
The persisted metric row still shows `current=1` from snapshot `2026-07-09T07:45:49Z`, where the only contributor was:

- `staleActiveTaskIds=["verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607090740"]`
- `staleActiveTaskSessions=[{"taskId":"verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607090740","sessionId":"s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607090740","restartReason":"session-not-running"}]`

A fresh supported recompute now returns `value=0`, and the same task now has current task-tree ownership plus a fresh retry session after the watchdog/planner stale-active requeue. Because this triage environment has no safe runtime write path to resolve the alert row directly, the correct final operation is `waiting_with_evidence` until the next metrics snapshot reconciles the already-healthy live state.

## Evidence checked

### 1. Persisted breach source was a single stale-active task

Open alert row:

- `alert_id=3252`
- `metric_id=aks-rp-e2e.process.unowned-work-count`
- `resolved_at=NULL`

Current metric row still records the breach:

- `current=1`
- `threshold=0`
- `target=0`
- `priority=P0`
- `updated_at=1783583149340`

Latest stored snapshot note reported exactly one contributor:

- task id: `verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607090740`
- session id: `s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607090740`
- restart reason: `session-not-running`
- `assignmentMismatchKeys=[]`
- `recoveryUnownedSpecIds=[]`

So the breach came from transient stale-active accounting rather than an ownerless recovery gap or assignment mismatch.

### 2. Current runtime task tree still owns the task

`bun run task-tree show verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607090740` now shows:

- `state: "active"`
- `owner: "aks-explorer"`
- `session_id: "s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607090740_retry_20260709074652"`
- `trace.assigned_worker: "aks-explorer"`
- `trace.stale_active_requeued_at: "2026-07-09T07:46:51.837Z"`
- `trace.current_attempt_id: "a_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607090740_20260709074652"`

So the unfinished work is not ownerless in current runtime state.

### 3. Fresh supported recompute is healthy

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

Observed result:

```json
{"measuredAt":1783583218665,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-09T07:46:58.812Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

That directly shows the current live project state is healthy even though the persisted metric row and alert row have not yet been refreshed.

## Why `waiting_with_evidence`

- **Not `fix_root_cause`**: there is no current unowned task to repair; the previously sampled task already has an owner and a fresh retry session.
- **Not `resolve_stale`**: this environment does not provide a safe runtime write path to resolve the alert row manually.
- **Not `calibrate_metric`**: the metric usefully captured a real stale-active condition; threshold `0` remains correct.
- **Not `upgrade_or_escalate`**: no destructive action or human-only decision is needed because live state is already healthy.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.unowned-work-count`. Recovery is confirmed when persisted `metrics.current` updates from `1` to `0` and alert `3252` resolves automatically. If a fresh recompute returns `>0` again, reopen only with the exact contributor ids from the new snapshot note.
