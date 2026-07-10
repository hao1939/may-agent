# Ops rebind network-cni pending-family frontier — 2026-07-10

Task: `ops/rebind-network-cni-pending-family-frontier-20260710`
Attempt: `a_ops_rebind-network-cni-pending-family-frontier-20260710_20260710000741`
Mode: Task Worker Mode / planner-app-ops repair packet only

## Result

The app-owned `pending:network-cni` frontier is still carrying stale bookkeeping from accepted review work that has already been reconciled at the evidence layer but not yet rebound into the live spec-loop/task-tree surfaces.

The stale shape is now precise:

- the old umbrella still behaves like a **21-member** network-cni family story;
- the current app spec-loop actually shows **20 pending `spec.network-cni.*` rows**;
- `spec.network-cni.cilium-stop-start` is the dropped 21st member because it is already normalized to **pass** and should no longer contribute to any pending-family accounting;
- two specs are still controlled by the obsolete same-run review holder;
- three retry-guarded specs still point at missing/stale task ids even though sharper rerun leaves now exist;
- one spec (`spec.network-cni.vm-prerelease-calico-eno-migration-matrix`) still has a truthful exact holder and should stay mapped as-is.

So the live family frontier should no longer be represented as one broad pending umbrella. It should be represented as exact surviving holders plus the now-sharper rerun/review leaves.

## Baseline contributor set before this repair task

Treating this audit task itself as nonexistent, the stale network-cni pending-family contributor set currently visible to the app is:

1. `review-network-cni-same-run-artifacts-wave-20260702`
   - still controls `spec.network-cni.acns-observability`
   - still controls `spec.network-cni.cilium-preview-upgrade`
2. `wait-spec-network-cni-azure-overlay-dual-stack-row94-live-surface-20260702`
   - still truthfully controls `spec.network-cni.azure-overlay-dual-stack`
3. `hold-spec-network-cni-source-check-only-frontier-20260708`
   - still broadly carries source-grounded / nonlive network-cni residue
