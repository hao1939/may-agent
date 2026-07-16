# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.unowned-work-count`

- Alert id: `3968`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Owner: `app-ops`
- Priority: `P0`
- Judged at: `2026-07-16T17:17:30Z`
- Chosen operation: `fix_root_cause`

## Why this was a real breach

A fresh local recompute at triage time still reproduced the breach and named one exact stale contributor:

```json
{"measuredAt":1784222145026,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"sampledAt\":\"2026-07-16T17:15:45.198Z\",\"staleActiveTaskIds\":[\"ops/repair-shared-ado-same-run-stall-family-normalization-20260716\"],\"staleActiveTaskSessions\":[{\"taskId\":\"ops/repair-shared-ado-same-run-stall-family-normalization-20260716\",\"sessionId\":\"s_task_ops_repair-shared-ado-same-run-stall-family-normalization-20260716_-ado-same-run-stall-family-normalization-20260716_20260716164810\",\"restartReason\":\"session-not-running\"}],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

`bun run task-tree show ops/repair-shared-ado-same-run-stall-family-normalization-20260716` confirmed the contributor was still marked `state = active` with the same old attempt/session pair:

- `trace.current_attempt_id = a_ops_repair-shared-ado-same-run-stall-family-normalization-20260716_20260716164810`
- `session_id = s_task_ops_repair-shared-ado-same-run-stall-family-normalization-20260716_-ado-same-run-stall-family-normalization-20260716_20260716164810`
- runtime `sessions` had no matching live row for that `session_id`

That made this a real process gap: the task tree still claimed active ownership, but the bound worker session no longer existed.

## Concrete repair applied

I used the supported control-plane repair command to reclaim the stale active slot and require a fresh session:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree requeue-active ops/repair-shared-ado-same-run-stall-family-normalization-20260716 --reason "metric-alert unowned-work-count alert3968: task session missing/not-running; reclaim stale active slot for truthful fresh app-ops worker session" --fresh-session
```

The command returned the repaired task id:

```json
["ops/repair-shared-ado-same-run-stall-family-normalization-20260716"]
```

Immediately after the repair, task-tree state recorded the exact stale-active recovery metadata:

- `trace.stale_active_requeued_at = 2026-07-16T17:16:10.961Z`
- `trace.previous_attempt_id = a_ops_repair-shared-ado-same-run-stall-family-normalization-20260716_20260716164810`
- `trace.previous_session_id = s_task_ops_repair-shared-ado-same-run-stall-family-normalization-20260716_-ado-same-run-stall-family-normalization-20260716_20260716164810`
- `trace.stale_active_fresh_session = true`

## Post-fix validation

The first recompute after the requeue no longer reported the stale-active task. A brief planner transition exposed a different assignment-mismatch contributor for `domain/repair-rp-preflight-validation-refined-contract-20260716`, and task-tree inspection showed the planner was already re-promoting that task to a fresh attempt at the same time.

A second recompute after the planner finished that promotion returned a clean result:

```json
{"measuredAt":1784222206087,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-16T17:16:46.220Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

So the underlying unowned-work condition is now repaired in live state. The persisted metric row still shows `current = 1` from the older sample and needs the next snapshot cycle to catch up.

## Next validation signal

Use the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.unowned-work-count`. Recovery is confirmed when the persisted `metrics.current` row updates from `1` to `0` and alert `3968` auto-recovers.
