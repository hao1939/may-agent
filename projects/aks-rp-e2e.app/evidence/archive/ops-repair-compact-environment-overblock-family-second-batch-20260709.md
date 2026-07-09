# Compact environment-overblock family second batch review (2026-07-09)

- Task: `ops-repair-compact-environment-overblock-family-second-batch-20260709`
- Attempt: `a_ops-repair-compact-environment-overblock-family-second-batch-20260709_20260709063817`
- Scope reviewed: the remaining package-partial compact warning family centered on `aad-rbac`, `cluster-autoscaler`, `egress-lockdown`, and `gpu`
- Sources reviewed:
  - `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
  - `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
  - `/app/projects/aks-rp-e2e/features/*/compact/staging.summary.md`
  - prior repair notes at `/app/projects/aks-rp-e2e/evidence/archive/ops-repair-compact-environment-overblock-family-20260709.md` and `/app/projects/aks-rp-e2e/evidence/archive/ops-reproject-compact-warning-family-structured-blockers-20260709.md`

## Decision

One shared environment setup/diagnosis/escalation holder does **not** truthfully represent this four-feature second batch.

The current generic compact holders:

- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-compact-cluster-autoscaler-package-partial-frontier`
- `hold-compact-egress-lockdown-package-partial-frontier`
- `hold-compact-gpu-package-partial-frontier`

all look similar in runtime state, but they hide **different exact blocker shapes**:

- `aad-rbac` is a **mixed reviewed-exception frontier**.
- `cluster-autoscaler` is an **exact seven-member environment frontier**, not one shared wait.
- `egress-lockdown` is a **single exact prerequisite wait** and can collapse directly.
- `gpu` is a **mixed promotion + environment + underlay/runtime-input frontier**.

So the truthful fix is **not** a new umbrella environment task. The truthful fix is to replace or rewrite each generic feature-level holder into the exact representation already implied by current compact/spec evidence.

## Baseline contributor set before this audit

Current generic contributors visible in app state:

- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-compact-cluster-autoscaler-package-partial-frontier`
- `hold-compact-egress-lockdown-package-partial-frontier`
- `hold-compact-gpu-package-partial-frontier`

These are the noisy holders this audit reviewed.

## Post-audit represented set that should survive

### 1) `aad-rbac`: keep as an exact mixed frontier, not one shared environment wait

`features/aad-rbac/compact/staging.summary.md` says the compact package is partial only because three members remain quarantined:

- `spec.aad-rbac.azure-rbac-automatic-sku`
- `spec.aad-rbac.managed-v2-lifecycle`
- `spec.aad-rbac.run-command-access`

Those three already map to different exact surfaces in the task tree:

1. `spec.aad-rbac.azure-rbac-automatic-sku`
   - exact shared holder: `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
   - owner: `human`
   - resume condition: reviewed Automatic/ManagedSystem create recovery evidence or owner/environment response makes one same-spec rerun meaningful
   - fallback: refresh the shared capacity-family wait or create one exact follow-up ask/escalation task

2. `spec.aad-rbac.managed-v2-lifecycle`
   - exact holder: `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705`
   - owner: `human`
   - resume condition: owner/operator adjudication returns one bounded outcome for the row-37 contradiction packet
   - fallback: keep the exact row-37 owner-response holder with refreshed send-proof or replace it only if returned adjudication isolates a narrower next step

3. `spec.aad-rbac.run-command-access`
   - exact holder: `hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706`
   - owner: `human`
   - resume condition: an owner-approved branch-isolating hypothesis, stronger unsplit proof, or materially changed same-surface evidence changes the boundary
   - fallback: keep one exact authorization-branch ceiling or replace it with one exact branch-isolation/stronger-proof successor

### `aad-rbac` judgment

Do **not** preserve `hold-compact-aad-rbac-package-partial-frontier` as an environment-overblock family holder.

Planner should represent `aad-rbac` as one **mixed compact frontier** subordinate to the three exact spec-level holders above, not as one shared environment wait.

---

### 2) `cluster-autoscaler`: do not merge into one shared environment wait

`features/cluster-autoscaler/compact/staging.summary.md` says the compact package is partial because seven selected members remain quarantined and all seven are already part of one accepted-environment-blocked frontier:

- `spec.cluster-autoscaler.vm-prerelease-autoscaling-base`
- `spec.cluster-autoscaler.vm-prerelease-local-storage-runtime`
- `spec.cluster-autoscaler.vm-prerelease-mincount-recovery`
- `spec.cluster-autoscaler.vm-prerelease-row49-overscale-node-stability`
- `spec.cluster-autoscaler.vm-prerelease-scale-from-zero-labels-fips`
- `spec.cluster-autoscaler.vm-prerelease-service-principal`
- `spec.cluster-autoscaler.vm-prerelease-spot`

The task tree already carries exact per-member holders:

- `wait-spec-cluster-autoscaler-vm-prerelease-autoscaling-base-reference-preflight-portability-return-20260708`
- `wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708`
- `wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708`
- `hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708`
- `hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708`
- `wait-spec-cluster-autoscaler-vm-prerelease-service-principal-reference-preflight-portability-return-20260708`
- `wait-spec-cluster-autoscaler-vm-prerelease-spot-reference-preflight-portability-return-20260708`

The compact generic holder currently says broad live dispatch is untruthful until that seven-member frontier changes. That is correct in substance and wrong only in presentation.

### `cluster-autoscaler` judgment

Do **not** collapse `cluster-autoscaler` into one shared setup/diagnosis/escalation task.

Planner should keep one **exact seven-member compact frontier representation** backed by the seven holders above. The noisy part is the generic compact-holder wording, not the existence of the frontier itself.

Also keep these separate from unrelated cluster-autoscaler leaves outside the seven-member compact frontier, such as:

- `hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709`
- `hold-spec-cluster-autoscaler-vm-prerelease-long-unregistered-alias-row53-frontier-20260709b`

---

### 3) `egress-lockdown`: this one can collapse to one exact wait

`features/egress-lockdown/compact/staging.summary.md` shows only one quarantined compact member:

- `spec.egress-lockdown.fips`

The exact surviving holder already exists:

- `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
- owner: `human`
- resume condition: `AKS_RP_E2E_UDR_NEXT_HOP_IP` plus `AKS_RP_E2E_UDR_PREREQ_PROOF` are supplied for the same-path rerun, or reviewed evidence changes the prerequisite contract
- fallback: create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence

The current compact feature holder already says to reuse this exact wait and avoid a duplicate compact passive wait.

### `egress-lockdown` judgment

This is the one clear **replace** case in the second batch.

Planner should retire `hold-compact-egress-lockdown-package-partial-frontier` from active compact-side warning presentation and let `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702` carry the feature.

---

### 4) `gpu`: keep as a mixed frontier, not one shared environment wait

`features/gpu/compact/staging.summary.md` says two members remain uncovered:

- `spec.gpu.multi-gpu-workload`
- `spec.gpu.vm-prerelease-provisioner-matrix`

Those do **not** share one exact wait.

#### `spec.gpu.multi-gpu-workload`

The current compact holder text and feature summary show that this branch is controlled by the reviewed westus2 GPU SKU environment surface and promotion/reclassification judgment.

Relevant exact family holder already present:

- `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`
- governed specs include `spec.gpu.multi-gpu-workload`, `spec.gpu.operator-default-install`, and `spec.gpu.skip-driver-install`
- owner: `human`
- resume condition: reviewed same-surface evidence shows a supported westus2 GPU SKU on the staging subscription, or an owner-approved replacement region/subscription/source-backed target exists
- fallback: create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence

#### `spec.gpu.vm-prerelease-provisioner-matrix`

The feature summary still preserves this as a separate underlay/runtime-input blocker:

- blocked before Azure resource changes because `AKS_RP_E2E_UNDERLAY_KUBECONFIG` must point to an existing underlay kubeconfig
- current project-wide exact shared holder is the underlay/runtime-input family wait already maintained in the tree (`wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`)

### `gpu` judgment

Do **not** preserve `hold-compact-gpu-package-partial-frontier` as one environment-overblock holder.

Planner should represent `gpu` as one **mixed compact frontier**:

- the classic westus2 GPU SKU family wait for the classic trio, and
- the shared underlay/runtime-input wait for `spec.gpu.vm-prerelease-provisioner-matrix`

That is materially sharper than the current generic feature-level package-partial holder.

## Final truth for this second batch

### What can be truthfully shared

Shared exact holders that should survive:

- `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
- `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`
- `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
- existing cluster-autoscaler seven-member spec-level holders
- existing aad-rbac row-37 and run-command exact holders
- existing shared underlay/runtime-input wait for GPU VM-prerelease provisioner

### What cannot be truthfully merged

Do **not** add one new umbrella holder for:

- all four features together, or
- all remaining second-batch compact package-partial environment warnings

because that would hide different owners, different resume conditions, and different fallback paths.

## Concrete planner/app-ops successor to add

If planner wants one bounded successor from this audit, it should be:

**Rewrite the four generic compact holders into exact representation, not into a new umbrella wait.**

Minimum exact rewrite plan:

1. Replace `hold-compact-egress-lockdown-package-partial-frontier` with `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702` in compact-facing runtime projection.
2. Rewrite `hold-compact-aad-rbac-package-partial-frontier` into an explicit mixed frontier pointing at:
   - `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
   - `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705`
   - `hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706`
3. Rewrite `hold-compact-cluster-autoscaler-package-partial-frontier` into an explicit maintained seven-member frontier pointing at the seven existing cluster-autoscaler spec holders.
4. Rewrite `hold-compact-gpu-package-partial-frontier` into an explicit mixed frontier pointing at:
   - `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`
   - the shared underlay/runtime-input wait that governs `spec.gpu.vm-prerelease-provisioner-matrix`

## Why this is better for future blocked-frontier review

This leaves future compact blocked-frontier review with:

- one true collapse case (`egress-lockdown`),
- two explicit mixed-frontier cases (`aad-rbac`, `gpu`), and
- one explicit maintained multi-member environment frontier (`cluster-autoscaler`),

instead of four generic package-partial/environment-overblock holders that currently look interchangeable even though they are not.

## Worker-mode note

I did not mutate the runtime task tree from this session. Under Task Worker Mode, this task is review/evidence output for planner/app-ops application, not direct tree reshaping. The memo above is the proposed exact replacement map the planner should apply.