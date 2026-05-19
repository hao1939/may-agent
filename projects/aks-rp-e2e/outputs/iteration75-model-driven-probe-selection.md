# Iteration 75 — Model-driven next-probe selection

**Created:** 2026-05-19  
**Scope:** local/model strategy only. No staging, `az`, cluster creation, or cloud probe was run.  
**Primary inputs:** `outputs/e2e-capability-model.json`, `outputs/input-expectation-knowledge-map.md`, `outputs/aks-public-api-scenario-candidates.md`, `outputs/iteration74-node-restriction-source-spec-resolution.md`, and `outputs/e2ev3-handwritten-coverage-inventory.md`.

## 1. Validator / model summary

Validator command run:

```bash
cd /app/projects/aks-rp-e2e/capability-model
bun src/validate.ts ../outputs/e2e-capability-model.json
```

Exit: `0`.

Important validator summary:

```json
{
  "input": { "variables": 35, "paths": 10000, "truncated": true },
  "expectation": { "variables": 62, "paths": 10000, "truncated": true },
  "uncoveredFeatureIds": [],
  "failingFeatureIds": [
    "app-routing-default-domain",
    "paf-throttling",
    "managedsystem-pool-cli-create-cluster",
    "managedsystem-pool-cli-add-existing",
    "virtualmachines-agentpool-cli-add-multi-sku",
    "app-routing-default-domain-tls-secret"
  ],
  "unknownFeatureIds": [
    "workload-autoscaler-keda-runtime",
    "workload-autoscaler-keda-crud",
    "workload-autoscaler-vpa-runtime",
    "image-cleaner-runtime-lifecycle",
    "node-restriction-disable-contract",
    "workload-identity-runtime-token-projection",
    "oidc-issuer-default-enabled-runtime",
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

Note: the exact first-step Python snippet in the handoff assumes `judgments` is a dictionary; the current model has `judgments` as a list. The failure mode was local-only (`AttributeError: 'list' object has no attribute 'get'`), and the validator is the authoritative current summary above.

## 2. Ranking criteria

I ranked candidate probes by:

1. **Coverage density:** number and importance of failing/unknown features resolved per cluster/run.
2. **Source/spec clarity:** whether handwritten e2ev3 intent, public docs, and public API shape already define expected behavior.
3. **Existing evidence leverage:** whether prior probes already proved prerequisite ARM state so runtime probing is not starting cold.
4. **Execution cost/risk:** expected cluster count, feature gates/preview dependencies, runtime wait time, and risk of repeating a known dead-end without a new hypothesis.
5. **Uncertainty reduction:** whether the result would change the capability model in a durable way, rather than just duplicate existing state evidence.

## 3. Ranked next-probe matrix

| Rank | Candidate next probe | Feature IDs covered | Input paths covered | Expectation paths covered | Source/docs/spec anchors | Existing evidence links | Cost / risk | Expected uncertainty reduction | Priority rationale |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | **Workload Identity + OIDC runtime token/discovery probe** | `workload-identity-runtime-token-projection`; `oidc-issuer-default-enabled-runtime` or `oidc-issuer-v133-explicit-enable-runtime`; reinforces `workload-identity-public-api-create` and `workload-identity-public-api-idempotent-update` | `identity.oidcIssuer.enabled=true`; `identity.workloadIdentity.enabled=true`; `identity.operation=create-time-enable` plus idempotent update; `identity.runtime.os=linux` first, optionally `both`; one selected `identity.kubernetesVersion.branch` | OIDC discovery reachable; JWKS valid; issuer URL usable; Linux projected token/env present; optional Windows token projection; disable/re-enable persistence if time allows; document deletion only if teardown validation is practical | Handwritten `Scenario_WorkloadIdentity`, `Scenario_OIDC_Issuer`, `Scenario_OIDC_Issuer_v133`; public docs for AKS workload identity and OIDC issuer; public spec `ManagedClusterSecurityProfile.workloadIdentity` and `oidcIssuerProfile` | `outputs/iteration60-workload-identity-staging.md` proves create/update state; `outputs/e2ev3-handwritten-coverage-inventory.md` records runtime-token/JWKS intent | **Medium.** One cluster; Linux runtime is moderate. Windows pool, version-specific default branch, signing-key rotation, and post-delete document checks increase cost and can be scoped as non-goals for the first pass. | **High.** Converts state-only identity evidence into runtime trust-chain evidence and closes multiple source-derived unknowns with strong public contract anchors. | Highest value-per-run because public API state already passes, handwritten intent is clear, and a minimal runtime probe can validate OIDC discovery + workload token projection without relying on known-broken TLS or high-cost ACR/network-isolated flows. |
| 2 | **Combined KEDA/VPA runtime probe** | `workload-autoscaler-keda-runtime`; `workload-autoscaler-keda-crud`; `workload-autoscaler-vpa-runtime`; reinforces `workload-autoscaler-keda-profile-state` and `workload-autoscaler-vpa-profile-state` | `workloadAutoScalerProfile.keda.enabled=true`; `workloadAutoScalerProfile.verticalPodAutoscaler.enabled=true`; create or update existing small cluster; optional KEDA disable/re-enable branch | KEDA resources present; KEDA workload scaled; KEDA resources absent after disable/re-enable; VPA Helm/components ready; VPA recommendations generated; in-place update observed if supported; HA/cert behavior only if version branch supports it | Handwritten `Scenario_Keda`, `Scenario_Keda_CRUD`, `Scenario_Overlay_VPA_*`; public docs for AKS KEDA and VPA; public spec `ManagedClusterWorkloadAutoScalerProfile.keda` and `.verticalPodAutoscaler` | `outputs/iteration61-workload-autoscaler-staging.md` proves profile persistence only; inventory explains runtime assertions | **Medium-high.** One cluster can cover KEDA and VPA, but workload timing and VPA recommendation/in-place behavior can be slow/flaky. Disable/re-enable adds LRO churn. | **High.** Upgrades two API-state-only passes into runtime/controller evidence and validates autoscaler add-ons as real workload behavior. | Dense and model-aligned, but ranked below identity because VPA recommendation/in-place timing is more variable and the minimal first pass needs careful scoping to avoid an oversized run. |
| 3 | **App Routing DefaultDomainCertificate TLS failure follow-up, source-hypothesis gated** | `app-routing-default-domain-tls-secret`; `app-routing-default-domain-tls-lifecycle`; relates to failing `app-routing-default-domain` | `addon.appRouting.enabled=true`; `appRouting.route.kind=default-domain`; `appRouting.controller.kind=nginx-ingress`; `appRouting.tls.lifecycle=initial-cert` first, not rotation; `tls.secret.provided=true` via `DefaultDomainCertificate` target secret | `tls.secret.provisioned=true`; CR `Available=True`; served cert is not nginx fake fallback; hostname/expiry valid; HTTPS 200 with managed cert | Handwritten `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld`; default-domain TLS steps in App Routing e2ev3 source; public App Routing docs; prior source-inventory TLS lifecycle mapping | `outputs/iteration68-app-routing-defaultdomain-staging.md` API/state pass; `outputs/iteration69-app-routing-defaultdomain-traffic-staging.md` HTTP/DNS pass; `outputs/iteration70-app-routing-defaultdomain-tls-staging.md` reproduces missing TLS secret and fake fallback cert; older `outputs/e2e-run-results-summary.md` has related standalone failure | **Medium execution, high repeat-risk.** A blind rerun likely repeats iteration70. Must first identify controller precondition/log/source hypothesis or owner signal. | **High if hypothesis-driven; low if blind.** Could turn the clearest known failing runtime path into root-cause evidence, but only after source/owner narrowing. | The most important failing product/controller gap, but not the top immediate cloud probe because iteration70 already proved the failure. Next execution should be gated on a concrete hypothesis, e.g., required labels, controller RBAC, secret namespace, CR spec shape, or service log evidence. |
| 4 | **Node Restriction corrected full PUT disable contract + runtime default probe** | `node-restriction-disable-contract`; `node-restriction-runtime-default`; avoids over-interpreting `node-restriction-tag-only-patch-shape` | `securityProfile.nodeRestriction.enabled=true/auto`; `securityProfile.nodeRestriction.operation=create-or-update-put`; separate `runtime-default` observation for k8s >= 1.24 RBAC | Full PUT create/update accepts explicit enabled; full PUT disable rejects with `Node restriction is required`; final state remains enabled; runtime admission plugin enabled for >=1.24/RBAC even if ARM profile is omitted | Handwritten `Node_Restriction`; RP validator/source findings in `iteration74-node-restriction-source-spec-resolution.md`; public spec contains `ManagedClusterSecurityProfile.nodeRestriction`; docs for Node Restriction | `outputs/iteration62-security-profile-staging.md` is now classified as invalid tag-only PATCH evidence for this contract; `outputs/iteration74-node-restriction-source-spec-resolution.md` resolves operation-shape contradiction | **Low-medium.** One small RBAC cluster and full ManagedCluster PUT round-trip; risk is SDK/full-PUT payload complexity and avoiding accidental destructive field drift. | **Medium-high.** Resolves a precise unknown with strong source contract, but covers fewer areas than identity/autoscaler and needs careful PUT hygiene. | Important because the previous model had a false contradiction. Ranked lower because it is a single-feature contract and the model already knows the PATCH path is irrelevant. |
| 5 | **Image Cleaner runtime erasure/lifecycle probe** | `image-cleaner-runtime-lifecycle`; reinforces `image-cleaner-state-interval` | `securityProfile.imageCleaner.enabled=true`; interval branch such as `168` then `42`; disable/re-enable lifecycle | Image Cleaner components present when enabled; absent after disable; vulnerable image remains while disabled; vulnerable image removed after enable/eraser completion; interval persists; optional restart/upgrade survival | Handwritten `Scenario_ImageCleaner`; public Image Cleaner docs; public spec `ManagedClusterSecurityProfile.imageCleaner` | `outputs/iteration62-security-profile-staging.md` proves state/interval only; inventory records erasure/runtime intent | **Medium-high.** Requires creating a vulnerable-image workload and waiting for eraser scheduling/completion; upgrade/restart should be non-goals for first pass. | **Medium-high.** Converts a security-profile state pass into actual security behavior evidence. | Valuable security runtime check, but slower and less dense than identity/autoscaler. Best first scope is enable/disable/components + one erasure, not full upgrade/restart lifecycle. |
| 6 | **ManagedSystem runtime restrictions + disable migration probe** | `managedsystem-runtime-restrictions`; `managedsystem-disable-migration`; reinforces `managedsystem-pool-standalone-e2ev3`, `managedsystem-pool-rest-add-existing`, `managedsystem-pool-delete-existing` | `agentPool.kind=managedsystem`; `managedSystem.runtime.validation=taints-critical-addons-vap-unschedulable`; `managedSystem.disable.operation=delete-pool-migrate-to-system`; minimal REST request shape | ManagedSystem taints present; critical add-ons placed/affinitized; VAP/VAPBinding present; customer workload unschedulable; delete accepted; workloads/system components migrate back to System pool | Handwritten `Scenario_ManagedSystemPool_Enable`, `Scenario_ManagedSystemPool_Disable`, `Scenario_ManagedSystem_AgentPool`; ManagedSystem worked boundary in knowledge map | `outputs/iteration24-managedsystem-pool-pass.md` standalone pass; `outputs/iteration56-managedsystem-staging-refresh.md` and `outputs/20260519T1646Z-managedsystem-priority-staging.md` REST add/delete/state pass and CLI failures | **Medium-high.** Needs ManagedSystem-capable cluster and runtime Kubernetes assertions; create-time initial-pool branch may be separate from add-existing branch. | **Medium.** Deepens the project’s worked example from ARM state into runtime safety and migration behavior. | High thematic value, but much ManagedSystem evidence already exists; the next run should diversify unless ManagedSystem remains the explicit program priority. |
| 7 | **Machines API + NAP default Machines cleanup probe** | `machines-agentpool-api-crud`; `machines-agentpool-nap-default-pool-cleanup`; reinforces `node-autoprovision-create-auto`, `node-autoprovision-update-default-pools-none`, `node-autoprovision-update-mode-manual` | `nodeProvisioning.mode=Auto`; `nodeProvisioning.defaultMachinesPool=present`; `agentPool.mode=Machines`; `machinesApi.operation=create-get-update-list-delete`; update NAP to Manual | Default `aksmanagedap` Machines pool exists; Machine CRUD succeeds; unsupported UltraSSD rejected; update to Manual succeeds; default Machines pool/nodes deleted | Handwritten `Scenario_MachinesAgentPool` and `Scenario_MachinesAgentPoolNAPEnabled`; public NAP docs/spec; Machines API e2ev3 source | `outputs/iteration57-node-autoprovision-staging.md` and `outputs/iteration58-node-autoprovision-followup.md` prove NAP profile transitions only; VM pool evidence in iterations64-66 is adjacent | **High.** Preview/dev API shape, Karpenter/default pool manipulation, and Machines API calls raise setup risk. | **High but risky.** Would bridge NAP state to real Machines resources and cleanup, a dark region of the map. | Dense and strategically interesting, but ranked lower because execution prerequisites are less public/stable than identity/autoscaler and failure classification may be setup-heavy. |
| 8 | **Bootstrap Profile managed/BYO ACR lifecycle probe** | `bootstrap-profile-managed-acr-lifecycle`; `bootstrap-profile-byo-acr-lifecycle`; reinforces Direct/Cache state features | `bootstrapProfile.artifactSource=Cache`; `bootstrapProfile.registry.kind=aks-managed-acr` and/or `byo-acr`; `bootstrapProfile.lifecycle.operation=cache-reenable` or `switch-registry` | Cache state persists; containerRegistryId present or matches BYO; image pull succeeds; Direct disable clears registry ID; managed registry resources cleaned; Cache re-enable/switch works | Handwritten `Scenario_NetworkIsolatedCluster_Bootstrap_Profile_Managed_ACR` and `BYO_ACR`; public/spec `bootstrapProfile.artifactSource` | `outputs/iteration63-bootstrap-profile-staging.md` proves Direct/Cache API state and AKS-provisioned registry ID only | **High.** Network-isolated setup, ACR creation/role assignment, image-pull validation, cleanup verification. BYO path adds external resource cost. | **Medium-high.** Converts state into artifact-source runtime/lifecycle evidence and tests BYO boundary. | Good model gap but expensive; should follow a lighter high-density runtime probe unless network-isolated/bootstrap is the project priority. |
| 9 | **App Routing Istio default-domain Gateway API probe** | `app-routing-default-domain-istio`; likely depends on `app-routing-default-domain-tls-secret` if TLS secret shared | `addon.appRouting.enabled=true`; `appRouting.route.kind=default-domain`; `appRouting.controller.kind=istio-gateway-api`; `appRouting.tls.lifecycle=initial-cert`; Gateway + HTTPRoute | Default domain configured; TLS secret provisioned; Gateway reachable; DNS resolves; HTTPS/HTTP 200; optional post-upgrade reachability | Handwritten `Scenario_Traffic_AppRouting_DefaultDomain_Istio_HelloWorld`; App Routing/Istio/Gateway API source; public App Routing docs where available | No direct staging evidence; shares API/default-domain prerequisites with iterations68-70 | **High.** Preview feature prerequisites and likely dependency on the same TLS-secret provisioning path that currently fails. | **Medium.** Adds an unmodeled controller branch, but a failure may only reproduce the known TLS blocker. | Required candidate but lower priority until the nginx DefaultDomainCertificate failure is understood; otherwise it may add a second failing symptom without root cause. |
| 10 | **VirtualMachines mixed-SKU REST scale / autoscaled VMs CRUD follow-up** | `virtualmachines-mixed-sku-rest-scale`; `virtualmachines-autoscaled-vms-crud`; relates to failing `virtualmachines-agentpool-cli-add-multi-sku` | `agentPool.kind=virtualmachines`; `agentPool.operation=update-existing-pool`; manual multiple single-SKU profiles; autoscale profile transitions | Manual scale profile arrays persist; node counts match expected profiles; autoscale updates persist; upgrade succeeds if included | Handwritten `Scenario_Mixed_SKU_Scale` and `Scenario_Autoscaled_VMs_CRUD`; public agent pool spec `virtualMachinesProfile`; prior CLI-help mismatch classification | `outputs/iteration64-virtualmachines-agentpool-staging.md`; `outputs/iteration65-virtualmachines-multisku-contract.md`; `outputs/iteration66-virtualmachines-manual-scale-staging.md` | **Medium.** Existing staging evidence reduces risk, but REST multi-step scale validation needs time and node churn. | **Medium.** Clarifies REST/product contract behind misleading CLI multi-SKU help. | Useful but lower priority because VM profile boundaries are already relatively well classified compared with runtime identity/autoscaler/security gaps. |

## 4. Final recommended next probe

**Recommended next cloud probe after this planning iteration:** **Workload Identity + OIDC runtime token/discovery probe**.

### Intended coverage

Use one staging cluster to move identity from API-state evidence to runtime trust-chain evidence:

- Create or update a small managed-identity cluster with:
  - `identity.oidcIssuer.enabled=true`
  - `identity.workloadIdentity.enabled=true`
  - public CLI/API path already proven in `outputs/iteration60-workload-identity-staging.md`
- Capture ARM state:
  - `oidcIssuerProfile.enabled=true`
  - non-empty issuer URL
  - `securityProfile.workloadIdentity.enabled=true`
- Runtime checks:
  - OIDC discovery document reachable from the issuer URL.
  - JWKS document reachable and structurally valid.
  - A minimal Linux pod with federated/service-account setup receives projected token/env required by workload identity.
- Optional stretch only if the first pass is stable:
  - idempotent update after runtime validation.
  - disable/re-enable state and re-run Linux token projection.
  - Windows token projection with a Windows node pool.

### Feature IDs expected to move

- Primary: `workload-identity-runtime-token-projection` from `unknown` to pass/fail/blocked.
- If the selected Kubernetes version branch matches the source scenario:
  - `oidc-issuer-v133-explicit-enable-runtime`, or
  - `oidc-issuer-default-enabled-runtime`.
- Existing pass features should remain pass with stronger evidence:
  - `workload-identity-public-api-create`
  - `workload-identity-public-api-idempotent-update`

### Non-goals for the first pass

- Do not test Windows token projection unless the Linux and OIDC checks pass quickly.
- Do not test signing-key rotation unless owner/source gives a cheap trigger; it is source-important but not necessary for the first runtime bridge.
- Do not require post-delete issuer document deletion in the first run unless the cluster is already being torn down and the check is cheap.
- Do not combine with KEDA/VPA or App Routing on the same cluster; keep identity failure classification clean.
- Do not use this run to re-open PAF throttling/MSI failures; PAF remains a separate historical failure with different scenario intent.

### Why this is the recommended next probe

This probe has the best balance of density and execution confidence. It closes the largest gap pattern in the model—features that already pass ARM persistence but lack runtime evidence—without depending on the known App Routing TLS failure, high-cost ACR/network-isolated lifecycle, or preview Machines API setup. It is also directly anchored in handwritten e2ev3 source intent and public AKS documentation, so any pass/fail result will update the capability model cleanly rather than creating another operation-shape ambiguity.
