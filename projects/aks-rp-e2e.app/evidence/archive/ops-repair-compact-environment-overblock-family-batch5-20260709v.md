# Compact environment-overblock family repair — batch 5 (2026-07-09v)

- Task: `ops/repair-compact-environment-overblock-family-batch5-20260709v`
- Attempt: `a_ops_repair-compact-environment-overblock-family-batch5-20260709v_20260709124040`
- Mode: Task Worker Mode
- Runtime task-tree mutation from this worker: none
- Output purpose: planner/app-ops apply packet for the remaining largest truthful compact environment-overblock families

## Executive result

Current live packet still reports **20** compact `environment-overblock` warnings, but they are not one broad family anymore.

The dominant truthful families now are:

1. **Existing exact shared waits already present and reusable**
   - `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
   - `wait-spec-hcp-grpc-runner-surface-rp-proxy-kubeconfig-20260702`
   - `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
   - `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
   - `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`

2. **Feature-local mixed/promotion frontiers that should stay separate**
   - `net-integration`
   - `private-cluster`
   - `rp-cluster-lifecycle`
   - `rp-nodepool-lifecycle`
   - `serverless`
   - `storage-csi`
   - `traffic-alb-controller`
   - `defender-profile`
   - `virtualmachine-prerelease-row60-legacy-addon-disable-scaling`

3. **Warning residue caused by coarse compact-side projection, not by missing domain truth**
   - several holders still project as `publish.auth.ready`, `pipeline.result.or.artifact.available`, or generic `azure.capacity.available` even when their blocker prose already names a sharper shared/spec wait or a promotion-only frontier.

So the truthful next step is **not** another umbrella compact environment wait and **not** another unchanged rerun wave.

The smallest truthful family repair now is:

- collapse the clean duplicate holders that already have an exact shared/spec wait, and
- leave one readable family-level owner action for the rest: **projection/backbinding cleanup of compact holders onto exact shared/spec waits, without inventing new environment families**.

## Sources reviewed

- Live packet and live task tree:
  - `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
  - `cd /app/projects/aks-rp-e2e.app && bun run task-tree packet`
- Exact holders / waits:
  - `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
  - `wait-spec-hcp-grpc-runner-surface-rp-proxy-kubeconfig-20260702`
  - `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
  - `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
  - `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`
- Feature summaries:
  - `features/aad-rbac/compact/staging.summary.md`
  - `features/ccp-vpa-os-arch-variants/compact/staging.summary.md`
  - `features/defender-profile/compact/staging.summary.md`
  - `features/egress-lockdown/compact/staging.summary.md`
  - `features/gpu/compact/staging.summary.md`
  - `features/hcp-interceptor/compact/staging.summary.md`
  - `features/net-integration/compact/staging.summary.md`
  - `features/node-http-proxy/compact/staging.summary.md`
  - `features/private-cluster/compact/staging.summary.md`
  - `features/rp-cluster-lifecycle/compact/staging.summary.md`
  - `features/rp-nodepool-lifecycle/compact/staging.summary.md`
  - `features/serverless/compact/staging.summary.md`
  - `features/storage-csi/compact/staging.summary.md`
  - `features/traffic-alb-controller/compact/staging.summary.md`
  - `features/upgrade/compact/staging.summary.md`
  - `features/workload-identity/compact/staging.summary.md`
  - `features/virtualmachine-prerelease-row60-legacy-addon-disable-scaling/compact/staging.summary.md`
- Prior repair packets:
  - `evidence/archive/ops-classify-compact-environment-overblock-family-20260709.md`
  - `evidence/archive/ops-rebind-compact-environment-overblock-exact-waits-20260709.md`
  - `evidence/archive/ops-rewrite-compact-second-batch-generic-holders-to-exact-frontiers-20260709.md`
  - `evidence/archive/ops-repair-feature-compact-runtime-backbinding-warning-family-20260709e.md`
  - `evidence/archive/ops-repair-compact-environment-overblock-family-20260709d.md`

## Baseline contributor set before this worker review

Using the current live packet as if this worker task did not exist, the packet still warns on these compact leaves:

- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier`
- `hold-compact-defender-profile-reviewed-exception-frontier`
- `hold-compact-egress-lockdown-package-partial-frontier`
- `hold-compact-gpu-package-partial-frontier`
- `hold-compact-hcp-interceptor-reviewed-exception-frontier`
- `hold-compact-net-integration-package-partial-frontier`
- `hold-compact-node-http-proxy-package-partial-frontier`
- `hold-compact-paf-throttling-reviewed-exception-frontier`
- `hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix`
- `hold-compact-remediator-node-not-ready-restart-runtime-product-lineage-frontier`
- `hold-compact-rp-cluster-lifecycle-package-partial-frontier`
- `hold-compact-rp-nodepool-lifecycle-package-partial-frontier`
- `hold-compact-secops-package-partial-frontier`
- `hold-compact-serverless-package-partial-frontier`
- `hold-compact-storage-csi-package-partial-frontier`
- `hold-compact-traffic-alb-controller-package-partial-frontier`
- `hold-compact-upgrade-reviewed-exception-frontier`
- `hold-compact-virtualmachine-prerelease-row60-legacy-addon-disable-scaling-reviewed-exception-frontier`
- `hold-compact-workload-identity-live-workflow-frontier`

