# Metric alert triage — `aks-rp-e2e.process.blocked.missing-waiting-for-count` (alert 3189)

- Alert id: `3189`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Triaged at: `2026-07-08T19:17Z`
- Chosen operation: `upgrade_or_escalate`
- Escalation task: `ops-escalate-blocked-missing-waiting-parity-20260708-alert3189`

## Judgment

This alert is not safely closable by another blind blocked-task repair. A fresh recompute before repair returned `value=1` and named one current offender (`wait-spec-storage-csi-blob-fuse2-clone-current-origin-dev-rerun-auth-surface-20260708`). The supported dry-run repair path agreed that this exact task was repairable. But after applying the supported repair path, a fresh recompute returned `value=2` and named:

- `wait-spec-storage-csi-blob-fuse2-clone-current-origin-dev-rerun-auth-surface-20260708`
- `hold-compact-fleet-hubless-rpapi-lifecycle-version-readback-frontier-20260708b`

The live task-tree readback now shows a mixed contradiction:

1. `wait-spec-storage-csi-blob-fuse2-clone-current-origin-dev-rerun-auth-surface-20260708` is still blocked and still lacks a machine-readable `blocker.waiting_for` object, so there is at least one real blocked-contract defect remaining.
2. `hold-compact-fleet-hubless-rpapi-lifecycle-version-readback-frontier-20260708b` was rewritten into `blocked` state by the safe repair path and now does contain `blocker.waiting_for`, `observed_by`, and `observation_method`, but the metric sampler still counts it as missing `waiting_for`.

Because the safe owner repair path is exhausted and the metric sampler (`scripts/project-metrics.ts` -> `taskCounts().blockedMissingWaitingFor`) now contradicts at least one repaired runtime task, the correct final operation is `upgrade_or_escalate`.

## Evidence checked

### 1) Fresh recompute before repair

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result:

```json
{"measuredAt":1783538168138,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"offenderTaskIds\":[\"wait-spec-storage-csi-blob-fuse2-clone-current-origin-dev-rerun-auth-surface-20260708\"]}"}
```

### 2) Supported repair dry run before mutation

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts --dry-run
```

Observed result:

```json
{
  "dryRun": true,
  "treePath": "/app/projects/aks-rp-e2e.app/.state/tasks/tree.json",
  "repairedCount": 1,
  "repaired": [
    "wait-spec-storage-csi-blob-fuse2-clone-current-origin-dev-rerun-auth-surface-20260708"
  ]
}
```

### 3) Supported repair applied, but metric contradiction worsened

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts
```

Observed result:

```json
{
  "dryRun": false,
  "treePath": "/app/projects/aks-rp-e2e.app/.state/tasks/tree.json",
  "repairedCount": 2,
  "repaired": [
    "wait-spec-storage-csi-blob-fuse2-clone-current-origin-dev-rerun-auth-surface-20260708",
    "hold-compact-fleet-hubless-rpapi-lifecycle-version-readback-frontier-20260708b"
  ]
}
```

Follow-up recompute immediately after repair:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result:

```json
{"measuredAt":1783538187389,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":2,"sampleSize":2,"note":"{\"offenderTaskIds\":[\"wait-spec-storage-csi-blob-fuse2-clone-current-origin-dev-rerun-auth-surface-20260708\",\"hold-compact-fleet-hubless-rpapi-lifecycle-version-readback-frontier-20260708b\"]}"}
```

### 4) Live task-tree readback shows mixed real defect plus sampler contradiction

`wait-spec-storage-csi-blob-fuse2-clone-current-origin-dev-rerun-auth-surface-20260708` still shows a `blocker` with condition/owner/timestamps but no `waiting_for` field.

`hold-compact-fleet-hubless-rpapi-lifecycle-version-readback-frontier-20260708b` now shows:

- `state = blocked`
- `blocker.waiting_for.type = evidence.available`
- `blocker.waiting_for.taskId = hold-compact-fleet-hubless-rpapi-lifecycle-version-readback-frontier-20260708b`
- `blocker.observed_by.workflow = project-planner`
- `blocker.observation_method = Scheduled blocked-frontier app-ops review ...`
- `trace.blocked_contract_repaired_at = 2026-07-08T19:16:26.321Z`

Yet the same follow-up metric sample still counts that repaired holder as missing `waiting_for`.

### 5) Metric implementation path checked

`projects/aks-rp-e2e.app/scripts/project-metrics.ts` computes this alert through:

- `taskCounts()`
- `blockedLeafTasks = tasks.filter(isLeaf && taskState(task) === "blocked")`
- `blockedMissingWaitingForTaskIds = blockedLeafTasks.flatMap(... !objectRecordField(blocker, ["waiting_for", "waitingFor"]) ... )`

So the code path is supposed to stop counting a blocked leaf once `blocker.waiting_for` exists. The repaired Fleet holder contradicts that intended behavior.

## Durable outcome

Created blocked ops escalation task:

- `ops-escalate-blocked-missing-waiting-parity-20260708-alert3189`

This task records the required human/maintainer decision, next validation check, and fallback if the contradiction remains.

## Decision needed

Human/app maintainer should decide one of:

1. whether planner/task-tree normalization must mutate the remaining blob-fuse2-clone holder into a machine-readable `waiting_for` contract via a supported path,
2. whether `scripts/project-metrics.ts` is sampling a stale/misclassified blocked holder after repair,
3. or whether another app-local repair path should be used before the next metrics refresh.

## Next validation

Validate on the next `metrics-snapshot` / owner recheck after the escalation task is reviewed. Recovery requires either:

- a fresh recompute returning `value=0`, or
- a maintainer-confirmed explanation plus a follow-up fix/calibration that makes the metric and runtime tree agree again.
