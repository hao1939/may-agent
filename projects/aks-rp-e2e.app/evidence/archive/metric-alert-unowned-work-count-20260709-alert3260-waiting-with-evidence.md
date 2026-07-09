# Metric alert triage — `aks-rp-e2e.process.unowned-work-count` — alert `3260`

- Judged at: `2026-07-09T08:37:30Z`
- Chosen operation: `waiting_with_evidence`
- Metric owner: `app-ops`

## Judgment

This alert reflects transient stale-active attribution rather than current ownerless work.
The persisted metric row and open alert still show a breach from snapshot `2026-07-09T08:33:52Z`, but a fresh supported recompute now returns `value=0` with empty contributor arrays, and the previously cited stale-active task session has already completed. Because this triage environment has no safe runtime write path to resolve the alert row directly, the correct final operation is `waiting_with_evidence` until the next metrics snapshot reconciles the already-healthy live state.

## Evidence checked

### 1. Persisted metric row and alert are still open from the last sampled breach

Runtime DB at triage time:

- metric `aks-rp-e2e.process.unowned-work-count`: `current=2`, `threshold=0`, `target=0`, `priority=P0`, `updated_at=1783586032792`
- alert `3260`: `resolved_at=NULL`

Latest stored snapshot note at `2026-07-09T08:33:52.918Z` reported exactly two stale-active contributors and no other contributor classes:

- `staleActiveTaskIds=["verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607090822","repair-spec-network-cni-vm-prerelease-calico-eno-row191-expectation-model-carrier-20260709c"]`
- `assignmentMismatchKeys=[]`
- `recoveryUnownedSpecIds=[]`

So the persisted breach is coming from stale-active accounting, not current assignment mismatches or recovery-unowned specs.

### 2. The cited Fleet stale-active task already recovered to a finished worker session

Runtime `sessions` now show:

- `s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607090822`
- agent: `aks-explorer`
- source: `workflow:task-worker`
- status: `done`
- endedAt: `1783586181283`

This matches the earlier stale-active contributor id from the snapshot note, showing that the cited unfinished work is no longer stuck without a live owner session.

### 3. Fresh supported recompute is already healthy

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

Observed result:

```json
{"measuredAt":1783586194900,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-09T08:36:34.947Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

That directly proves the live project state is healthy even though the persisted metric row and alert row have not refreshed yet.

## Why `waiting_with_evidence`

- **Not `fix_root_cause`**: the current live recompute is already `0`; there is no remaining unowned-work contributor to repair from this session.
- **Not `resolve_stale`**: this environment provides read-only DB access only, so there is no safe runtime write path here to manually resolve alert `3260`.
- **Not `calibrate_metric`**: the metric correctly surfaced a transient stale-active condition, and threshold `0` remains appropriate.
- **Not `upgrade_or_escalate`**: no destructive action, human-only policy decision, or unresolved integrity contradiction remains after the fresh recompute.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.unowned-work-count`. Recovery is confirmed when persisted `metrics.current` updates from `2` to `0` and alert `3260` resolves automatically. If a fresh recompute returns `>0` again, reopen only with the exact contributor ids from the new snapshot note.
