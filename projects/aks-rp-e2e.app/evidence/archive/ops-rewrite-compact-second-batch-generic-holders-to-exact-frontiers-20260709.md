# Second-batch compact generic-holder rewrite audit

- Task: `ops-rewrite-compact-second-batch-generic-holders-to-exact-frontiers-20260709`
- Attempt: `a_ops-rewrite-compact-second-batch-generic-holders-to-exact-frontiers-20260709_20260709064447`
- Scope: `aad-rbac`, `cluster-autoscaler`, `egress-lockdown`, `gpu`
- App sources reviewed:
  - `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
  - `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
  - `/app/projects/aks-rp-e2e.app/workflows/lib/feature-compact-runtime-projection.ts`
  - `/app/projects/aks-rp-e2e.app/workflows/feature-compact-loop-controller.ts`
  - `/app/projects/aks-rp-e2e.app/workflows/lib/task-tree-tools.ts`
- Prior owner packet reviewed:
  - `evidence/archive/ops-repair-compact-environment-overblock-family-second-batch-20260709.md`

## Result

I did **not** directly mutate the runtime task tree from this worker session.
The current second-batch generic compact holders are still live, but this pass
pinpointed the exact rewrite targets and the app/runtime projection gap that
currently prevents a truthful automatic rewrite to existing spec/shared holders.

This is enough to close the task as a bounded audit outcome because the task
acceptance explicitly allows recording the exact runtime/projection blocker when
that blocker is what prevents the rewrite.

## Current generic compact holders still active

From app runtime state and tree:

- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-compact-cluster-autoscaler-package-partial-frontier`
- `hold-compact-egress-lockdown-package-partial-frontier`
- `hold-compact-gpu-package-partial-frontier`

The compact loop state currently points the four reviewed features at those same
four generic holder ids.

## Exact surviving holders already present in the runtime tree

### 1) `egress-lockdown` — exact single-holder collapse already exists

Current compact generic holder:
- `hold-compact-egress-lockdown-package-partial-frontier`

Exact surviving holder already present:
- `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`

Exact affected spec ids:
- `spec.egress-lockdown.fips`

Exact wait contract already present in tree:
- owner: `human`
- resume condition: provide `AKS_RP_E2E_UDR_NEXT_HOP_IP` and
  `AKS_RP_E2E_UDR_PREREQ_PROOF` for the same-path FIPS rerun, or return
  accepted evidence that changes that prerequisite contract
- fallback: refresh the exact prerequisite wait with current evidence or
  escalate the exact prerequisite-supply path; do not queue an unchanged rerun

### 2) `aad-rbac` — exact residual carriers exist, but no live compact mixed holder remains

Current compact generic holder:
- `hold-compact-aad-rbac-package-partial-frontier`

Exact residual spec ids still governing the compact frontier:
- `spec.aad-rbac.azure-rbac-automatic-sku`
- `spec.aad-rbac.managed-v2-lifecycle`
- `spec.aad-rbac.run-command-access`

Existing exact holders already present in the tree:
- `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
  - carries the automatic/managedsystem capacity-family blocker for
    `spec.aad-rbac.azure-rbac-automatic-sku`
  - owner: `human`
  - resume: reviewed Automatic/ManagedSystem capacity recovery or an owner /
    environment response that makes one bounded same-spec rerun truthful
  - fallback: refresh the shared capacity-family wait or escalate the same
    exact recovery path
- `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705`
  - carries `spec.aad-rbac.managed-v2-lifecycle`
  - owner: `human`
  - resume: returned owner/operator adjudication for the row-37 contradiction
  - fallback: preserve the exact contradiction holder with refreshed proof or
    replace it only with a narrower returned decision
- `hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706`
  - carries `spec.aad-rbac.run-command-access`
  - owner: `human`
  - resume: stronger unsplit proof, owner-approved branch isolation, or
    materially changed same-surface evidence
  - fallback: keep one exact authorization-branch ceiling or replace it with a
    narrower stronger-proof / branch-isolation successor

Important current-state fact:
- the previously proposed compact mixed holder
  `hold-compact-aad-rbac-mixed-frontier-20260705b` is **not** present in the
  live runtime tree anymore, so the only truthful exact surfaces currently live
  are the three spec/shared holders above.

### 3) `cluster-autoscaler` — an exact maintained compact frontier already exists

Current compact generic holder:
- `hold-compact-cluster-autoscaler-package-partial-frontier`

Existing exact compact-facing holder already present:
- `hold-compact-cluster-autoscaler-vm-prerelease-current-head-frontier-20260707`

