# Iteration 82 — Post-escalation next probe selection

**Date:** 2026-05-20  
**Scope:** local/model selection only. No staging, Azure, cluster, or cloud probe was run in this iteration.  
**Primary inputs:** `outputs/input-expectation-knowledge-map.md`, `outputs/e2e-capability-model.json`, `outputs/iteration81-app-routing-tls-owner-escalation.md`, validator output captured in `/tmp/iteration82-validator.txt`, and prior branch artifacts including `outputs/iteration74-node-restriction-source-spec-resolution.md`, `outputs/iteration78-workload-autoscaler-runtime-staging.md`, and `outputs/iteration79-vpa-runtime-model-split.md`.

## 1. Current model state used for selection

Validator command run first:

```bash
cd /app/projects/aks-rp-e2e/capability-model
bun src/validate.ts ../outputs/e2e-capability-model.json
```

The validator exited `0`. The current non-passing sets are:

```json
{
  "failingFeatureIds": [
    "app-routing-default-domain",
    "paf-throttling",
    "managedsystem-pool-cli-create-cluster",
    "managedsystem-pool-cli-add-existing",
    "virtualmachines-agentpool-cli-add-multi-sku",
    "app-routing-default-domain-tls-secret"
  ],
  "unknownFeatureIds": [
    "workload-autoscaler-keda-crud",
    "workload-autoscaler-vpa-inplace-update-runtime",
    "workload-autoscaler-vpa-ha-leader-election-runtime",
    "workload-autoscaler-vpa-cert-renewal-runtime",
    "workload-autoscaler-vpa-upgrade-survival-runtime",
    "workload-autoscaler-vpa-helm-release-runtime",
    "workload-autoscaler-vpa-runtime",
    "image-cleaner-runtime-lifecycle",
    "node-restriction-disable-contract",
    "workload-identity-runtime-token-projection-windows",
    "workload-identity-disable-reenable-lifecycle",
    "oidc-issuer-default-enabled-signing-key-rotation",
    "oidc-issuer-default-enabled-post-delete-cleanup",
    "oidc-issuer-v133-explicit-enable-runtime",
    "bootstrap-profile-managed-acr-lifecycle",
    "bootstrap-profile-byo-acr-lifecycle",
    "app-routing-default-domain-istio",
    "app-routing-default-domain-tls-lifecycle",
    "managedsystem-runtime-restrictions",
    "managedsystem-disable-migration",
    "virtualmachines-mixed-sku-rest-scale",
    "virtualmachines-autoscaled-vms-crud",
    "machines-agentpool-api-crud",
    "machines-agentpool-nap-default-pool-cleanup",
    "node-restriction-runtime-default",
    "node-restriction-tag-only-patch-shape"
  ]
}
```

`outputs/input-expectation-knowledge-map.md` now separates App Routing default-domain into API/state, HTTP/DNS, CRD, TLS-secret provisioning, and fallback HTTPS sub-paths. `outputs/iteration81-app-routing-tls-owner-escalation.md` gates further App Routing TLS execution.

## 2. App Routing TLS exclusion gate

**Excluded from immediate execution:** `app-routing-default-domain-tls-secret` and App Routing TLS lifecycle follow-ups.

Reason: iteration81's TL;DR verdict says iteration70 used a valid customer-side `DefaultDomainCertificate` CR/input and classifies the branch as a valid-input App Routing default-domain TLS-secret provisioning failure. The diagnostic rerun gate permits a rerun only if it can collect CCP `app-routing-operator` diagnostics and underlay `default-domain-svc` diagnostics, or if an App Routing/default-domain owner supplies a concrete missing precondition, fix, expected operator version, or corrected manifest.

Therefore, no customer-cluster-only rerun of `DefaultDomainCertificate`, `kubectl get secret`, and `curl -k` should be selected while owner/CCP diagnostics are unavailable.

## 3. Candidate ranking

Selection criteria:

1. **Input/expectation density:** how many meaningful input paths and expectation paths can be resolved by one bounded task.
2. **Model feature impact:** how many failing/unknown feature IDs can move to pass/fail/blocked, without hiding branch-specific evidence.
3. **Evidence leverage:** whether existing artifacts already prove prerequisites and isolate the remaining gap.
4. **Cost/risk:** cluster count, runtime wait, full-PUT or resource-drift risk, and likelihood of setup ambiguity.
5. **Access/preconditions:** whether the probe can run with normal staging/customer-cluster access and without App Routing owner diagnostics.
6. **Independence from App Routing:** candidates that can proceed while App Routing TLS waits on owners score higher.

### Ranked matrix

