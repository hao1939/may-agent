# Compact environment-overblock family repair — batch 6 (2026-07-09y)

- Task: `ops/repair-compact-environment-overblock-family-batch6-20260709y`
- Attempt: `a_ops_repair-compact-environment-overblock-family-batch6-20260709y_20260709131306`
- Mode: Task Worker Mode
- Runtime task-tree mutation from this worker: none
- Output purpose: bounded app-side warning repair plus audit record for remaining compact warning residue

## Executive result

I confirmed that `hold-compact-aad-rbac-package-partial-frontier` was **already** a truthful residual compact frontier rather than a generic environment blocker, and that `hold-compact-workload-autoscaler-package-partial-frontier` was **already** a truthful exact two-member split frontier rather than a real missing-source blocker.

I then applied the smallest app-side repair in warning logic so that compact exact-wait holders with clearly non-environment `waiting_for.type` values stop surfacing as stale `environment-overblock` or `source-exactness-overblock` noise.

That bounded repair now clears all of these previously misleading compact warnings from the live planning packet:

- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-compact-defender-profile-reviewed-exception-frontier`
- `hold-compact-workload-autoscaler-package-partial-frontier`

I also audited one additional peer that remains flagged:

- `hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier`

That residue is **not** the same false positive. Its current holder still projects `waiting_for.type = azure.capacity.available`, and the maintained domain summary still says the only compact member needs CCP pipeline environment plus ARM64/Kubernetes >= 1.34 capacity not available in project staging. So it remains one exact tooling/runtime boundary rather than a removable stale warning under this bounded repair.

`hold-compact-upgrade-reviewed-exception-frontier` also still remains flagged after this change, which is expected: it is a real underlay/control-plane prerequisite wait (`environment.prerequisite.ready`), not a non-environment projection mistake.

## What was true before the repair

Pre-change packet inspection showed these compact holders still appearing as blocked-action warning residue even though some were already preserved as sharper exact frontiers:

- `hold-compact-aad-rbac-package-partial-frontier` as `environment-overblock`
- `hold-compact-defender-profile-reviewed-exception-frontier` as `environment-overblock`
- `hold-compact-workload-autoscaler-package-partial-frontier` as `source-exactness-overblock`
- `hold-compact-upgrade-reviewed-exception-frontier` as `environment-overblock`
- `hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier` as `environment-overblock`

The important split was:

1. **aad-rbac** already represented a mixed exact residual trio, not one broad environment blocker.
2. **defender-profile** already represented owner promotion / eligibility review, not environment setup.
3. **workload-autoscaler** already represented an exact two-member split frontier, not a generic missing-source ask.
4. **upgrade** remained a true underlay/control-plane prerequisite wait.
5. **ccp-vpa-os-arch-variants** remained a true pipeline + ARM64/K8s>=1.34 capacity boundary.

So the actionable bug was in the warning classifier, not in compact domain truth.

## Evidence that `aad-rbac` was already exact frontier truth

### Live compact summary

`/app/projects/aks-rp-e2e/features/aad-rbac/compact/staging.summary.md` says:

- exact blocker kind: `repo-local-live-ready-filter`
- all feature-owned specs are already selected into the compact package
- only three quarantined reviewed-exception members remain:
  - `spec.aad-rbac.azure-rbac-automatic-sku`
  - `spec.aad-rbac.managed-v2-lifecycle`
  - `spec.aad-rbac.run-command-access`
- resume only when one of those reviewed-exception carriers changes or the compact live-ready filter changes

That is already a **residual mixed frontier**, not a generic missing environment setup task.

### Live blocked holder

Live tree inspection of `.state/tasks/tree.json` showed `hold-compact-aad-rbac-package-partial-frontier` already says:

- current frontier is only the residual reviewed-exception trio
- `spec.aad-rbac.nonaad-to-aadv2-migration` was already cleared by reviewed same-path pass run `28847520644`
- resume only when one of the three residual carriers changes materially
- `blocker.waiting_for.type = pipeline.result.or.artifact.available`

So the holder already carried non-environment runtime shape, but the packet classifier still flagged it because its text contains words like `capacity`, `external`, `staging`, and `required` from the preserved exact carrier descriptions.

## Additional sampled peers: defender-profile and workload-autoscaler

Live tree inspection showed `hold-compact-defender-profile-reviewed-exception-frontier` already had:

- `blocker.waiting_for.type = owner.decision`
- compact summary reason: `repo-local-mixed-terminal-and-promotion-frontier`
- exact next step: owner promotion / compact-eligibility reclassification after accepted request-plus-runtime floor proof

So `defender-profile` was another clear false positive from warning classification, not a real environment setup blocker.

Live tree inspection also showed `hold-compact-workload-autoscaler-package-partial-frontier` already had:

- `context.featureCompactExactWait = true`
- `blocker.waiting_for.type = owner.decision`
- blocker text that explicitly preserves one reviewed runtime frontier plus one bounded source-equivalent evidence ceiling
- resume only when one of those two exact members changes materially

Its task text still contains source language (`mounted-source/public-doc`, `source-equivalent evidence`) because that is part of the exact represented split. But the holder is no longer asking planning to discover missing source proof; it is already the exact compact split frontier.

## Additional sampled peer that still remains truthful residue

### `hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier`

This one still remains flagged after the code change, and that is currently justified.

Evidence from `features/ccp-vpa-os-arch-variants/compact/staging.summary.md`:

- exact blocker kind: `repo-local-live-ready-filter`
- single compact member remains quarantined: `spec.ccp-vpa.os-arch-variant-matrix`
- reviewed exception explanation still says stronger same-path execution requires:
  - CCP pipeline environment
  - ARM64/Kubernetes >= 1.34 capacity
  - neither is available in project staging

Live holder inspection showed:

- `blocker.waiting_for.type = azure.capacity.available`
- owner remains `operator`

That means this is **not** just stale non-environment prose hidden behind an environment warning. It is still a real external pipeline/capacity boundary. Reducing that warning further would require richer controller/runtime projection semantics for mixed CCP pipeline + capacity families, not this bounded compact-warning classifier repair.

## App-side repair applied

### File changed

- `workflows/lib/task-tree-tools.ts`

### Change

Kept the existing narrow suppression helper for compact exact-wait holders that are already known to be **non-environment** frontiers, and extended the same exact-frontier exception into the `source-exactness-overblock` path.

- helper reads `blocker.waiting_for.type`
- applies only when `context.featureCompactExactWait === true`
- already suppresses `environment-overblock` when the holder projects one of these non-environment types:
  - `owner.decision`
  - `pipeline.result.or.artifact.available`
  - `publish.auth.ready`
  - `compact.frontier.changed`
  - `evidence.available`
- now also suppresses `source-exactness-overblock` for those same compact exact-wait non-environment holders

This is intentionally narrow:

- no task-tree restructuring
- no compact reruns
- no broad family reclassification
- no suppression of true environment/prerequisite waits such as `azure.capacity.available` or `environment.prerequisite.ready`
- no suppression of genuine standalone source-proof blockers that are **not** already exact compact non-environment frontiers

## Regression coverage added

### File changed

- `workflows/task-tree-tools.test.ts`

### New tests

Added/kept coverage for:

- `planning packet suppresses environment-overblock warning for feature-compact exact non-environment frontiers`
- `planning packet suppresses source-exactness-overblock warning for feature-compact exact non-environment frontiers`

Together the tests prove that compact exact-wait holders with:

- `waiting_for.type = owner.decision`, and
- `waiting_for.type = pipeline.result.or.artifact.available`

are suppressed from both stale warning paths when they are already exact compact non-environment frontiers, while a separate genuine environment blocker and a separate genuine standalone source-proof blocker still remain in the packet.

## Live post-repair result

After the code/test change, `bun run task-tree packet` showed the compact warning residue dropped for the sampled holders.

Cleared from `blocked_action_warnings`:

- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-compact-defender-profile-reviewed-exception-frontier`
- `hold-compact-workload-autoscaler-package-partial-frontier`