### Current warning-family shape

From the live packet / tree inspection:

- `repo-local-mixed-terminal-and-promotion-frontier`: **9** holders
- `repo-local-live-ready-filter`: **3** holders
- `reviewed-live-run-environment-underlay-control-plane-prerequisite-wait`: **1** holder
- other exact frontier phrasings: **7** holders

Current compact-warning `waiting_for.type` split:

- `pipeline.result.or.artifact.available`: **6**
- `publish.auth.ready`: **6**
- `azure.capacity.available`: **4**
- `environment.prerequisite.ready`: **3**
- `environment.available`: **1**

This confirms the biggest remaining noise is **projection shape**, not one real environment family.

## Dominant truthful families

## 1) Exact shared/spec waits already present and reusable

### 1A. Automatic/ManagedSystem capacity family

Existing exact wait:
- `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`

Already covers:
- `spec.aad-rbac.azure-rbac-automatic-sku`
- `spec.workload-identity.automatic-sku`
- `spec.secops-fips.automatic-sku`

Why this matters now:
- `hold-compact-workload-identity-live-workflow-frontier` already says the only surviving compact blocker is `spec.workload-identity.automatic-sku` on the exact westus2 managed-system node-pool capacity/runtime surface.
- `hold-compact-aad-rbac-package-partial-frontier` already includes `spec.aad-rbac.azure-rbac-automatic-sku` as one of its three residual carriers.

Truthful family judgment:
- this shared wait is already the right multi-feature owner-response family for the automatic-sku slice.
- `workload-identity` is now the cleanest duplicate passive compact holder that can be rewritten into a represented carrier for that existing wait.
- `aad-rbac` cannot be fully retired because it still also carries `managed-v2-lifecycle` and `run-command-access`.

### 1B. HCP runner-surface family

Existing exact wait:
- `wait-spec-hcp-grpc-runner-surface-rp-proxy-kubeconfig-20260702`

Current compact holder:
- `hold-compact-hcp-interceptor-reviewed-exception-frontier`

Summary alignment:
- `features/hcp-interceptor/compact/staging.summary.md` says the only blocked compact member is `spec.hcp.grpc-message-size-interceptor` and the truthful missing surface is RP-proxy kubeconfig-backed HCP gRPC wiring.
- the exact spec wait already says the same thing.

Truthful family judgment:
- this is not a new environment family; it is an exact compact-facing duplicate of one existing spec wait.

### 1C. Egress-lockdown exact prerequisite wait

Existing exact wait:
- `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`

Current compact holder:
- `hold-compact-egress-lockdown-package-partial-frontier`

Summary alignment:
- only `spec.egress-lockdown.fips` remains quarantined
- exact need is still UDR prerequisite proof / next-hop supply

Truthful family judgment:
- same as earlier batches: this is one exact spec prerequisite wait, not a broader environment family.

## 2) Features that must stay mixed or feature-local

These are still truthful blockers, but not good family-collapse candidates:

- `hold-compact-net-integration-package-partial-frontier`
  - eleven accepted environment/terminal members plus six promotion candidates
- `hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix`
  - mixed superseded rows, queued exact-spec review, and source-grounded carriers
- `hold-compact-rp-cluster-lifecycle-package-partial-frontier`
  - eight execute-ready promotion candidates + one check-only authoring gap + preserved outside-branch waits
- `hold-compact-rp-nodepool-lifecycle-package-partial-frontier`
  - four execute-ready promotion carriers + one preserved rollback environment wait
- `hold-compact-serverless-package-partial-frontier`
  - six execute-ready promotion candidates + already-reviewed DNS runtime blocker
