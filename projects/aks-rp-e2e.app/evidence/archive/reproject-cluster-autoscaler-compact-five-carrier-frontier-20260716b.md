# App apply — reproject cluster-autoscaler compact five-carrier frontier state repair (2026-07-16)

- Task: `ops-apply-reproject-cluster-autoscaler-compact-five-carrier-frontier-20260716b-state-repair`
- Attempt: `a_ops-apply-reproject-cluster-autoscaler-compact-five-carrier-frontier-20260716b-state-repair_20260716151304`
- Applied at: `2026-07-16T15:17:21.475Z`
- App holder: `hold-compact-cluster-autoscaler-five-carrier-frontier-20260714`
- Feature row: `cluster-autoscaler` in `.state/feature-compact-loop/state.json`

## Authority used

- Reviewed domain memo: `/app/projects/aks-rp-e2e/evidence/archive/reproject-cluster-autoscaler-compact-five-carrier-frontier-20260716b.md`
- Prior app evidence pointer: `evidence/archive/ops-apply-reconcile-cluster-autoscaler-compact-frontier-lineage-20260714.md`
- Supported mechanisms: `readTaskTree(... )` + `withTreeLock(... )` + `saveTaskTreeWithKanbanSnapshot(... )`, plus `loadFeatureCompactLoopState(... )` + `updateFeatureCompactItem(... )` + `saveFeatureCompactLoopState(... )`

## Baseline before apply

- holder state: `blocked`
- holder context.reviewEvidencePath before: "evidence/archive/ops-apply-reconcile-cluster-autoscaler-compact-frontier-lineage-20260714.md"
- holder blocker.next_check_at before: "2026-07-16T15:18:23.391Z"
- holder blocker.fallback_at before: "2026-07-16T20:40:00Z"
- feature reviewEvidencePath before: "evidence/archive/ops-apply-reconcile-cluster-autoscaler-compact-frontier-lineage-20260714.md"
- feature nextCheckAt before: "2026-07-16T15:18:23.391Z"
- feature fallbackAt before: "2026-07-16T20:40:00Z"
- retired review leaf live before apply: `false`

## Exact preserved frontier

- `wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708`
- `wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708`
- `hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708`
- `hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708`
- `hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709`

Carrier watch windows consulted from live task-tree before apply:

```json
[
  {
    "taskId": "wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708",
    "state": "blocked",
    "next_check_at": "2026-07-16T18:00:00Z",
    "fallback_at": "2026-07-17T18:00:00Z"
  },
  {
    "taskId": "wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708",
    "state": "blocked",
    "next_check_at": "2026-07-16T18:00:00Z",
    "fallback_at": "2026-07-17T18:00:00Z"
  },
  {
    "taskId": "hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708",
    "state": "blocked",
    "next_check_at": "2026-07-16T18:00:00Z",
    "fallback_at": "2026-07-17T18:00:00Z"
  },
  {
    "taskId": "hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708",
    "state": "blocked",
    "next_check_at": "2026-07-16T20:40:00Z",
    "fallback_at": "2026-07-16T20:40:00Z"
  },
  {
    "taskId": "hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709",
    "state": "blocked",
    "next_check_at": "2026-07-16T18:00:00Z",
    "fallback_at": "2026-07-17T18:00:00Z"
  }
]
```

## Applied repair

1. Preserved `hold-compact-cluster-autoscaler-five-carrier-frontier-20260714` as the same blocked compact-facing holder over the same exact five represented carrier ids.
2. Updated `hold-compact-cluster-autoscaler-five-carrier-frontier-20260714.context.reviewEvidencePath` to `evidence/archive/reproject-cluster-autoscaler-compact-five-carrier-frontier-20260716b.md` without reviving `ops/review-2240-cluster-autoscaler-compact-frontier-lineage-20260713`.
3. Refreshed `hold-compact-cluster-autoscaler-five-carrier-frontier-20260714.blocker.next_check_at` to `2026-07-16T18:00:00Z` and `hold-compact-cluster-autoscaler-five-carrier-frontier-20260714.blocker.fallback_at` to `2026-07-16T20:40:00Z`, matching the memo-derived carrier windows.
4. Rewrote the app-owned `cluster-autoscaler` compact row so `reviewEvidencePath`, `nextCheckAt`, and `fallbackAt` now match the live holder.

## Verification after apply

### Holder after

```json
{
  "state": "blocked",
  "context": {
    "reviewEvidencePath": "evidence/archive/reproject-cluster-autoscaler-compact-five-carrier-frontier-20260716b.md",
    "compactFrontierTaskIds": [
      "wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708",
      "wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708",
      "hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708",
      "hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708",
      "hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709"
    ]
  },
  "blocker": {
    "next_check_at": "2026-07-16T18:00:00Z",
    "fallback_at": "2026-07-16T20:40:00Z",
    "waiting_for": {
      "type": "compact.frontier.changed",
      "taskId": "hold-compact-cluster-autoscaler-five-carrier-frontier-20260714",
      "featureKey": "cluster-autoscaler",
      "target": "staging",
      "errorClass": "package-partial",
      "scope": "feature-compact",
      "frontierTaskIds": [
        "wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708",
        "wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708",
        "hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708",
        "hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708",
        "hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709"
      ]
    }
  },
  "result": "a_ops-apply-reproject-cluster-autoscaler-compact-five-carrier-frontier-20260716b-state-repair_20260716151304: refreshed hold-compact-cluster-autoscaler-five-carrier-frontier-20260714 in place so current app-owned proof points at evidence/archive/reproject-cluster-autoscaler-compact-five-carrier-frontier-20260716b.md and the holder/feature watch window now matches the represented five-carrier frontier (2026-07-16T18:00:00Z / 2026-07-16T20:40:00Z) without reviving ops/review-2240-cluster-autoscaler-compact-frontier-lineage-20260713 or broadening the rerun surface."
}
```

### Feature row after

```json
{
  "taskId": "hold-compact-cluster-autoscaler-five-carrier-frontier-20260714",
  "frontierTaskIds": [
    "wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708",
    "wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708",
    "hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708",
    "hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708",
    "hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709"
  ],
  "reviewEvidencePath": "evidence/archive/reproject-cluster-autoscaler-compact-five-carrier-frontier-20260716b.md",
  "nextCheckAt": "2026-07-16T18:00:00Z",
  "fallbackAt": "2026-07-16T20:40:00Z",
  "lastCheckedAt": "2026-07-16T15:17:21.475Z"
}
```

## Acceptance check

- App-owned task-tree or loop-state repair applied through supported app mechanisms: satisfied.
- Affected branch records the exact restored holder/state pointer/refreshed wait with evidence: satisfied via the live holder readback, the updated cluster-autoscaler compact row, and this memo at `evidence/archive/reproject-cluster-autoscaler-compact-five-carrier-frontier-20260716b.md`.