Still flagged:

- `hold-compact-upgrade-reviewed-exception-frontier`
- `hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier`
- plus other true environment-family holders such as `gpu`, `private-cluster`, `node-http-proxy`, and `remediator-node-not-ready-restart-runtime-product-lineage`

Current compact warning sample after repair:

- `hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier` as `environment-overblock`
- `hold-compact-gpu-package-partial-frontier` as `environment-overblock`
- `hold-compact-node-http-proxy-package-partial-frontier` as `environment-overblock`
- `hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix` as `environment-overblock`
- `hold-compact-remediator-node-not-ready-restart-runtime-product-lineage-frontier` as `environment-overblock`
- `hold-compact-upgrade-reviewed-exception-frontier` as `environment-overblock`

Notably absent after the repair:

- no `source-exactness-overblock` warning for `hold-compact-workload-autoscaler-package-partial-frontier`

So this bounded repair removed misleading non-environment and non-source-proof residue without suppressing true environment/prerequisite waits.

## Acceptance mapping

### 1. Confirm whether `hold-compact-aad-rbac-package-partial-frontier` was already exact reviewed-exception/residual frontier rather than a real environment blocker

Satisfied.

Live compact summary plus live task-tree holder text already showed `aad-rbac` was a residual reviewed-exception mixed frontier over three exact carriers, not a generic environment blocker. The smallest truthful repair was warning-logic suppression for compact exact-wait non-environment frontiers, not holder-text churn.

### 2. Handle at least one additional still-flagged compact holder from the same warning family

Satisfied.

- `defender-profile` was handled directly by the same bounded warning repair and is now cleared from `environment-overblock`.
- `workload-autoscaler` was specifically handled for the retry ask and is now cleared from stale `source-exactness-overblock`.
- `ccp-vpa-os-arch-variants` was audited as a peer that still remains truthfully flagged because it still depends on CCP pipeline environment plus ARM64/K8s>=1.34 capacity in staging.

### 3. Leave the compact loop with fewer misleading environment-overblock warnings or one exact documented reason residue cannot be reduced further

Satisfied.

The live packet now has fewer misleading warnings because `aad-rbac` and `defender-profile` no longer surface as generic `environment-overblock` noise, and `workload-autoscaler` no longer surfaces as fake `source-exactness-overblock` noise. The remaining sampled residue (`upgrade`, `ccp-vpa-os-arch-variants`) is documented here as true prerequisite/capacity residue that should remain until controller/runtime semantics or exact external conditions change.

## Remaining residue boundary

The next truthful reduction is **not** another umbrella wait.

The remaining hard cases now fall into two classes:

1. **True environment/prerequisite waits** that should stay warned
   - example: `upgrade`
2. **Mixed external/tooling families** whose current exact holder still legitimately projects environment/capacity types
   - example: `ccp-vpa-os-arch-variants`

If planner/app-ops wants to reduce those further, it needs a sharper controller/runtime distinction for mixed pipeline+capacity or shared prerequisite families. That is beyond this bounded classifier fix.
