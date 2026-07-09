# Compact environment-overblock family classification (2026-07-09)

- Task: `ops-classify-compact-environment-overblock-family-20260709`
- Attempt: `a_ops-classify-compact-environment-overblock-family-20260709_20260709092354`
- Mode: Task Worker Mode
- Runtime tree mutation from this worker: none
- Output purpose: planner/app-ops review material for exact compact warning-family reduction

## Executive verdict

The current compact `environment-overblock` warning family is still broader than the real blocked frontier.

Using the live planner warning packet plus current compact summaries, the smallest truthful families are:

1. **Existing exact wait already available; duplicate compact holder should be retired/rebound**
   - `hold-compact-egress-lockdown-package-partial-frontier-202607090915`
   - `hold-compact-node-http-proxy-package-partial-frontier-202607090544`

2. **Existing exact wait semantics are correct, but the live wait is missing and needs one exact refresh/restore before the duplicate compact holder can be retired**
   - `hold-compact-jwt-authenticator-package-partial-frontier`

3. **Mixed-frontier compact holders that should stay as single mixed holders, not merge into an environment family**
   - `hold-compact-app-routing-package-partial-frontier-202607090657`
   - `hold-compact-aad-rbac-package-partial-frontier`
   - `hold-compact-gpu-package-partial-frontier`

4. **Single-feature exact frontiers that should stay feature-specific, not merge into an environment family**
   - `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`
   - `hold-compact-machines-agentpool-package-partial-frontier-202607090638`

5. **Already-collapsed shared reviewed-exception/live-ready-policy family that should remain the one carrier**
   - `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
   - covers `ccp-coredns`, `planned-maintenance`, `ossku-migration`, and only the reviewed-exception siblings of `machines-agentpool`

So the truthful next planner action is **not** one umbrella compact environment wait. It is:

- retire/rebind the duplicate compact holders for `egress-lockdown` and `node-http-proxy`,
- refresh one exact shared jwt-authenticator wait and then retire its duplicate compact holder,
- keep `app-routing`, `aad-rbac`, `gpu`, `cluster-autoscaler`, and `machines-agentpool` as their own exact mixed/singleton frontiers.

## Sources reviewed

- `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
- `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
- `/app/projects/aks-rp-e2e/features/app-routing/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/features/cluster-autoscaler/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/features/egress-lockdown/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/features/machines-agentpool/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/features/aad-rbac/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/features/gpu/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/features/node-http-proxy/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-audit-compact-environment-overblock-warning-family-20260709.md`
- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-reconcile-compact-environment-overblock-family-first-batch-20260709.md`
- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-repair-compact-environment-overblock-family-first-wave-20260709.md`
- live planner packet recompute via `planningPacket(taskTreeConfig(...))`

## Baseline contributor set before this classification

Computed from the current live planner packet as if this worker task did not exist.

### Current compact warning leaves in the live planner packet

The live `planningPacket(...).blocked_action_warnings` currently includes at least these compact `environment-overblock` warnings:

- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-compact-app-routing-package-partial-frontier-202607090657`
- `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`
- `hold-compact-egress-lockdown-package-partial-frontier-202607090915`
- `hold-compact-gpu-package-partial-frontier`
- `hold-compact-jwt-authenticator-package-partial-frontier`
- `hold-compact-machines-agentpool-package-partial-frontier-202607090638`
- `hold-compact-node-http-proxy-package-partial-frontier-202607090544`

The same planner packet also warns on other compact leaves, but the ids above are the current highest-noise `package-partial` slice that most directly overlaps this task's accepted warning-family chain.

## Family classification

## 1) Duplicate compact holders that already have one better exact wait

### 1A. `egress-lockdown`

**Current generic holder**
- `hold-compact-egress-lockdown-package-partial-frontier-202607090915`

**Existing exact wait**
- `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`

### Why these are the same meaning

The current compact holder's blocker text already says:

- reuse `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
- only quarantined member is `spec.egress-lockdown.fips`
- resume only when `AKS_RP_E2E_UDR_NEXT_HOP_IP` and `AKS_RP_E2E_UDR_PREREQ_PROOF` are supplied, or accepted evidence changes the prerequisite contract

The maintained compact summary agrees:

- only `1` selected member remains quarantined
- exact blocker kind is `repo-local-live-ready-filter`
- the same standalone prerequisite contract still governs the truthful next step

### Truthful family classification

This is **not** a compact environment family anymore. It is one exact spec-level prerequisite wait.

### Planner action

- keep `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
- retire or rebind `hold-compact-egress-lockdown-package-partial-frontier-202607090915`
- do not leave both surfaces open

---

### 1B. `node-http-proxy`

**Current generic holder**
- `hold-compact-node-http-proxy-package-partial-frontier-202607090544`

