# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.unowned-work-count`

- Alert id: `4140`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Operation: `fix_root_cause`
- Date: `2026-07-18`

## Baseline evidence

Direct sampler output before the patch showed a false-positive contributor even though the task-worker session was live:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

```json
{"measuredAt":1784407219934,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"sampledAt\":\"2026-07-18T20:40:19.992Z\",\"staleActiveTaskIds\":[\"runtime/task-execution/ops-refresh-rp-nodepool-publication-holder-after-next14-20260718-1af915b75ff542a4\"],\"staleActiveTaskSessions\":[{\"taskId\":\"runtime/task-execution/ops-refresh-rp-nodepool-publication-holder-after-next14-20260718-1af915b75ff542a4\",\"sessionId\":null,\"restartReason\":\"missing-session\"}],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

Live task-tree/runtime evidence for that contributor showed the wrapper had no top-level `session_id`, but its reconciliation trigger carried a real task-worker `sessionId`:

- wrapper task: `runtime/task-execution/ops-refresh-rp-nodepool-publication-holder-after-next14-20260718-1af915b75ff542a4`
- trigger session id: `s_task_ops_refresh-rp-nodepool-publication-holder-after-next14-20260718_nodepool-publication-holder-after-next14-20260718_20260718203418`
- matching runtime `sessions` row: `status=running`, `source=workflow:task-worker`, `workflowRunId=wr_1784406947843_vx47`

## Root cause

`project-metrics.ts` only looked at `task.session_id` when judging active-task liveness and when emitting stale-active contributor details. Runtime `task-execution` wrappers can omit top-level `session_id` and only expose the worker session through `trace.reconciliation.trigger.sessionId`, so healthy active work was misclassified as `missing-session`.

## Change applied

Patched `scripts/project-metrics.ts` to:

1. derive active-task session ids from `trace.reconciliation.trigger.sessionId/session_id` when top-level `session_id` is absent; and
2. reuse that derived session id when reporting stale-active contributors.

Added regression coverage in `scripts/project-metrics.test.ts` proving a runtime task wrapper with only trigger-carried session identity is not counted as stale-active or unowned work.

## Verification

### Tests

```bash
cd /app/projects/aks-rp-e2e.app && bun test ./scripts/project-metrics.test.ts
```

Result: `77 pass, 0 fail`.

### Post-fix sample

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

```json
{"measuredAt":1784407331629,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-18T20:42:11.710Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

## Next validation

Confirm the next persisted `metrics-snapshot` updates `metrics.current` for `aks-rp-e2e.process.unowned-work-count` from the stale alerting value to `0` and allows alert recovery to proceed normally.
