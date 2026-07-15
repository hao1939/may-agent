# Metric alert 3754 fix_root_cause — spec-loop represented-running accounting bug

- Metric: `aks-rp-e2e.process.loop.unrepresented-record-count`
- Alert: `3754`
- Investigated at: `2026-07-15T02:10Z`
- Owner judgment: `fix_root_cause`

## What was measured

The open alert and metric row still showed a live breach in the runtime DB:

```json
{
  "metric": {
    "id": "aks-rp-e2e.process.loop.unrepresented-record-count",
    "current": 1,
    "target": 0,
    "threshold": 0,
    "priority": "P0",
    "updated_at": 1784081025670
  },
  "alert": {
    "id": 3754,
    "resolved_at": null,
    "created_at": 1784080116266
  }
}
```

The recomputed metric sample from `bun ./scripts/project-metrics.ts aks-rp-e2e.process.loop.unrepresented-record-count --json` no longer agreed with that persisted row and returned:

```json
{"measuredAt":1784081236613,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"taskIds\":[],\"records\":[]}"}
```

## Root cause

The remaining `1` was not a missing live holder. It was a spec-loop accounting bug.

Current live spec-loop state shows one running spec row:

```json
{
  "specId": "spec.storage-csi.file-verify-nfs",
  "status": "running",
  "taskId": "verify-spec-storage-csi-file-verify-nfs-retry-202607150148-1",
  "activeWorkflowRunId": "172274962"
}
```

Current live task-tree state shows that same spec is already represented by an active verifier child under `aks-spec-verification-loop`:

```json
{
  "taskId": "verify-spec-storage-csi-file-verify-nfs-retry-202607150148-1",
  "state": "active",
  "workflow": "single-spec-verifier",
  "conflict_scope": [
    "spec:spec.storage-csi.file-verify-nfs"
  ]
}
```

Before the code fix, `workflows/spec-loop-controller.ts` computed:

```ts
const unrepresentedNonTerminalCount =
  dispatchablePending + residueRunning + done + unrepresentedGroupedResidue;
```

That formula counted **all** running rows as unrepresented even when the running spec already had an exact active verifier child. This contradicts the spec-loop design contract that a live verifier child is valid representation.

## Fix applied

1. Updated `workflows/spec-loop-controller.ts` so only **unrepresented** directly-runnable pending, running, done, and grouped-residue rows contribute to `unrepresentedNonTerminalCount`.
2. Strengthened `workflows/spec-loop-controller.test.ts` so the existing “syncs only valid spec-loop children into progress” scenario now asserts `unrepresentedNonTerminalCount: 0` when the only running rows are already represented by active verifier children.

## Validation after fix

The live task tree already reflects healthy controller-visible progress for `aks-spec-verification-loop`:

```json
{
  "unrepresentedNonTerminalCount": 0,
  "running": 1,
  "residueRunning": 1,
  "activeChildren": 1,
  "openSpecVerifierChildren": 1,
  "updatedAt": "2026-07-15T02:06:48.684Z"
}
```

That is consistent with the recomputed metric sample of `value=0` and inconsistent with the stale persisted metric row of `current=1`.

## Expected closure chain

The code-side root cause is fixed. The next normal metrics snapshot should update `metrics.current` from `1` to `0` and then clear alert `3754` without reopening this represented-running false positive.
