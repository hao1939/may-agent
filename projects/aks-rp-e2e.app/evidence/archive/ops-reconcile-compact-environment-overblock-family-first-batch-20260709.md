# Reconcile compact environment-overblock family — first batch (2026-07-09)

- Task: `ops-reconcile-compact-environment-overblock-family-first-batch-20260709`
- Attempt: `a_ops-reconcile-compact-environment-overblock-family-first-batch-20260709_20260709075308`
- Mode: Task Worker Mode
- Runtime tree mutation from this worker: none
- Output purpose: planner/app-ops review material for exact blocked-frontier reduction

## Executive verdict

The dominant compact `package-partial` warning family does **not** collapse to one umbrella environment wait.

The truthful reduction is a **small set of exact family shapes**:

1. one **shared reviewed-exception/live-ready-policy wait** for features whose only residual blocker is the same compact policy family;
2. one **mixed residual frontier hold** for `app-routing` because the current app model still projects only one compact task pointer per feature;
3. one **explicit seven-member accepted-environment frontier** for `cluster-autoscaler`;
4. one **exact spec prerequisite wait** for `egress-lockdown`;
5. separate exact same-spec / owner-decision waits for `machines-agentpool` and `node-http-proxy`;
6. mixed exact-frontier projections, not one environment wait, for `aad-rbac` and `gpu`.

So the family should become **smaller and sharper**, not broader.

## Sources reviewed

- `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
- `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
- `/app/projects/aks-rp-e2e/features/app-routing/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/features/cluster-autoscaler/compact/staging.summary.md`
- Prior app evidence:
  - `evidence/archive/ops-audit-compact-environment-overblock-warning-family-20260709.md`
  - `evidence/archive/ops-repair-compact-app-routing-exact-frontier-projection-20260709.md`
  - `evidence/archive/ops-repair-compact-environment-overblock-family-first-batch-20260709b.md`
  - `evidence/archive/ops-repair-compact-environment-overblock-family-second-batch-20260709.md`

## Baseline contributor set before this reconciliation

Ignoring this worker task itself, the current compact-facing blocked holders in the warning family are:

- `hold-compact-app-routing-package-partial-frontier-202607090657`
- `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`
- `hold-compact-egress-lockdown-package-partial-frontier-202607090740`
- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-compact-gpu-package-partial-frontier`
- `hold-compact-machines-agentpool-package-partial-frontier-202607090638`
- `hold-compact-node-http-proxy-package-partial-frontier-202607090544`

Related exact carriers already present elsewhere in the tree and relevant to truthful reduction are:

- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
- `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
- `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`
- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
- `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
- `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705`
- `hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706`
- `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`

## Family-by-family truth

### A. Shared family slice that really is one wait

These features share the same real blocker shape and should remain represented by the **existing** shared wait:

- `ccp-coredns`
- `ossku-migration`
- `planned-maintenance`
- the reviewed-exception siblings of `machines-agentpool`

Shared carrier:

- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`

Why this is truthful:

- all affected specs are already selected into compact packages;
- local check mode passes;
- the residual blocker is the same reviewed-exception/live-ready-policy family;
- the truthful resume trigger is accepted member reclassification or an intentional compact live-ready policy change, not another unchanged rerun.

Planner implication:

- preserve `wait-compact-reviewed-exception-live-ready-policy-family-20260702` as the single family carrier for that slice;
- do not keep duplicate passive compact package-partial holders for the same reviewed-exception-policy cause.

### B. `app-routing` must remain distinct

Current maintained compact authority says `app-routing` is still partial because the 9 quarantined members split into **three different frontier groups**:

- `accepted-environment-blocked-frontier` (4)
- `accepted-product-gap-frontier` (1)
- `reviewed-exception-frontier` (4)

Current holder:

- `hold-compact-app-routing-package-partial-frontier-202607090657`

Why it cannot truthfully collapse to one shared environment wait:

- the maintained compact summary is explicitly split, not single-cause;
- some exact app-routing spec waits already exist, but they do not yet cover the full compact residual set;
- the current app runtime/controller still projects only **one compact feature taskId / waiting_for** per feature, so there is no truthful multi-frontier projection surface yet.

Planner implication:

- keep `hold-compact-app-routing-package-partial-frontier-202607090657` as one **mixed residual frontier hold** for now;
- do **not** rewrite it to a fake shared environment wait;
- longer-term app repair needed if planner wants true frontier-group projection for compact features.

### C. `cluster-autoscaler` must remain distinct

Current maintained compact authority says `cluster-autoscaler` has exactly **one seven-member accepted-environment-blocked frontier**:

- `spec.cluster-autoscaler.vm-prerelease-autoscaling-base`
- `spec.cluster-autoscaler.vm-prerelease-local-storage-runtime`
- `spec.cluster-autoscaler.vm-prerelease-mincount-recovery`
- `spec.cluster-autoscaler.vm-prerelease-row49-overscale-node-stability`
- `spec.cluster-autoscaler.vm-prerelease-scale-from-zero-labels-fips`
- `spec.cluster-autoscaler.vm-prerelease-service-principal`
- `spec.cluster-autoscaler.vm-prerelease-spot`

Current holder:

- `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`

Why it cannot merge with `app-routing` or other generic family members:

- its blocker is single-frontier, but feature-specific;
- the exact seven-member frontier is already named in maintained compact artifacts;
- the task tree already carries corresponding per-member exact holders.

Planner implication:

- preserve this as one **exact seven-member compact frontier**;
- do **not** broaden it into a cross-feature environment family;
- keep the current holder only if it continues to represent that exact seven-member frontier textually and operationally.