| Rank | Candidate | Input paths covered | Expectation paths checked | Model feature IDs affected | Current evidence | Cost / risk | Required access / preconditions | Independent of App Routing owner diagnostics? | Selection rationale |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | **Node Restriction corrected full-PUT disable contract + runtime-default probe** | `securityProfile.nodeRestriction.enabled=true`; full ManagedCluster `create-or-update-put`; explicit follow-up full PUT with `enabled=false`; separate omitted/auto profile runtime-default path for RBAC Kubernetes `>=1.24` | Explicit enable accepted/preserved when preconditions hold; full PUT disable rejected with `Node restriction is required on version 1.24.0 or above`; runtime admission plugin enabled for RBAC `>=1.24` even if ARM profile is omitted/null | `node-restriction-disable-contract`; `node-restriction-runtime-default`; keeps `node-restriction-tag-only-patch-shape` as non-contract operation-shape evidence | `iteration62-security-profile-staging.md` showed PATCH/null ambiguity; `iteration74-node-restriction-source-spec-resolution.md` resolved that PATCH is tag-only/irrelevant and source validates full PUT semantics; model now has branch-specific unknowns | **Low-medium.** One small RBAC cluster plus careful full ManagedCluster GET/PUT round trip. Main risk is full-PUT payload hygiene and avoiding accidental field drift; runtime admission inspection may need a reliable signal. | Staging ARM access; ability to create a small RBAC cluster or use an existing suitable cluster; full ManagedCluster PUT tooling; runtime kube-apiserver/admission-plugin evidence path or owner-approved equivalent. | **Yes.** No dependency on App Routing, default-domain, CCP App Routing operator, or underlay TLS service. | Best immediate value after TLS escalation: source-resolved, non-blocked, comparatively cheap, and fixes a known misleading evidence gap. It turns a prior false contradiction into a clean public API/runtime boundary. |
| 2 | **Focused VPA residual runtime probe** | `workloadAutoScalerProfile.verticalPodAutoscaler.enabled=true`; VPA workload with update mode that can exercise in-place/resource update; same-cluster inspection of Helm release metadata and HA/leader-election | `vpa.inplaceUpdate.observed=true`; `vpa.helmRelease.present=true`; `vpa.haLeaderElection.valid=true`; retain component/recommendation readiness as prerequisite, not the main verdict | `workload-autoscaler-vpa-inplace-update-runtime`; `workload-autoscaler-vpa-helm-release-runtime`; `workload-autoscaler-vpa-ha-leader-election-runtime`; possibly informs legacy roll-up `workload-autoscaler-vpa-runtime` | `iteration78-workload-autoscaler-runtime-staging.md` already passed VPA CRDs/webhook/deployments/recommendations with `updateMode=Off`; `iteration79-vpa-runtime-model-split.md` made residual branches explicit | **Medium.** One cluster, but VPA timing and in-place update support/version gates can be slow or inconclusive. Cert renewal and upgrade survival should stay out of scope. | Staging cluster with VPA enabled; workload manifests; `kubectl` access; ability to inspect Helm metadata/leader-election resources. | **Yes.** No App Routing dependency. | Highest multi-feature runtime density, but ranked below Node Restriction because it is slower and more timing-sensitive. Best if the project wants to continue autoscaler runtime depth rather than close the security-profile operation-shape gap. |
| 3 | **KEDA disable/re-enable CRUD lifecycle** | `workloadAutoScalerProfile.keda.enabled=true`; update/disable KEDA; update/re-enable KEDA; optionally reuse a minimal KEDA ScaledObject after re-enable | KEDA resources present when enabled; KEDA resources absent after disable; KEDA resources restored after re-enable; optional scaling still works after re-enable | `workload-autoscaler-keda-crud`; reinforces already-passed `workload-autoscaler-keda-runtime` only if optional post-reenable scaling is included | `iteration61-workload-autoscaler-staging.md` passed profile persistence; `iteration78-workload-autoscaler-runtime-staging.md` passed CRD/controller/APIService readiness and cron ScaledObject scale up/down; CRUD was an explicit non-goal | **Low-medium.** One cluster and LRO churn. Risk is cleanup wait/resource disappearance timing, but less ambiguous than VPA in-place behavior. | Staging cluster with KEDA enabled; ARM/CLI update access; `kubectl` access to confirm resources absent/present. | **Yes.** No App Routing dependency. | Scores above Image Cleaner because the runtime prerequisite already passed and the remaining CRUD expectation is narrow. It covers fewer model IDs than VPA and less source-correction value than Node Restriction. |
| 4 | **Image Cleaner runtime lifecycle probe** | `securityProfile.imageCleaner.enabled=true`; interval branch such as `168` or existing public CLI interval; disable/re-enable; vulnerable/unused image workload if practical | Image Cleaner components present; components absent after disable; vulnerable/unused image removed after enable/eraser completion; interval persists; upgrade/restart survival should be a later branch | `image-cleaner-runtime-lifecycle`; reinforces iteration62 API-state pass | `iteration62-security-profile-staging.md` passed update/persisted state for Image Cleaner; handwritten inventory/model describes broader runtime erasure and lifecycle contract | **Medium-high.** Erasure scheduling can be slow; vulnerable-image setup and proof of deletion are more brittle than KEDA resource toggling. Upgrade/restart survival should be excluded from a first pass. | Staging cluster; image-cleaner enablement; workload/image setup; enough wait time or controller signal for eraser completion. | **Yes.** No App Routing dependency. | Valuable security-runtime coverage, but more wait/flakiness than KEDA and less source-resolved than Node Restriction. Good follow-up after the lower-cost security-profile contract is closed. |
| 5 | **ManagedSystem runtime restrictions / disable migration** | `agentPool.kind=managedsystem`; runtime validation of taints, critical add-on placement, VAP/VAPBinding, customer workload scheduling; optional delete/migrate branch | ManagedSystem taints present; critical add-ons placed/affinitized; VAP present; customer workload unschedulable; disable/delete migrates system components back safely | `managedsystem-runtime-restrictions`; `managedsystem-disable-migration`; reinforces REST add/delete passes and CLI failure boundary | `iteration24-managedsystem-pool-pass.md` standalone pass; `iteration56-managedsystem-staging-refresh.md` and `20260519T1646Z-managedsystem-priority-staging.md` passed direct REST add/delete and preserved CLI default-field failures | **Medium-high.** Needs ManagedSystem-capable cluster and runtime assertions; much of the API boundary is already known. | Staging with ManagedSystem support; REST add path; `kubectl` access for system-addon placement/scheduling checks. | **Yes.** No App Routing dependency. | Strong thematic value for the project's worked example, but less urgent now because REST/state/delete evidence is fresh and the highest remaining ManagedSystem public failures are CLI/tooling default-payload issues, not runtime product ambiguity. |

