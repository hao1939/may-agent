# Metric alert triage — aks-rp-e2e.process.unowned-work-count (alert 3177)

- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Alert id: `3177`
- Chosen operation: `fix_root_cause`
- Reviewed at: `2026-07-08T17:47:17Z`

## Judgment

The breach was real in the runtime task tree, not a stale alert row.

The latest metric sample and a fresh local recompute both reported:

- `value=1`
- `recoveryUnownedSpecIds=["spec.bootstrap-profile-byo-acr.cache-direct-cache-switch"]`
- no stale active task ids
- no assignment mismatch contributors

The spec-loop state still marked `spec.bootstrap-profile-byo-acr.cache-direct-cache-switch` as retry-drained pending with successor/review metadata, but the runtime task tree under `.state/tasks/tree.json` had no open representing holder for either:

- `spec-loop-followup:pending:bootstrap-profile-byo-acr`, or
- `spec:spec.bootstrap-profile-byo-acr.cache-direct-cache-switch`

So the metric was correctly signaling a missing runtime ownership surface.

## Root cause

Runtime task-tree drift: the committed source tree still documented a blocked bootstrap-profile BYO ACR holder, but the live runtime tree used by `scripts/project-metrics.ts` no longer had an active/blocked/backlog/review/waiting task representing that retry-drained spec.

## Concrete repair applied

Recreated the missing blocked holder in the runtime task tree with task id:

- `hold-spec-loop-pending-bootstrap-profile-byo-acr-contradiction-20260704`

The recreated holder now carries:

- family scope `spec-loop-followup:pending:bootstrap-profile-byo-acr`
- exact spec scope `spec:spec.bootstrap-profile-byo-acr.cache-direct-cache-switch`
- owner `aks-explorer`
- structured blocked contract with resume/fallback/check fields

## Validation

After recreating the holder, rerun:

`bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json`

Expected validation result on the next sample:

- `value=0`
- `recoveryUnownedSpecIds=[]`

If a future sample still reports this spec as unowned, reopen as metric/runtime parity drift with the exact runtime tree path and spec-loop row.