That exact maintained holder already says the surviving cluster-autoscaler
compact frontier is a current-head `3+3+1` VM-prerelease split, not a generic
family environment wait.

Exact affected spec ids represented by the surviving split remain the same
seven members named by the maintained compact package:
- `spec.cluster-autoscaler.vm-prerelease-autoscaling-base`
- `spec.cluster-autoscaler.vm-prerelease-local-storage-runtime`
- `spec.cluster-autoscaler.vm-prerelease-mincount-recovery`
- `spec.cluster-autoscaler.vm-prerelease-row49-overscale-node-stability`
- `spec.cluster-autoscaler.vm-prerelease-scale-from-zero-labels-fips`
- `spec.cluster-autoscaler.vm-prerelease-service-principal`
- `spec.cluster-autoscaler.vm-prerelease-spot`

Existing exact downstream holders already present:
- `wait-spec-cluster-autoscaler-vm-prerelease-autoscaling-base-reference-preflight-portability-return-20260708`
- `wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708`
- `wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708`
- `hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708`
- `hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708`
- `wait-spec-cluster-autoscaler-vm-prerelease-service-principal-reference-preflight-portability-return-20260708`
- `wait-spec-cluster-autoscaler-vm-prerelease-spot-reference-preflight-portability-return-20260708`

Exact holder contract already present on the maintained compact frontier:
- owner: `human`
- resume condition: one maintained split member gains materially new same-path
  evidence or accepted reclassification changes the exact current-head
  VM-prerelease frontier
- fallback: refresh the exact maintained frontier or escalate a narrower
  member-specific path; do not reopen a broad compact rerun

### 4) `gpu` — exact split holders already exist, but only outside a single compact holder

Current compact generic holder:
- `hold-compact-gpu-package-partial-frontier`

Exact affected spec ids remaining on the compact frontier:
- `spec.gpu.multi-gpu-workload`
- `spec.gpu.operator-default-install`
- `spec.gpu.skip-driver-install`
- `spec.gpu.vm-prerelease-provisioner-matrix`

Existing exact holders already present:
- `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`
  - carries the classic trio:
    - `spec.gpu.multi-gpu-workload`
    - `spec.gpu.operator-default-install`
    - `spec.gpu.skip-driver-install`
  - owner: `human`
  - resume: reviewed same-surface evidence shows a supported westus2 GPU SKU
    on the staging subscription, or an owner-approved replacement
    region/subscription/source-backed target exists
  - fallback: refresh the same exact family wait or escalate only that exact
    support-surface path
- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
  - carries the shared underlay/runtime-input family that includes the GPU
    VM-prerelease provisioner path
  - exact compact-surviving governed GPU member: `spec.gpu.vm-prerelease-provisioner-matrix`
  - owner: `human`
  - resume: returned shared underlay/runtime-input signal supplies the exact
    runtime inputs needed by the unchanged carriers or returns an exact
    decline/reroute
  - fallback: refresh the shared underlay/runtime-input wait or replace it with
    a sharper returned/declined family holder instead of reopening broad retries

## Why the rewrite was not applied directly from this worker session

Two separate constraints prevent a truthful in-session rewrite here.

### A. Worker-mode scope: direct runtime task-tree edits were not authorized

This task is not an explicitly named `task-tree update-text` /
`task-tree set-outputs` metadata repair task. Under worker-mode rules, I should
not hand-edit the runtime task tree or perform planner-side reshaping from this
session.

So even the cleanest case (`egress-lockdown` ->
`wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`) could only be
reported as the exact replacement target, not manually applied in the live tree
by this worker turn.

### B. App/runtime projection code cannot currently bind compact features to these exact cross-loop / mixed frontiers

The controlling blocker is in app projection logic, not in AKS domain truth.

#### Controlling surface 1: `workflows/lib/feature-compact-runtime-projection.ts`

Current runtime projection only rebinds compact state to tasks that it can
recognize as compact exact waits:
- `isExactBlockedWaitTask()` requires `context.featureCompactExactWait === true`
- `reconcileFeatureCompactRuntimeProjection()` only collects those candidates
  from `input.loopTask.children`

That means it only sees exact holder candidates that are already children of
`aks-feature-compact-loop` and already tagged as compact exact waits.