- `hold-compact-storage-csi-package-partial-frontier`
  - residual three-member nonlive/check-only frontier
- `hold-compact-traffic-alb-controller-package-partial-frontier`
  - exact cleanup-only authority gap for one carrier
- `hold-compact-defender-profile-reviewed-exception-frontier`
  - promotion/reclassification frontier after accepted request/runtime proof
- `hold-compact-virtualmachine-prerelease-row60-legacy-addon-disable-scaling-reviewed-exception-frontier`
  - nonlive/source-grounded owner-promotion frontier
- `hold-compact-aad-rbac-package-partial-frontier`
  - one shared capacity wait + one row-37 contradiction owner wait + one authorization-branch ceiling wait
- `hold-compact-gpu-package-partial-frontier`
  - one reviewed westus2 GPU SKU family wait + one shared underlay/runtime-input wait

Truthful judgment:
- these should stay split or mixed.
- the problem is mostly that some still project as generic environment-overblock warnings even though their prose already says “promotion/reclassification” or cites exact represented carriers.

## 3) Exact family-level owner action for the remaining residue

The remaining residue does **not** need another shared environment wait.

The one readable family-level owner action is:

> **Repair compact-side projection/backbinding so holders that already name exact shared/spec waits or promotion-only frontiers stop surfacing as generic environment-overblock families.**

In practice, that means planner/app-ops should prefer:

- represented-carrier rewrites for clean duplicates, and
- compact-state / warning-projection cleanup for mixed frontiers,

instead of creating more umbrella blocked leaves.

## Exact duplicate-holder replacements that are truthful now

Under worker-mode constraints I did not mutate the live task tree. These are planner/app-ops apply packets only.

### A. Rewrite workload-identity onto the shared Automatic/ManagedSystem capacity family

Why safe:
- `features/workload-identity/compact/staging.summary.md` says the package is otherwise ready and the only surviving non-rerunnable blocker is `spec.workload-identity.automatic-sku`.
- that exact carrier already belongs to `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`.

Recommended bounded planner command:

```bash
cd /app/projects/aks-rp-e2e.app && \
  bun run task-tree update-text hold-compact-workload-identity-live-workflow-frontier \
    --goal "Hold compact feature workload-identity only as a represented split-frontier carrier while the exact represented blocker remains wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702 for spec.workload-identity.automatic-sku." \
    --acceptance "This compact holder remains blocked only while wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702 still governs the exact spec.workload-identity.automatic-sku capacity/runtime frontier." \
    --acceptance "Do not reopen an unchanged full workload-identity compact rerun from this holder; the only surviving compact-facing blocker is the represented automatic-sku capacity family wait." \
    --acceptance "Resume compact work only after that represented capacity/runtime frontier materially changes or reviewed evidence reclassifies the exact automatic-sku carrier." \
    --blocker-owner human \
    --blocker-category external-wait \
    --resume-condition "Resume only after wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702 materially changes for spec.workload-identity.automatic-sku or reviewed evidence reclassifies that carrier." \
    --blocker "Represented by wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702. This compact leaf is a split-frontier carrier only: the workload-identity package is otherwise ready, and the only remaining compact-facing blocker is spec.workload-identity.automatic-sku on the exact Automatic/ManagedSystem capacity/runtime family already tracked by that shared human-owned wait. Do not rerun the unchanged full compact package while that represented frontier remains true." 
```

### B. Rewrite hcp-interceptor onto the exact HCP runner-surface wait

Why safe:
- the feature has one spec
- the summary and the spec wait name the same RP-proxy kubeconfig-backed HCP gRPC runner-surface gap

Recommended bounded planner command:

```bash
cd /app/projects/aks-rp-e2e.app && \
  bun run task-tree update-text hold-compact-hcp-interceptor-reviewed-exception-frontier \
    --goal "Hold compact feature hcp-interceptor only as a represented carrier while the exact represented blocker remains wait-spec-hcp-grpc-runner-surface-rp-proxy-kubeconfig-20260702 for spec.hcp.grpc-message-size-interceptor." \
    --acceptance "This compact holder remains blocked only while wait-spec-hcp-grpc-runner-surface-rp-proxy-kubeconfig-20260702 still governs the same spec.hcp.grpc-message-size-interceptor runner-surface frontier." \
    --acceptance "Do not create a duplicate compact environment blocker or unchanged rerun while the same RP-proxy kubeconfig-backed HCP gRPC runner-surface dependency remains unresolved." \
    --blocker-owner human \
    --blocker-category external-wait \
    --resume-condition "Resume only after wait-spec-hcp-grpc-runner-surface-rp-proxy-kubeconfig-20260702 materially changes or reviewed source/product evidence narrows the same carrier contract." \
    --blocker "Represented by wait-spec-hcp-grpc-runner-surface-rp-proxy-kubeconfig-20260702. This compact leaf is a compact-facing carrier only; the same exact runner-surface dependency already exists as the spec-level human-owned wait for spec.hcp.grpc-message-size-interceptor. Do not rerun unchanged while that represented frontier remains true." 
```

