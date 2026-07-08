# App-ops decomposition proposal — compact package-partial family review (2026-07-08)

- Task: `ops-repair-compact-package-partial-family-decomposition-20260708b`
- Mode: Task Worker Mode / planner-app-ops review output only
- Durable worker checkpoint consumed: `/app/projects/aks-rp-e2e/evidence/archive/reconcile-compact-loop-package-partial-attempt-20260708T110800Z-worker.md`
- Current app tree authority read: `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
- Current app kanban authority read: `/app/projects/aks-rp-e2e.app/.state/tasks/kanban.json`
- Current domain worktree read: `git status --short` in `/app/projects/aks-rp-e2e`

## Result

The 2026-07-08 package-partial worker review shows the broad family redo/review is now stale.

The remaining actionable residue is **not** one truthful family-level compact rerun or family-wide writeback. It is:

1. one exact unpublished `cluster-autoscaler` repo-local repair candidate,
2. one exact unpublished `network-cni` repo-local repair family,
3. one already-published and already-verified `net-integration` same-spec repair lineage,
4. plus many unchanged package-partial members that are already represented by narrower waits/reviews/promotion holders elsewhere in the tree.

So the planner should replace the catch-all family review with exact successors and retire the residual broad family meaning.

## Exact facts consumed

### Worker checkpoint classification

The worker checkpoint says the package-partial family no longer has one family-level next move. Its exact actionable/review surfaces are:

- already-published same-spec repair outside local HEAD:
  - `spec.net-integration.custom-route-table-user-assigned-msi`
- unpublished exact repair candidate:
  - `spec.cluster-autoscaler.vm-prerelease-service-principal`
- unpublished exact repair family:
  - `network-cni` ACNS update carriers
- unchanged remainder:
  - already represented by exact per-feature waits, review-first successor runs, promotion branches, or blocked holders

Source: `../aks-rp-e2e/evidence/archive/reconcile-compact-loop-package-partial-attempt-20260708T110800Z-worker.md`

### Current unpublished domain files still visible in git

Current `git status --short` in `/app/projects/aks-rp-e2e` shows the exact relevant repo-local residue:

- `M features/cluster-autoscaler/tests/cluster-autoscaler-vm-prerelease-service-principal.ts`
- `M features/net-integration/tests/net-integration-custom-route-table-user-assigned-msi.ts`
- `M features/network-cni/tests/network-acns-basic-retina-update-retina-enterprise.ts`
- `M features/network-cni/tests/network-acns-retina-enterprise-update-acns-cilium.ts`
- `M features/network-cni/tests/network-acns-retina-enterprise-update-basic-retina.ts`

A separate dirty file also exists but is **not** part of this package-partial review result:

- `M features/net-integration/tests/net-integration-multinic-mixed.test.ts`

That extra net-integration file belongs to other exact active repair work, not to this package-partial decomposition.

## Exact classification for the three package-partial members named by the worker

| Member / surface | Current truth from evidence | Tree representation status | Planner action |
| --- | --- | --- | --- |
| `spec.cluster-autoscaler.vm-prerelease-service-principal` | unpublished exact repair candidate; local policy gates and dry-run passed, but no publish or ADO verification from the reviewed attempt | only an exact blocked wait exists now: `wait-spec-cluster-autoscaler-vm-prerelease-service-principal-reference-preflight-portability-return-20260708` | replace the blocked wait with one active exact repair leaf, or create the repair leaf and mark the wait superseded by it |
| `network-cni` ACNS update carrier trio | unpublished exact evidence-preservation repair family on three files; local checks/policies passed; validation-only review already exists | validation review leaf already exists: `verify-network-cni-compact-exception-summary-repair-slice-20260708`; no publish+verify successor yet | add one exact publish+verify successor leaf; do not reopen a broad network-cni family redo |
| `spec.net-integration.custom-route-table-user-assigned-msi` | same-spec repair already published and verified separately via evidence packet and ADO run `171350866` | already covered outside this family redo; no new package-partial leaf is needed | do **not** create another successor from this family decomposition |

## Existing exact tasks already covering or adjacent to the residue

### Already exact and should stay as-is

- `wait-spec-cluster-autoscaler-vm-prerelease-service-principal-reference-preflight-portability-return-20260708`
  - currently exact, but now stale **if** the planner chooses to act on the unpublished repo-local repair candidate
- `verify-network-cni-compact-exception-summary-repair-slice-20260708`
  - exact validation-only review of the unpublished ACNS repair slice
- `review-spec-loop-network-acns-rerun-171342018-return-20260708`
  - exact returned-run review for a different repaired network-acns rerun slice; do not merge it into the package-partial family redo
- `hold-compact-cluster-autoscaler-vm-prerelease-current-head-frontier-20260707`
  - exact family holder for the unchanged 3+3+1 compact split; keep it separate from the service-principal exact repair leaf

### Already covered separately, so no successor should be created here

- `spec.net-integration.custom-route-table-user-assigned-msi`
  - already published and verified per worker checkpoint
  - local dirty copy in git does not justify another package-partial successor leaf by itself

## Exact successor leaves the planner should add or refresh

## 1. Cluster-autoscaler exact repair successor

Suggested new leaf id:

- `repair-spec-cluster-autoscaler-vm-prerelease-service-principal-preflight-alignment-20260708`

Suggested parent:

- `aks-spec-verification-loop`

Suggested conflict scope:

- `feature:cluster-autoscaler`
- `spec:spec.cluster-autoscaler.vm-prerelease-service-principal`

Suggested goal:

- Publish the exact `spec.cluster-autoscaler.vm-prerelease-service-principal` preflight-alignment repair, rerun only that same spec after both local admission policies pass, and classify whether the preserved blocker remains reference-preflight portability or narrows further.

Suggested acceptance:

1. Commit and push the exact file change in `features/cluster-autoscaler/tests/cluster-autoscaler-vm-prerelease-service-principal.ts`.
2. Run both required local commands on the exact spec before any dispatch:
   - `bun runner/check-private-source-policy.ts --specs spec.cluster-autoscaler.vm-prerelease-service-principal`
   - `bun runner/check-live-admission.ts --specs spec.cluster-autoscaler.vm-prerelease-service-principal`
3. Queue one exact same-spec Azure DevOps rerun only after the repair is published and both policies pass.
4. Record whether the post-repair result confirms the spec is environment-blocked/reference-preflight-only or exposes a narrower product/runtime truth.

Suggested replacement action:

- supersede `wait-spec-cluster-autoscaler-vm-prerelease-service-principal-reference-preflight-portability-return-20260708` once this repair leaf is created, because the exact next action is no longer “wait for portability return” if we are intentionally publishing the repair candidate now.

## 2. Network-cni exact publish+verify successor

Suggested new leaf id:

- `publish-network-cni-acns-exception-summary-repair-and-verify-20260708`

Suggested parent:

- `aks-spec-verification-loop`

Suggested conflict scope:

- `feature:network-cni`
- `spec:spec.network-acns.basic-retina-update-retina-enterprise`
- `spec:spec.network-acns.retina-enterprise-update-acns-cilium`
- `spec:spec.network-acns.retina-enterprise-update-basic-retina`

Suggested goal:

- Publish the three-file ACNS exception-summary repair slice, rerun only the exact affected carriers after both local admission policies pass for the exact spec set, and classify the post-checkpoint network-cni compact/package-partial surface without reopening a broad family rerun.

Suggested acceptance:

1. Publish exactly these three files:
   - `features/network-cni/tests/network-acns-basic-retina-update-retina-enterprise.ts`
   - `features/network-cni/tests/network-acns-retina-enterprise-update-acns-cilium.ts`
   - `features/network-cni/tests/network-acns-retina-enterprise-update-basic-retina.ts`
2. Re-run the exact local policy gates on the exact three-spec set before dispatch:
   - `bun runner/check-private-source-policy.ts --specs spec.network-acns.basic-retina-update-retina-enterprise,spec.network-acns.retina-enterprise-update-acns-cilium,spec.network-acns.retina-enterprise-update-basic-retina`
   - `bun runner/check-live-admission.ts --specs spec.network-acns.basic-retina-update-retina-enterprise,spec.network-acns.retina-enterprise-update-acns-cilium,spec.network-acns.retina-enterprise-update-basic-retina`
3. Use the already-reviewed validation leaf `verify-network-cni-compact-exception-summary-repair-slice-20260708` as predecessor evidence, not as a duplicate successor.
4. Verify only the exact affected carriers / exact compact check surface after publish; do not queue a broad `network-cni` family rerun.

Suggested relationship to existing review leaf:

- keep `verify-network-cni-compact-exception-summary-repair-slice-20260708` as the accepted validation packet
- add this new publish+verify leaf as the fix-forward successor

## 3. No successor leaf for the net-integration same-spec repair

Exact subject:

- `spec.net-integration.custom-route-table-user-assigned-msi`

Reason:

- worker checkpoint explicitly says the repair was already published and verified separately
- current package-partial decomposition should not create overlapping repair work for the same path

Planner action:

- record this member as already covered by separate same-path work
- do **not** create a new package-partial successor leaf from this decomposition

## Broad family meaning that should be retired

### A. Retire the family review leaf

Retire / mark superseded after the exact successors above are created:

- `reconcile-compact-loop-package-partial-202607081059`

Why:

- its own worker result says the family leaf is wrongly decomposed now
- remaining action is two exact repo-local repair leaves plus one already-covered same-spec lineage
- leaving it in review duplicates narrower work rather than preserving truth

### B. Retire or sharply narrow the residual broad family holder

Current broad holder:

- `hold-compact-package-partial-residual-overlap-frontier-20260708`

Why it is now stale:

- its current goal still preserves a generic “residual compact package-partial family redo”
- the 2026-07-08 worker checkpoint already identifies the exact remaining unpublished repairs and the already-covered net-integration lineage
- unchanged package-partial members are already represented by exact waits/reviews/promotion holders elsewhere

Recommended planner action:

- if the two exact successor leaves above are created now, close `hold-compact-package-partial-residual-overlap-frontier-20260708` as superseded rather than keeping another catch-all family wait
- only keep a residual family holder if the planner intentionally postpones both exact successor leaves; in that case the holder text must be rewritten to name only those two unpublished repair slices and must stop claiming generic overlap stewardship

## Smallest truthful end-state after planner repair

After the planner applies the decomposition, the package-partial residue should read as:

- exact active repair leaf for `spec.cluster-autoscaler.vm-prerelease-service-principal`
- exact active publish+verify leaf for the three `network-cni` ACNS update carriers
- no new leaf for `spec.net-integration.custom-route-table-user-assigned-msi` because it is already separately published and verified
- unchanged package-partial members remain on their existing exact waits/reviews/promotion holders
- the broad family review `reconcile-compact-loop-package-partial-202607081059` is done/superseded
- the broad residual holder `hold-compact-package-partial-residual-overlap-frontier-20260708` is removed or rewritten so it no longer acts as a catch-all family redo

## Planner-ready summary

The 2026-07-08 package-partial redo should no longer survive as one family review plus one family residual hold.

The truthful decomposition is:

1. create one exact cluster-autoscaler service-principal repair leaf,
2. create one exact network-cni ACNS publish+verify leaf,
3. record net-integration custom-route-table UAMI as already covered by separate same-path work,
4. then retire the stale broad family review and broad residual family holder.
