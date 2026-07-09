# Metric alert triage — `aks-rp-e2e.process.unowned-work-count` — alert `3238`

- Judged at: `2026-07-09T06:49:30Z`
- Chosen operation: `waiting_with_evidence`
- Metric owner: `app-ops`

## Judgment

The alert was a transient stale-active breach, but it is not live unowned work now.
The persisted metric row still shows `current=1` from snapshot `2026-07-09T06:43:09Z`, where the only contributor was:

- `staleActiveTaskIds=["verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607090641"]`
- `staleActiveTaskSessions=[{"taskId":"verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607090641","sessionId":"s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607090641","restartReason":"session-not-running"}]`

A fresh supported recompute now returns `value=0`, and the same task now has a live running task-worker session. Because this triage environment has no safe runtime write path to resolve the alert row directly, the correct final operation is `waiting_with_evidence` until the next metrics snapshot reconciles the already-healthy live state.

## Evidence checked

### 1. Persisted breach source was a single stale-active task

Latest snapshot note for this metric reported exactly one contributor:

- task id: `verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607090641`
- session id: `s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607090641`
- restart reason: `session-not-running`
- `assignmentMismatchKeys=[]`
- `recoveryUnownedSpecIds=[]`

So the breach came from transient stale-active accounting rather than an ownerless spec-recovery gap or assignment mismatch.

### 2. Current runtime task tree still owns the task

`bun run task-tree show verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607090641` now shows:

- `state: "active"`
- `owner: "aks-explorer"`
- `session_id: "s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607090641"`
- `trace.worker_started_at: "2026-07-09T06:48:50.886Z"`

So the unfinished work is not ownerless in current runtime state.

### 3. Current runtime session is live again

Runtime `sessions` query for task text matching this task id now shows:

- `sessionId = s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607090641`
- `status = running`
- `source = workflow:task-worker`
- `opCount = 5`
- fresh `lastActivityAt`

That directly contradicts the stale snapshot classification and shows the original sampled gap has already healed.

### 4. Fresh supported recompute is healthy

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

Observed result:

```json
{"measuredAt":1783579698257,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-09T06:48:18.371Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

## Why `waiting_with_evidence`

- **Not `fix_root_cause`**: there is no current unowned task to repair; the sampled task already has owner and live worker session.
- **Not `resolve_stale`**: this environment does not provide a safe runtime write path to resolve the alert row manually.
- **Not `calibrate_metric`**: the metric usefully detected a transient stale-active condition; threshold `0` is still correct.
- **Not `upgrade_or_escalate`**: no destructive action or human-only decision is needed because live state is already healthy.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.unowned-work-count`. Recovery is confirmed when persisted `metrics.current` updates from `1` to `0` and alert `3238` resolves automatically. If a fresh recompute returns `>0` again, reopen only with the exact contributor ids from the new snapshot note.