**Current exact live wait**
- `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`

### Why these are the same meaning

The current compact holder says:

- create/update rerun `28673740487` already passed
- the only remaining compact blocker is `spec.node-http-proxy.trusted-ca`
- the truthful next action is owner/runtime-input decision on trusted-ca

The maintained compact summary agrees:

- only `spec.node-http-proxy.trusted-ca` remains quarantined
- create/update authority is already satisfied
- trusted-ca still needs exact proxy + CA inputs or an owner-approved redesign

The live tree already has the sharper human-owned wait:

- `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`

Important note: the current generic holder still mentions the older `...trusted-ca-quarantine-20260702` text in its blocker body, but the live exact wait has already advanced to the owner-decision-return form. So the generic compact holder is not only duplicate; it also points at stale lineage.

### Truthful family classification

This is one exact trusted-ca owner-decision / runtime-input branch, not a broader compact environment family.

### Planner action

- keep `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`
- retire or rebind `hold-compact-node-http-proxy-package-partial-frontier-202607090544`
- do not preserve the stale `...trusted-ca-quarantine-20260702` wording as the live compact surface

## 2) Duplicate compact holder whose exact shared wait semantics are right, but the wait is missing live

### `jwt-authenticator`

**Current generic holder**
- `hold-compact-jwt-authenticator-package-partial-frontier`

**Historically correct exact shared wait**
- `wait-compact-jwt-authenticator-go-e2ev3-egress-gate-20260703`

### What the live state says now

The current compact holder says:

- the only quarantined member is `spec.jwt-authenticator.incluster-idp-dex-lifecycle`
- the exact blocker is the Go e2ev3 `jwt-egress --insecure` gate
- owner should add one exact replacement wait holder instead of leaving a duplicate passive package-partial wait

The live planner packet still warns on `hold-compact-jwt-authenticator-package-partial-frontier`.

A direct live-tree lookup shows `wait-compact-jwt-authenticator-go-e2ev3-egress-gate-20260703` is **not currently present** in `.state/tasks/tree.json`, even though:

- journal history shows it was created on `2026-07-03`
- multiple accepted reviews explicitly relied on it as the single truthful shared holder
- earlier repair/audit tasks said planner should refresh or replace it rather than keep the generic package-partial holder

### Truthful family classification

This is still one exact cross-lane issuer-reachability / Go e2ev3 egress-gate wait. The compact generic holder is only a temporary fallback because the intended exact shared wait is currently absent from live tree state.

### Planner action

Planner/app-ops should do **one** of these, and only one:

1. **restore/refresh** `wait-compact-jwt-authenticator-go-e2ev3-egress-gate-20260703` as the live human-owned exact wait, using the already-accepted send-proof / owner-response semantics from the prior jwt repair chain, then retire `hold-compact-jwt-authenticator-package-partial-frontier`; or
2. replace the current compact generic holder with a new exact human-owned shared wait that preserves the same Go e2ev3 issuer-reachability gate, the sent-owner-proof lineage, and the returned-owner-response resume condition.

Either way, the generic compact package-partial holder should not remain the steady-state carrier.

## 3) Mixed-frontier compact holders that should stay mixed, not collapse

### 3A. `app-routing`

**Current holder**
- `hold-compact-app-routing-package-partial-frontier-202607090657`

The live holder and maintained compact summary agree on the exact split:

- `4` accepted-environment-blocked members
- `1` accepted-product-gap member
- `4` reviewed-exception members

This is already a truthful mixed-frontier compact holder. It is **not** one shared environment blocker.

**Planner action:** keep as one mixed frontier holder; do not force it into a shared environment family wait.

---

### 3B. `aad-rbac`

**Current holder**
- `hold-compact-aad-rbac-package-partial-frontier`

Maintained compact summary shows the residual trio is:

- `spec.aad-rbac.azure-rbac-automatic-sku`
- `spec.aad-rbac.managed-v2-lifecycle`
- `spec.aad-rbac.run-command-access`

These already map to different exact downstream carriers:

- `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
- `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705`
- `hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706`

So aad-rbac is a **1+1+1 mixed frontier**, not one environment family.

**Planner action:** keep as one mixed frontier holder or refresh it to name the three exact represented carriers; do not collapse it into a shared environment wait.

---

### 3C. `gpu`

**Current holder**
- `hold-compact-gpu-package-partial-frontier`

Maintained compact summary shows the remaining two-member split is:

- `spec.gpu.multi-gpu-workload` as reviewed westus2 GPU SKU environment blocker / promotion boundary
- `spec.gpu.vm-prerelease-provisioner-matrix` on the shared underlay/runtime-input side

Existing exact downstream carriers already present are:

- `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`
- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`

So gpu is a **1+1 mixed frontier**, not one environment family.