### D. `egress-lockdown` is the clean collapse case

Current compact authority leaves only one quarantined member:

- `spec.egress-lockdown.fips`

Current generic compact holder:

- `hold-compact-egress-lockdown-package-partial-frontier-202607090740`

Exact existing carrier:

- `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`

Why this is a duplicate:

- the compact holder already says the truthful next step is the exact prerequisite wait;
- there is no broader residual compact-family meaning left beyond that single spec wait.

Planner implication:

- replace compact-facing warning-family representation with `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`;
- do not preserve the generic compact holder as a passive duplicate.

### E. `machines-agentpool` must remain distinct from the shared policy family

Current compact state says the exact live blocker is the same-spec review frontier for:

- `spec.nap.default-machines-pool-cleanup-no-machine-crud`

Current holder:

- `hold-compact-machines-agentpool-package-partial-frontier-202607090638`

Why this should not stay in the generic warning family:

- the current exact meaning is one same-spec review/rerun-ready carrier, not a broad package-partial family wait;
- the reviewed-exception siblings already belong to `wait-compact-reviewed-exception-live-ready-policy-family-20260702`, but the cleanup review branch does not.

Planner implication:

- keep `machines-agentpool` outside the shared reviewed-exception family except for those reviewed-exception siblings already named there;
- project compact-facing meaning onto the exact same-spec review branch rather than a generic package-partial holder.

### F. `node-http-proxy` must remain distinct

Current compact state says create/update already passed and the only surviving blocker is the separate trusted-ca quarantine / owner decision branch.

Current holder:

- `hold-compact-node-http-proxy-package-partial-frontier-202607090544`

Exact existing carrier:

- `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`

Planner implication:

- do not treat `node-http-proxy` as part of the generic environment-overblock family;
- the truthful surviving representation is the exact trusted-ca owner-decision wait.

### G. `aad-rbac` must remain distinct and mixed

Current compact authority leaves three residual members with **different exact carriers**:

- `spec.aad-rbac.azure-rbac-automatic-sku`
  - `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
- `spec.aad-rbac.managed-v2-lifecycle`
  - `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705`
- `spec.aad-rbac.run-command-access`
  - `hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706`

Current generic holder:

- `hold-compact-aad-rbac-package-partial-frontier`

Planner implication:

- do not preserve `aad-rbac` as an environment-overblock family wait;
- represent it as one **mixed compact frontier** subordinate to the three exact carriers above.

### H. `gpu` must remain distinct and mixed

Current compact authority leaves two different residual surfaces:

- classic westus2 GPU SKU support family for `spec.gpu.multi-gpu-workload`
  - `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`
- shared underlay/runtime-input wait for `spec.gpu.vm-prerelease-provisioner-matrix`
  - `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`

Current generic holder:

- `hold-compact-gpu-package-partial-frontier`

Planner implication:

- do not preserve `gpu` as one environment-overblock family wait;
- represent it as one mixed compact frontier pointing at the GPU classic SKU wait plus the shared underlay/runtime-input wait.

## Post-action represented set the planner should preserve

### Keep as truthful blocked-family carriers

- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
- `hold-compact-app-routing-package-partial-frontier-202607090657`
- `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`
- `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
- `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`
- `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
- `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705`
- `hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706`
- `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`
- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
- the existing seven exact cluster-autoscaler spec-level frontier holders already named in the tree
- the exact same-spec `machines-agentpool` review holder already described by current compact state

### Generic compact holders that should no longer survive unchanged in the handled family

- `hold-compact-egress-lockdown-package-partial-frontier-202607090740`
  - replace with `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
- `hold-compact-machines-agentpool-package-partial-frontier-202607090638`
  - replace compact-facing meaning with the exact same-spec review frontier
- `hold-compact-node-http-proxy-package-partial-frontier-202607090544`
  - replace compact-facing meaning with `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`
- `hold-compact-aad-rbac-package-partial-frontier`
  - rewrite to exact mixed frontier pointing at its three surviving carriers
- `hold-compact-gpu-package-partial-frontier`
  - rewrite to exact mixed frontier pointing at the GPU SKU family wait plus underlay/runtime-input wait

## Minimal planner follow-up

If planner wants one bounded successor from this memo, it should be:

**Rewrite the remaining generic compact warning holders into exact frontier representation instead of creating a new umbrella wait.**

Priority order:

1. collapse `egress-lockdown` to `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`;
2. keep `app-routing` as the explicit mixed residual frontier because runtime still lacks multi-frontier compact projection;
3. keep `cluster-autoscaler` as the explicit seven-member frontier;
4. reproject `machines-agentpool` and `node-http-proxy` onto their exact same-spec / owner-decision carriers;
5. rewrite `aad-rbac` and `gpu` as explicit mixed frontiers tied to their existing exact waits.

## Net result

This first-batch reconciliation finds:

- **one real shared wait family** (`wait-compact-reviewed-exception-live-ready-policy-family-20260702`),
- **one clear collapse case** (`egress-lockdown`),
- **two exact distinct compact feature frontiers** (`app-routing`, `cluster-autoscaler`), and
- **four generic holders that should either map to exact waits or explicit mixed frontiers** (`machines-agentpool`, `node-http-proxy`, `aad-rbac`, `gpu`).

That leaves the compact blocked frontier more readable than the baseline: every handled family member now has an explicit reason to remain distinct or an exact carrier it should collapse into. No new umbrella environment-overblock wait is justified.