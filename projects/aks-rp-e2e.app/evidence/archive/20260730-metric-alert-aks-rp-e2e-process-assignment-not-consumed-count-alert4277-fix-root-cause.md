# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.assignment.not-consumed-count`

- Alert id: `4277`
- Metric id: `aks-rp-e2e.process.assignment.not-consumed-count`
- Judged at: `2026-07-29T23:48:08Z`
- Chosen operation: `fix_root_cause`

## Judgment

Choose `fix_root_cause` because the live metric breach was being caused by `scripts/project-metrics.ts` treating workflow-owned assignments as unconsumed whenever a running `workflow_runs` row had not yet produced a child `sessions` row. During this alert, both contributors had already advanced into workflow execution state, but the metric still counted them because `activeWorkflowTaskSessionRow()` returned a bare workflow row without `status/startedAt` fields that `sessionRestartReasonFromRow()` can recognize as healthy.

## Evidence checked

### Persisted alert was still open

Runtime `metric_alerts` row remained open for alert `4277` and the metric row still showed a breach before the patch:

- `metrics.current = 1` at `updated_at = 1785387105515`
- latest persisted snapshot note listed `domain/normalize-plain-scenario-carrier-net-integration-tests-net-integration-multinic-mixed.ts-048177b1`
- alert `4277` had `resolved_at = null`

### Live recompute before the fix showed false-positive contributors

Before patching, the live metric source returned two queued assignments:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.assignment.not-consumed-count --json
```

Observed result before the fix:

```json
{"measuredAt":1785387247061,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":2,"sampleSize":2,"note":"{\"assignments\":[{\"taskId\":\"domain/normalize-plain-scenario-carrier-net-integration-tests-net-integration-multinic-mixed.ts-048177b1\",\"attemptId\":\"r_1_1c27ccf5-0bba-4049-9330-712c3074b01b\",\"assignedAt\":\"2026-07-30T04:46:23.472Z\",\"taskState\":\"active\"},{\"taskId\":\"scenario-normalization\",\"attemptId\":\"r_24_32f34fa7-3dc3-4156-be0e-fa12adbb4e8b\",\"assignedAt\":\"2026-07-30T04:48:11.020Z\",\"taskState\":\"active\"}]}"}
```

But direct runtime inspection showed those tasks already had active workflow execution evidence:

- `workflow_runs.runId = wr_1785387130184_m4wt` for the net-integration task was `status = running`
- `sessions.workflowRunId = wr_1785387130184_m4wt` already had a running `aks-explorer` session once the review worker spun up
- `workflow_runs.runId = wr_1785387296480_88ah` for `scenario-normalization` was also `status = running`, even though it still had no child `sessions` row

That combination proved the metric logic was undercounting workflow liveness rather than detecting a fresh owner-action gap.

## Root-cause fix applied

Patched `scripts/project-metrics.ts` so `activeWorkflowTaskSessionRow()` normalizes a running `workflow_runs` row into a liveness row with `status`, `startedAt`, and `lastActivityAt` even when no child `sessions` row exists yet.

Concrete code change:

- added exported helper `normalizeWorkflowTaskLivenessRow()`
- selected `workflowStartedAt` and `workflowEndedAt` from `workflow_runs`
- returned a synthesized running liveness row when the workflow run exists but the child session row is absent

Added regression coverage in `scripts/project-metrics.test.ts` for:

1. a running workflow run without a child session row, and
2. preserving the concrete child session row when it does exist.

## Verification after the fix

Regression tests passed:

```bash
cd /app/projects/aks-rp-e2e.app && bun test scripts/project-metrics.test.ts
```

Observed result:

- `10 pass`
- `0 fail`

Live metric recompute after the patch returned healthy:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.assignment.not-consumed-count --json
```

Observed result after the fix:

```json
{"measuredAt":1785387566897,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"assignments\":[]}"}
```

## Next validation signal

Wait for the next normal `metrics-snapshot` refresh to persist `metrics.current = 0` and auto-resolve alert `4277`.