**Planner action:** keep as one mixed frontier holder or refresh it to name the two exact represented carriers; do not collapse it into a shared environment wait.

## 4) Single-feature exact frontiers that should stay feature-specific

### 4A. `cluster-autoscaler`

**Current holder**
- `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`

Maintained compact summary says the remaining truth is one exact seven-member accepted-environment-blocked frontier.

This is already a feature-specific exact frontier, not a cross-feature family.

**Planner action:** keep this one distinct. No truthful consolidation into a broader environment family is available.

---

### 4B. `machines-agentpool`

**Current holder**
- `hold-compact-machines-agentpool-package-partial-frontier-202607090638`

The current blocker text preserves one exact same-spec frontier around run `28809049156` for `spec.nap.default-machines-pool-cleanup-no-machine-crud` and explicitly says the older generic package-partial wording broadened the truth.

Important note: the blocker body still references `wait-compact-machines-agentpool-run-28809049156-review-20260707`, but that id is not currently present in the live tree. Unlike jwt-authenticator, the current live holder itself already carries the sharpened same-spec meaning, so this is **not** the best family-collapse target in this pass.

**Planner action:** keep `machines-agentpool` separate from any shared family wait. If planner wants cleanup, do it as exact text/linkage repair, not by merging it into a broader environment family.

## 5) Shared family already reduced correctly

### `wait-compact-reviewed-exception-live-ready-policy-family-20260702`

This remains the correct shared carrier for:

- `ccp-coredns`
- `planned-maintenance`
- `ossku-migration`
- only the reviewed-exception siblings of `machines-agentpool`

Current live wait text already says exactly that, and earlier accepted first-wave repair memos already used this family to retire duplicate passive holders.

**Planner action:** preserve this wait as-is; do not fold unrelated mixed-frontier or same-spec families back into it.

## Highest-noise package-partial family and exact action

The highest-noise family in the current live warning set is:

### **generic compact package-partial holders whose own blocker text already points at a sharper exact wait**

Current members:

- `hold-compact-egress-lockdown-package-partial-frontier-202607090915`
- `hold-compact-node-http-proxy-package-partial-frontier-202607090544`
- `hold-compact-jwt-authenticator-package-partial-frontier`

### Why this is the highest-noise family

All three currently trigger `environment-overblock`, but none is really an unresolved broad environment family:

- `egress-lockdown` already collapses to one exact spec-level prerequisite wait
- `node-http-proxy` already collapses to one exact trusted-ca owner-decision wait
- `jwt-authenticator` still wants one exact shared egress-gate wait, but that wait has fallen out of the live tree and needs refresh/restore

So these three are the clearest remaining cases where planner can remove duplicate passive compact holders **without** reopening execution and **without** inventing a new family.

### Exact planner/app-ops action for this highest-noise family

1. retire/rebind `hold-compact-egress-lockdown-package-partial-frontier-202607090915` to `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
2. retire/rebind `hold-compact-node-http-proxy-package-partial-frontier-202607090544` to `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`
3. refresh/restore one exact jwt-authenticator shared wait using the accepted `wait-compact-jwt-authenticator-go-e2ev3-egress-gate-20260703` semantics, then retire `hold-compact-jwt-authenticator-package-partial-frontier`

## Post-action represented set if planner applies this memo

### Keep as exact mixed/singleton frontiers

- `hold-compact-app-routing-package-partial-frontier-202607090657`
- `hold-compact-aad-rbac-package-partial-frontier` (preferably refreshed to cite its three exact carriers)
- `hold-compact-gpu-package-partial-frontier` (preferably refreshed to cite its two exact carriers)
- `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`
- `hold-compact-machines-agentpool-package-partial-frontier-202607090638`
- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`

### Replace duplicate passive holders

- replace `hold-compact-egress-lockdown-package-partial-frontier-202607090915` with `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
- replace `hold-compact-node-http-proxy-package-partial-frontier-202607090544` with `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`
- replace `hold-compact-jwt-authenticator-package-partial-frontier` with refreshed/restored exact shared jwt-authenticator egress-gate wait semantics

## Net result

The compact environment-overblock warning family becomes smaller and more truthful if planner treats it as:

- **three duplicate-passive-holder replacements** (`egress-lockdown`, `node-http-proxy`, `jwt-authenticator`),
- **three mixed-frontier singletons** (`app-routing`, `aad-rbac`, `gpu`),
- **two exact feature frontiers** (`cluster-autoscaler`, `machines-agentpool`),
- plus the **already-correct shared reviewed-exception family wait**.

That preserves exact meaning and reduces warning-family noise without reopening unchanged compact reruns.

## Worker-mode note

I did not mutate the runtime task tree from this session. Under Task Worker Mode, this file is planner/app-ops review material naming the exact current family classification and the exact replacements the planner should apply.