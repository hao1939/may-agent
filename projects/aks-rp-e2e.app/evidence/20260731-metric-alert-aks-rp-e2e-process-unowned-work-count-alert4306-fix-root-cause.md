# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.unowned-work-count`

- Alert id: `4306`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Owner: `app-ops`
- Priority: `P0`
- Judged at: `2026-07-31T15:47:07Z`
- Chosen operation: `fix_root_cause`

## Judgment

Alert `4306` came from a false-positive measurement path, not genuine unowned AKS work.

The breaching snapshot at `2026-07-31T15:32:54.936Z` counted one `staleWorkflowRuns` contributor:

- `runId = wr_1785511487878_3rys`
- `workflow = master-validation-cycle`
- `restartReason = workflow-no-session`

Read-only runtime inspection showed that workflow run never created a child `sessions` row, but it still completed normally as a control-plane workflow:

- `workflow_runs.runId = wr_1785511487878_3rys`
- `workflow_runs.status = done`
- `workflow_runs.startedAt = 1785511487878`
- `workflow_runs.endedAt = 1785512042128`
- matching `events` recorded `workflow.started`, `workflow.completed`, `handler.workflow_dispatched`, and `project.task.reconciled`
- all those events carried `session_id = null`

That means the metric was treating a healthy workflow-backed reconciliation run as abandoned solely because it lacked a child session row.

## Root cause

`scripts/project-metrics.ts` still counted any long-running workflow run with zero joined sessions as `workflow-no-session` unless it matched an older `task-worker`-only exception. That was too narrow: direct workflow-backed task ownership such as `master-validation-cycle` can be healthy without a child session row, and `activeTaskRestartReason()` already knows how to treat those workflow-backed active tasks as owned.

## Repair applied

Updated `scripts/project-metrics.ts` so stale workflow-run detection now:

1. extracts the referenced task id from either a workflow trigger payload or the embedded reconciliation-task JSON,
2. looks up the active task in the live task tree, and
3. suppresses `workflow-no-session` when that task is still active and `activeTaskRestartReason(task) === null`.

This keeps the old behavior for genuinely orphaned workflow rows, but stops counting healthy direct workflow-backed task ownership as unowned work.

## Verification

### Historical breach evidence

Recent stored snapshots for `aks-rp-e2e.process.unowned-work-count` show:

- snapshot `1625139` at `1785511970911` recorded `value = 1` with note payload naming only `wr_1785511487878_3rys`
- later snapshots `1625231` and `1625323` recorded `value = 0`, proving the alert was transient even before the code fix reached this session

### Code verification

```bash
cd /app/projects/aks-rp-e2e.app && bun test scripts/project-metrics.test.ts --timeout 30000
```

Result: `29 pass, 0 fail`.

The new regression coverage proves a direct workflow-backed active task is treated as owned even before a child session row exists, while inactive/stale tasks still fail the check.

### Live metric recompute

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

Result:

```json
{"measuredAt":1785512825813,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-31T15:47:07.903Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

The persisted metric row also already reads `current = 0`, `threshold = 0`, `target = 0`, and `updated_at = 1785512710314`.

## Next validation

Validate on the next `metrics-snapshot` cycle for `aks-rp-e2e.process.unowned-work-count`.

Expected result:

- direct workflow-backed runs without child session rows no longer create transient `workflow-no-session` contributors when the task still has healthy workflow ownership, and
- the metric remains `0` unless a genuinely stale active task, assignment mismatch, or recovery gap appears.