## 4. Deprioritized failing/unknown branches

- **App Routing TLS / TLS lifecycle / Istio default-domain:** explicitly owner/diagnostic-gated by iteration81. A rerun without CCP `app-routing-operator` and underlay `default-domain-svc` diagnostics is not useful.
- **ManagedSystem CLI create/add failures:** current evidence classifies these as CLI preview default-field payload behavior while direct REST add/delete passes. A source/CLI handoff task may be useful, but it is not the best next cloud probe.
- **VirtualMachines multi-SKU CLI add failure:** iterations64-66 already split supported single-SKU/manual-profile behavior from misleading multi-SKU CLI help. Further REST scale work is useful but lower impact than the remaining security/autoscaler unknowns.
- **Bootstrap Profile managed/BYO ACR lifecycle:** high-value but higher-cost network-isolated/ACR setup, image-pull, and cleanup work. Prefer after a lighter non-blocked branch.
- **Machines API / NAP default Machines cleanup:** dense but preview/dev API setup risk is higher than Node Restriction/KEDA/VPA.
- **Identity/OIDC residuals:** Linux/default-discovery runtime passed in iterations76-77. Windows parity, key rotation, delete cleanup, and v1.33 explicit-enable remain useful but are not the highest-value immediate post-TLS pivot.

## 5. Recommended next task

**Recommendation:** execute **Node Restriction corrected full-PUT disable contract + runtime-default probe** next.

Proposed task contract:

1. Create or select a small staging RBAC cluster on Kubernetes `>=1.24`.
2. Use the correct ManagedCluster full `PUT`/create-or-update operation shape, not tag-only PATCH.
3. For explicit profile contract:
   - create or update with `securityProfile.nodeRestriction.enabled=true`;
   - GET and record whether ARM returns the explicit profile;
   - full PUT the returned ManagedCluster with `securityProfile.nodeRestriction.enabled=false`;
   - expect HTTP `400`/BadRequest with message containing `Node restriction is required on version 1.24.0 or above`;
   - confirm the final state remains enabled or not disabled.
4. For runtime-default contract:
   - on a RBAC `>=1.24` cluster where the ARM profile may be omitted/null, inspect the most reliable available runtime signal that the `NodeRestriction` admission plugin is enabled.
5. Record the result in a new execution artifact and update `outputs/e2e-capability-model.json` to move `node-restriction-disable-contract` and/or `node-restriction-runtime-default` from `unknown` to the observed verdict.

Non-goals for that task:

- Do not retry the iteration62 PATCH shape; it is intentionally modeled as `node-restriction-tag-only-patch-shape`, not the product contract.
- Do not combine with App Routing TLS, KEDA/VPA, or Image Cleaner on the same run; keep failure classification clean.
- Do not run cloud work until the full-PUT payload hygiene and runtime admission evidence method are written down.

## 6. Needed model / knowledge-map update

No JSON capability-model update is needed in this selection-only iteration; the validator already exposes Node Restriction, KEDA CRUD, VPA residuals, and Image Cleaner runtime lifecycle as first-class unknown features.

One knowledge-map cleanup is advisable before or alongside the next execution artifact: the feature-matrix rows for Image Cleaner and Node Restriction still contain older prose such as "not first-class in JSON model" and the iteration62 PATCH as a direct fail/unpersisted signal. The newer model and `outputs/iteration74-node-restriction-source-spec-resolution.md` supersede that wording. Updating those rows would reduce future selection ambiguity, but it is not a blocker for the recommended Node Restriction full-PUT/runtime-default probe.
