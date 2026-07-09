# Compact environment-overblock shared-family repair — batch c (2026-07-09)

- Task: `ops-repair-compact-environment-overblock-shared-family-20260709c`
- Attempt: `a_ops-repair-compact-environment-overblock-shared-family-20260709c_20260709101539`
- Mode: worker evidence/proposal only; no runtime task-tree mutation performed

## Scope reviewed

Focused on the highest-noise compact holders and adjacent shared waits named in the task prompt and current runtime surfaces:

- compact `app-routing`
- compact `gpu`
- compact `app-monitoring` / westus2 capacity family
- adjacent shared capability family for comparison (`wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704`)

Sources reviewed:

- `/app/projects/aks-rp-e2e.app/tasks/tree.json`
- `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
- `/app/projects/aks-rp-e2e/features/app-routing/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/features/gpu/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/evidence/archive/normalize-compact-package-partial-mixed-frontiers-20260707.md`
- `/app/projects/aks-rp-e2e/evidence/archive/review-terminal-network-cni-cilium-enterprise-addon-underlay-run-28606815316-20260707.md`
- `/app/projects/aks-rp-e2e/evidence/archive/diagnose-shared-auth-capability-family-spec-and-compact-20260704.md`

## Decision

One repeated compact environment-overblock family can be reduced more cleanly now:

1. **Keep** the already-correct shared westus2 capacity family for compact `app-monitoring`.
2. **Replace** the noisy compact `gpu` generic environment/package-partial holder with its two exact existing shared waits.
3. **Do not fold** compact `app-routing` into any shared environment family here; its current frontier is mixed and no longer truthfully described as one environment-overblock family.

So the concrete repair for this batch is:

- **surviving shared family:** `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`
- **surviving exact shared waits for gpu instead of one generic compact holder:**
  - `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`
  - `wait-spec-network-cni-cilium-enterprise-addon-underlay-kubeconfig-response-20260630`
- **explicit non-merge:** keep `app-routing` out of this shared-family repair because its residual blocked set is mixed product-gap / reviewed-exception / environment-blocked split frontier, not one real external cause.

## Baseline contributor set before this audit

Computed as if this audit task did not exist.

Current controller-visible compact contributors in app-owned state:

1. `app-routing`
   - state task id: `hold-compact-app-routing-package-partial-frontier-202607090657`
   - current summary shape: mixed residual split frontier, not one exact shared environment wait
2. `gpu`
   - state task id: `hold-compact-gpu-package-partial-frontier`
   - current summary shape: two different exact blockers, not one exact shared environment wait
3. `app-monitoring`
   - state task id: `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`
   - current summary shape: already a truthful shared family wait

## Post-action represented set that should survive

### A. Keep the westus2 shared family exactly as-is for app-monitoring

`app-monitoring` is already correctly reduced.

Evidence:

- app state for `app-monitoring` already points directly to `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`
- the tree entry for `wait-shared-westus2-managed-cluster-capacity-family-return-20260703` says it is the **single useful live representation** of the shared westus2 managed-cluster capacity wait
- the compact child `reconcile-compact-loop-staging-capacity-202607042218` is only a **feature-scoped pointer** and explicitly says it should stay aligned with the project-level westus2 family wait rather than act as an independent environment blocker

### B. Replace the generic gpu compact holder with the two exact existing waits

This is the cleanest repeated-family reduction available in this batch.

`features/gpu/compact/staging.summary.md` says only two members remain uncovered:

- `spec.gpu.multi-gpu-workload`
- `spec.gpu.vm-prerelease-provisioner-matrix`

Those do **not** share one exact external cause.

#### 1. `spec.gpu.multi-gpu-workload`

Already represented by:

- `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`

Tree evidence says this exact family wait covers:

- `spec.gpu.multi-gpu-workload`
- `spec.gpu.operator-default-install`
- `spec.gpu.skip-driver-install`

with resume only when same-surface westus2 GPU SKU support changes or an owner-approved replacement region/subscription exists.

#### 2. `spec.gpu.vm-prerelease-provisioner-matrix`

Already represented by:

- `wait-spec-network-cni-cilium-enterprise-addon-underlay-kubeconfig-response-20260630`

Tree evidence says this shared underlay/runtime-input family explicitly covers:

- `spec.gpu.vm-prerelease-provisioner-matrix`

with resume only when reviewed runtime inputs such as `AKS_RP_E2E_UNDERLAY_KUBECONFIG(_B64)` / `AKS_RP_E2E_ASSIGN_IDENTITY` / `AKS_RP_E2E_CONTROL_PLANE_ID` return or an exact decline/reroute lands.

#### gpu judgment

Planner should stop representing gpu as one generic compact environment-overblock/package-partial holder and instead project the existing exact waits above.

That leaves **one useful live wait per real external cause**:

- westus2 classic GPU SKU support surface
- shared underlay/runtime-input surface

### C. Do not merge app-routing into this shared-family repair

`features/app-routing/compact/staging.summary.md` no longer supports one environment-overblock family.

Its excluded set is already split into:

- `accepted-environment-blocked-frontier`
- `accepted-product-gap-frontier`
- `reviewed-exception-frontier`

The summary explicitly says:

> Resume each preserved frontier only through its own exact owner action, gate change, evidence promotion, or policy repair; do not merge these members back into one environment-shaped compact wait.

Also:

- current tree still has `wait-app-routing-request-shape-run-28698006097-review-20260704`, but that only covers the older repaired four-spec request-shape successor run
- prior compact normalization evidence (`normalize-compact-package-partial-mixed-frontiers-20260707.md`) already concluded that app-routing lacks one truthful exact compact holder now and should not be treated as one environment-shaped family

#### app-routing judgment

Do **not** preserve or recreate app-routing as an environment-overblock shared family in this repair.

If planner needs a compact-facing holder later, it should be a **mixed residual frontier holder with non-environment wording**, not a shared westus2/capability/environment family wait.

## Why these families should stay separate

### westus2 capacity

- real shared external cause
- already represented by project wait `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`
- compact app-monitoring already points at it

### gpu classic SKU support

- real shared external cause for classic GPU members
- already represented by `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`

### underlay/runtime-input

- real shared external cause for gpu VM prerelease provisioner and other underlay-dependent families
- already represented by `wait-spec-network-cni-cilium-enterprise-addon-underlay-kubeconfig-response-20260630`

### auth capability family

For comparison, `wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704` is already a truthful shared capability family. It should **not** absorb gpu/app-routing/westus2 blockers because those causes and resume conditions are materially different.

## Concrete planner/app-ops proposal

### Replace / narrow

1. In compact-facing runtime projection, replace `hold-compact-gpu-package-partial-frontier` with explicit exact references to:
   - `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`
   - `wait-spec-network-cni-cilium-enterprise-addon-underlay-kubeconfig-response-20260630`

### Keep

2. Keep `wait-shared-westus2-managed-cluster-capacity-family-return-20260703` as the single shared westus2 family wait for compact `app-monitoring` and its other currently named branches.

### Do not merge

3. Do not fold `app-routing` into the westus2 family, the gpu family, or a new generic compact environment-overblock family.
4. Do not create a new umbrella compact family across app-routing + gpu + westus2/capability noise; that would hide different owners, different resume conditions, and different fallback paths.

## Truthful before/after representation

### Before

- `app-routing` looked like a compact package-partial holder and was easy to misread as environment-shaped noise
- `gpu` looked like one generic compact package-partial/environment holder
- `app-monitoring` already had a truthful project-level westus2 shared wait

### After this proposal

- `app-monitoring` remains on **one exact shared westus2 family wait**
- `gpu` resolves into **two exact shared waits**, one per real external cause
- `app-routing` is explicitly excluded from this shared-family repair and must use **mixed frontier wording**, not environment-overblock wording

## Reviewer-ready summary

The highest-value reduction in this batch is **gpu**: the generic compact overblock holder is no longer truthful and should be replaced by two exact existing waits. `app-monitoring` is already correctly reduced to the westus2 shared family. `app-routing` should not be forced into this family because its current compact residue is a mixed split frontier, not one shared environment blocker.
