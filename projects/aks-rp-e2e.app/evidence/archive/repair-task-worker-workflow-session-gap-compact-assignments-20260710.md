# Repair task-worker workflow session gap for compact assignments — 2026-07-10

## Scope
- Task: `ops/repair-task-worker-workflow-session-gap-compact-assignments-20260710`
- Target workflow runs:
  - `wr_1783696574683_3u2c` (`compact-feature-cluster-autoscaler`)
  - `wr_1783696574622_4egf` (`compact-feature-net-integration`)
- Metric: `aks-rp-e2e.process.unowned-work-count`

## Runtime diagnosis
Read-only DB inspection showed both target rows still present in `workflow_runs` as `workflow=task-worker`, `status=running`, and with embedded `project.task.assigned` trigger payloads naming the compact feature task ids. The corresponding `sessions` query returned zero rows for those run ids or task ids.

That combination looked like lost ownership at first, but code inspection showed the real shape is different:
- `workflows/feature-compact-planner.ts` is an inline app workflow and does **not** create an agent session row.
- `scripts/project-metrics.ts` already treats `feature-compact-planner` tasks as healthy when feature-compact loop state has a fresh `heartbeatAt` or `activeWorkflowRunId`.
- The false positive came from `staleRunningWorkflowRunDetails()`, which previously counted any running `workflow_runs` row with zero joined `sessions` rows as `workflow-no-session`, even when the wrapped assignment belonged to a healthy inline compact workflow.

So the exact gap was not "compact worker failed to start a truthful session"; it was metric accounting that treated the outer `task-worker` wrapper as unowned despite healthy ownership being represented in compact-loop state.

## Smallest truthful repair
Updated `scripts/project-metrics.ts` so `staleRunningWorkflowRunDetails()` now:
1. reads the `workflow_runs.task` trigger payload,
2. extracts the assigned task id with `parseTriggerEvent()` / `triggerString()`,
3. loads the active task from the task tree, and
4. suppresses the `workflow-no-session` contributor when `activeTaskRestartReason(task) === null`.

This keeps the old behavior for genuinely orphaned running workflow rows, but excludes the wrapper rows for healthy inline loop-owned compact work.

## Tests and verification
- Added regression coverage in `scripts/project-metrics.test.ts`:
  - preserved the existing orphan workflow-row test;
  - added a new case proving a running `task-worker` row with no session is **not** counted when its assigned `feature-compact-planner` task still has healthy compact-loop ownership.
- `bun test scripts/project-metrics.test.ts --runInBand` passed (`45 pass, 0 fail`).
- Direct recompute after the code change:

```json
{"measuredAt":1783697975234,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-10T15:39:35.621Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

That recompute confirms the compact assignments are no longer counted as unowned when ownership is already intact through compact-loop state.

## Planner/app-ops follow-up note
The persisted `metrics.current` row may remain stale until the next metrics snapshot updates the DB, but the metric source command now computes the truthful value (`0`) and no longer reports these compact assignments as unowned.