### C. Egress-lockdown remains a valid exact-collapse target

Still-correct exact carrier:
- `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`

This packet does not repeat the full earlier rewrite command because that exact replacement was already fully described in prior batch work; the current live evidence still supports the same conclusion.

## Why I am not proposing more family collapse in this batch

### A. AAD-RBAC is still mixed

`hold-compact-aad-rbac-package-partial-frontier` cannot be truthfully retired to one wait because it still spans:

- `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
- `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705`
- `hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706`

So the truthful next change there is a **mixed represented-frontier rewrite**, not a one-wait collapse.

### B. GPU is still mixed

`hold-compact-gpu-package-partial-frontier` currently spans:

- `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`
- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`

So GPU should not be collapsed to a single environment family. The current holder should eventually be rewritten to cite both represented carriers explicitly.

### C. Many remaining warnings are really promotion/reclassification residue

The feature summaries for defender-profile, row60, rp-cluster-lifecycle, rp-nodepool-lifecycle, serverless, storage-csi, and traffic-alb-controller all already describe **promotion/reclassification or exact cleanup-authority residue**, not a broad missing setup family.

That is why creating another shared environment wait would be misleading.

## Planner/app-ops follow-up the tree should add

Because worker mode does not let me create sibling branches or planner tasks from this session, the planner should add one bounded follow-up repair task with this intent:

### Suggested planner follow-up

`ops/repair-feature-compact-environment-overblock-projection-residue-20260709`

### Suggested bounded scope

1. Rebind compact holders that already have one exact shared/spec carrier:
   - workload-identity -> Automatic/ManagedSystem capacity family wait
   - hcp-interceptor -> exact HCP runner-surface wait
   - keep earlier egress-lockdown exact collapse if not yet applied
2. Rewrite mixed holders that must stay open so they explicitly say “represented by” their exact downstream carriers.
3. Tighten the compact warning/projection logic so promotion-only or represented-frontier holders stop surfacing as generic `environment-overblock` noise when the blocker text already names the sharper truth.

## Post-action represented set if planner applies the clean duplicate rewrites

### Replace or re-express with exact represented carriers

- `hold-compact-workload-identity-live-workflow-frontier`
  - represented by `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
- `hold-compact-hcp-interceptor-reviewed-exception-frontier`
  - represented by `wait-spec-hcp-grpc-runner-surface-rp-proxy-kubeconfig-20260702`
- `hold-compact-egress-lockdown-package-partial-frontier`
  - represented by `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`

### Keep as exact mixed/split frontiers

- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-compact-gpu-package-partial-frontier`
- `hold-compact-net-integration-package-partial-frontier`
- `hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix`
- `hold-compact-rp-cluster-lifecycle-package-partial-frontier`
- `hold-compact-rp-nodepool-lifecycle-package-partial-frontier`
- `hold-compact-serverless-package-partial-frontier`
- `hold-compact-storage-csi-package-partial-frontier`
- `hold-compact-traffic-alb-controller-package-partial-frontier`
- `hold-compact-defender-profile-reviewed-exception-frontier`
- `hold-compact-virtualmachine-prerelease-row60-legacy-addon-disable-scaling-reviewed-exception-frontier`

## Bottom line

The remaining largest truthful compact environment-overblock families are now:

1. **real shared exact waits already present in runtime**
   - Automatic/ManagedSystem capacity family
   - HCP runner-surface wait
   - Egress-lockdown UDR prerequisite wait
2. **mixed promotion/reclassification frontiers that should stay feature-local**
3. **projection residue that still makes exact frontiers look like generic environment blockers**

So the planner should:

- re-express the clean duplicates (`workload-identity`, `hcp-interceptor`, and still-valid `egress-lockdown`) against their existing exact waits,
- keep the mixed frontiers separate,
- and use one family-level owner action for the rest: **projection/backbinding cleanup, not another broad environment-family wait and not another unchanged rerun wave**.
