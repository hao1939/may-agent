# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3676)

## Chosen operation

`waiting_with_evidence`

## Current breach check

The alert is still real, and the live source of truth is now **worse** than the persisted metric row:

- Runtime metric row still reports `current=2` at `updated_at=1784045029001`.
- Open alert row `3676` is unresolved and says `current=2`.
- Fresh recompute from `bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json` returned `{"value":3}`.
- `git status --porcelain=v1 --branch` in `/app/projects/aks-rp-e2e` showed no ahead commits but exactly three tracked unpublished files:
  - `features/kms-etcd-encryption/tests/kms-v2-public-cluster-public-kv.ts`
  - `features/kms-etcd-encryption/tests/kms-v2plus-create-cmk-custom-vnet.ts`
  - `features/kms-etcd-encryption/tests/kms-v2plus-create-cmk-public-kv-vnet-integration.ts`

So this is not a stale alert, not a calibration issue, and not yet fixed.

## Exact owner-visible waiting state

The planner has already materialized one exact active owner path for this breach:

- Active task: `ops/repair-unpublished-kms-working-tree-drift-20260714`
- State: `active`
- Owner: `app-ops`
- Goal: classify the current unpublished KMS test-file drift, decide whether the three edits are intentional domain work or stray residue, and leave one owning path that either routes the changes into exact follow-up work or restores pipeline-visible cleanliness.
- Running worker session: `s_task_ops_repair-unpublished-kms-working-tree-drift-20260714`
- Session row currently shows `status='running'`, `source='workflow:task-worker'`, `opCount=0`, and fresh `lastActivityAt` immediately after assignment.

This means the breach is already represented by an exact active repair task rather than anonymous repo drift.

## Why waiting_with_evidence is the right judgment now

- Not `resolve_stale`: fresh recompute says `3`, so the breach is current.
- Not `calibrate_metric`: threshold `0` is still correct because unpublished domain-repo changes remain invisible to pipeline runs.
- Not `fix_root_cause`: app-ops should not checkpoint, revert, or publish unreviewed KMS domain test edits until the active repair task classifies whether they are intentional domain work or stray residue.
- Not `upgrade_or_escalate`: there is already an exact active owner path; this is not unowned, unsafe-only, or human-policy work yet.

## Next validation

Validate on the next `metrics-snapshot`, or sooner when `ops/repair-unpublished-kms-working-tree-drift-20260714` finishes.

Recovery is proven when either:

1. `/app/projects/aks-rp-e2e` returns to `git status --porcelain=v1 --branch` with no dirty paths and no `[ahead N]`, and the metric recomputes to `0`; or
2. the active repair task converts the remaining unpublished KMS files into a more exact active/review/blocked owner path with explicit affected files and next action.