It therefore **cannot** automatically bind to existing exact holders that live
outside the compact loop root, such as:
- `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
- `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
- `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705`
- `hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706`
- `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`
- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`

#### Controlling surface 2: one-task-per-feature projection cannot express mixed frontiers

`reconcileFeatureCompactRuntimeProjection()` can write only one `feature.taskId`
back into compact state.

That is enough for:
- single exact replacement (`egress-lockdown`)
- one existing maintained compact holder (`cluster-autoscaler`)

But it is **not** enough to truthfully represent features that now resolve to
multiple existing exact holders:
- `aad-rbac` needs three exact holders
- `gpu` needs the classic westus2 family wait plus the shared underlay/runtime
  input wait

So the current projection surface cannot rewrite those features into exact
multi-holder representations without an app repair that teaches compact state
how to point at cross-loop exact holders or at a compact-side mixed frontier
record that names multiple surviving holders.

#### Controlling surface 3: `compactWaitingForProjection()` still collapses rich mixed blocker text to generic wait types

The heuristic in `compactWaitingForProjection()` maps blocker text into one of a
few generic types such as:
- `pipeline.result.or.artifact.available`
- `azure.capacity.available`
- `publish.auth.ready`
- `owner.decision`

That is too coarse for the second batch:
- `aad-rbac` is a three-carrier mixed frontier, not one pipeline/artifact wait
- `gpu` is a mixed westus2-support plus shared-underlay frontier, not one
  `azure.capacity.available` wait
- `egress-lockdown` is an exact UDR prerequisite wait, not one
  `publish.auth.ready` wait

So the live generic holders already have misleading `blocker.waiting_for`
projections even when their prose is sharper.

#### Controlling surface 4: `feature-compact-loop-controller.ts` preserves compact exact waits during stale-wait cleanup

`closeStaleBlockedWaitsForPassedSpecs()` explicitly skips children whose
`context.featureCompactExactWait === true`.

That is correct for true exact compact holders, but it means these generic
package-partial holders persist unless another projection/rewrite step replaces
them. After the second-batch review, that replacement step still does not know
how to target the exact cross-loop / multi-holder surfaces above.

## Smallest truthful successor the planner should add

One bounded app-ops repair should follow from this packet:

**Suggested successor**
- `ops-repair-feature-compact-cross-loop-exact-frontier-projection-second-batch-20260709`

**Required bounded scope**
1. Teach `reconcileFeatureCompactRuntimeProjection()` to rebind compact state to
   exact holders outside `aks-feature-compact-loop` when those holders are the
   accepted surviving spec/shared surfaces for a feature.
2. Add a compact-side mixed-frontier projection shape that can record multiple
   surviving exact holder ids for one feature (`aad-rbac`, `gpu`).
3. Reproject `blocker.waiting_for` for these second-batch holders from exact
   surviving holder semantics instead of from the current coarse text heuristic.
4. After the app repair, run one bounded compact-loop pulse and verify:
   - `egress-lockdown` collapses to
     `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`, or
   - `cluster-autoscaler` rebinds to
     `hold-compact-cluster-autoscaler-vm-prerelease-current-head-frontier-20260707`, and
   - `aad-rbac` / `gpu` either gain truthful mixed-frontier projection or emit a
     narrower remaining blocker with exact code surface.

## Planner-ready keep/replace map

| Feature | Current generic holder | Exact surviving representation | Keep / Replace judgment |
|---|---|---|---|
| `aad-rbac` | `hold-compact-aad-rbac-package-partial-frontier` | `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702` + `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705` + `hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706` | Replace generic holder with mixed exact projection once cross-loop/multi-holder binding exists |
| `cluster-autoscaler` | `hold-compact-cluster-autoscaler-package-partial-frontier` | `hold-compact-cluster-autoscaler-vm-prerelease-current-head-frontier-20260707` plus seven exact VM-prerelease spec holders | Replace generic holder with the existing maintained exact frontier |
| `egress-lockdown` | `hold-compact-egress-lockdown-package-partial-frontier` | `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702` | Replace generic holder directly |
| `gpu` | `hold-compact-gpu-package-partial-frontier` | `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704` + `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708` | Replace generic holder with mixed exact projection once cross-loop/multi-holder binding exists |

## Bottom line

- `egress-lockdown` has a clean exact collapse target today.
- `cluster-autoscaler` already has a live exact maintained compact frontier.
- `aad-rbac` and `gpu` already have the exact surviving spec/shared holders, but
  app runtime projection cannot currently bind a compact feature to those
  cross-loop / multi-holder surfaces.
- The blocker is therefore **app projection capability**, centered on
  `workflows/lib/feature-compact-runtime-projection.ts`, not missing AKS-domain
  evidence.