4. `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
   - still truthfully controls the cilium-enterprise pair
5. stale or missing task-id bindings in spec-loop state:
   - `verify-spec-network-cni-azure-overlay-dual-stack-windows2022-successor-2`
   - `verify-spec-network-cni-azure-overlay-dual-stack-windows2025-successor-20260708`
   - `verify-spec-network-cni-azure-overlay-ilpip-dualstack-successor-20260708`
6. still-truthful exact holder:
   - `verify-spec-network-cni-vm-prerelease-calico-eno-migration-matrix`

That baseline is the mismatch source: accepted review findings have already changed the exact frontier, but the current app surfaces still carry old holders or stale task ids.

## Read-only evidence used

### Accepted review packets already on record

Accepted review work established these sharper truths:

- `evidence/archive/align-network-cni-pending-state-to-reviewed-frontier-20260709b.md`
  - proves the stale historical 21-member umbrella should now be treated as **20 current pending rows plus cilium-stop-start already pass**.
- `evidence/archive/review-network-cni-retry-guarded-pending-carriers-20260709b.md`
  - proves the three retry-guarded carriers now each warrant an exact bounded rerun instead of remaining under the stale family umbrella.
- accepted cilium-preview diagnosis (`domain/diagnose-spec-network-cni-cilium-preview-upgrade-preupgrade-connectivity-20260709`)
  - proves the old same-run review holder is stale and the next truthful step is a validating rerun blocked only by shared Azure DevOps auth/runtime capability wait `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b`.
- active rerun review for ILPIP dualstack (`domain/rerun-spec-network-cni-azure-overlay-ilpip-dualstack-current-head-20260710`)
  - already recorded durable evidence that repaired same-path ADO run `171365986` replaced the old `AKSEnableDualStack` blocker with a full live pass, but the rerun leaf is still in `review`, so app state should follow the review leaf until that pass is accepted.

### Current stale spec-loop row bindings

Current pending rows still show these app-owned stale bindings:

- `spec.network-cni.acns-observability`
  - `taskId=review-network-cni-same-run-artifacts-wave-20260702`
  - stale because reviewed ADO pass evidence already supersedes the same-run holder
- `spec.network-cni.cilium-preview-upgrade`
  - `taskId=review-network-cni-same-run-artifacts-wave-20260702`
  - stale because accepted diagnosis now points to the shared Azure DevOps auth/runtime wait, not the old same-run review holder
- `spec.network-cni.azure-overlay-dual-stack-windows2022`
  - `taskId=verify-spec-network-cni-azure-overlay-dual-stack-windows2022-successor-2`
  - stale/missing because the live sharper leaf is `domain/rerun-spec-network-cni-azure-overlay-dual-stack-windows2022-current-head-20260710`
- `spec.network-cni.azure-overlay-dual-stack-windows2025`
  - `taskId=verify-spec-network-cni-azure-overlay-dual-stack-windows2025-successor-20260708`
  - stale/missing because the live sharper leaf is `domain/rerun-spec-network-cni-azure-overlay-dual-stack-windows2025-current-head-20260710`
- `spec.network-cni.azure-overlay-ilpip-dualstack`
  - `taskId=verify-spec-network-cni-azure-overlay-ilpip-dualstack-successor-20260708`
  - stale because the live sharper leaf is `domain/rerun-spec-network-cni-azure-overlay-ilpip-dualstack-current-head-20260710` (currently in review with pass evidence)
- `spec.network-cni.vm-prerelease-calico-eno-migration-matrix`
  - `taskId=verify-spec-network-cni-vm-prerelease-calico-eno-migration-matrix`
  - this one is still truthful and should remain bound

## Exact surviving holder map the app should surface after rebinding

This is the post-repair represented set the planner/app-ops side should preserve.

### Keep unchanged exact holders

These already match the current frontier and should remain:

- `wait-spec-network-cni-azure-overlay-dual-stack-row94-live-surface-20260702`
  - exact row-94 nonlive/source-grounded wait for `spec.network-cni.azure-overlay-dual-stack`
- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
  - exact shared runtime-input wait for:
    - `spec.network-cni.cilium-enterprise-addon-lifecycle`
    - `spec.network-cni.cilium-enterprise-addon-vm-prerelease`
- `verify-spec-network-cni-vm-prerelease-calico-eno-migration-matrix`
  - exact residual row-191-pass / rows-192-196 frontier
- accepted reviewed-exception rows with `taskId=null` and exact structured successors
  - keep as-is; they do not need a new broad network-cni family carrier

### Replace stale same-run control

`review-network-cni-same-run-artifacts-wave-20260702` should no longer control any network-cni pending row.

Its two former members should now be represented as:

- `spec.network-cni.acns-observability`
  - remove stale same-run hold from controlling frontier
  - normalize to pass once the reviewed pass evidence is written back into app state
- `spec.network-cni.cilium-preview-upgrade`
  - remove stale same-run hold from controlling frontier
  - rebind to shared wait `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b` until the validating rerun can actually be dispatched

### Rebind stale/missing retry-guarded rows to their sharper rerun leaves

Replace the stale or missing task-id bindings with these exact live leaves:

- `spec.network-cni.azure-overlay-dual-stack-windows2022`
  - from: `verify-spec-network-cni-azure-overlay-dual-stack-windows2022-successor-2`
  - to: `domain/rerun-spec-network-cni-azure-overlay-dual-stack-windows2022-current-head-20260710`
- `spec.network-cni.azure-overlay-dual-stack-windows2025`
  - from: `verify-spec-network-cni-azure-overlay-dual-stack-windows2025-successor-20260708`
  - to: `domain/rerun-spec-network-cni-azure-overlay-dual-stack-windows2025-current-head-20260710`
- `spec.network-cni.azure-overlay-ilpip-dualstack`
  - from: `verify-spec-network-cni-azure-overlay-ilpip-dualstack-successor-20260708`
  - to: `domain/rerun-spec-network-cni-azure-overlay-ilpip-dualstack-current-head-20260710`

### Keep the nonlive/source-grounded family only as exact holders

Do not re-expand a generic network-cni umbrella around the nonlive rows.

The exact nonlive/source-grounded representation should stay on the sharper holds already present, especially:

- `hold-spec-network-cni-nonlive-source-grounded-frontier-20260709`
- `domain/hold-network-cni-nonlive-source-grounded-trio-20260709`
- `hold-spec-network-cni-source-check-only-frontier-20260708`

If one of these overlapping holders is later compacted, preserve the exact spec set and nonlive reason text; do not revert to a broad `pending:network-cni` family carrier.

## Assignment-state mismatch to remove

The assignment-state mismatch is:

- accepted review work has already retired the old 21-member family story,
- but app-visible spec-loop rows still point at stale historical holder ids or at missing task ids,
- while live sharper rerun leaves and shared waits already exist elsewhere in the tree.

The concrete mismatch-producing leftovers are:

- `review-network-cni-same-run-artifacts-wave-20260702`
- `verify-spec-network-cni-azure-overlay-dual-stack-windows2022-successor-2`
- `verify-spec-network-cni-azure-overlay-dual-stack-windows2025-successor-20260708`
- `verify-spec-network-cni-azure-overlay-ilpip-dualstack-successor-20260708`

These should no longer be the controlling frontier for the surviving network-cni pending rows.

## Exact planner/app-ops writeback expected

Because this worker session is constrained to review output, I am not mutating the runtime tree or loop state directly here. The planner/app-ops side should apply the following exact repair:

1. stop treating network-cni as a 21-member pending umbrella;
2. treat `spec.network-cni.cilium-stop-start` as already out of the family because it is pass;
3. remove network-cni control from `review-network-cni-same-run-artifacts-wave-20260702`;
4. rebind the three retry-guarded rows to the current rerun leaves listed above;
5. rebind `spec.network-cni.cilium-preview-upgrade` to the shared Azure DevOps auth/runtime wait;
6. keep `verify-spec-network-cni-vm-prerelease-calico-eno-migration-matrix` unchanged;
7. preserve the exact nonlive/source-grounded holders without restoring a broad umbrella;
8. normalize `spec.network-cni.acns-observability` to pass when the accepted reviewed pass evidence is written back.

## Exact limitation note

One needed part of this repair is **not fully expressible with task-tree text updates alone**.

The stale controlling bindings live in app spec-loop state (`.state/spec-loop/state.json`) as row-level `taskId` pointers, while the sharper replacement leaves already exist in the task tree. So `task-tree update-text` can repair holder wording, but it cannot by itself rewrite those spec-loop row bindings.

If the planner cannot complete that row-level rebind through the normal app reconciliation path, the truthful fallback is:

- leave one exact ops limitation note saying that app-side spec-loop row `taskId` rewrites still require controller/planner reconciliation,
- **not** preserve the stale 21-member umbrella as a substitute.

## Bottom line

The stale network-cni family umbrella should be retired from app-visible control.

The truthful surviving frontier is now:

- one already-removed former member: `spec.network-cni.cilium-stop-start` = pass;
- one pass-ready stale same-run member: `spec.network-cni.acns-observability`;
- one shared auth/runtime wait member: `spec.network-cni.cilium-preview-upgrade`;
- three exact rerun/review carriers:
  - windows2022
  - windows2025
  - ilpip dualstack
- one unchanged exact residual holder:
  - ENO migration matrix rows 192-196
- unchanged exact nonlive/source-grounded holders;
- unchanged exact shared runtime-input wait for the cilium-enterprise pair.

That post-rebind map removes the stale 21-member bookkeeping, preserves the exact surviving holders, and identifies the one app limitation: the final row-level `taskId` rewrites must come from the app reconciliation path, not from task-tree text updates alone.
