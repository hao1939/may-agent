# AKS input/expectation knowledge map

**Iteration:** 71  
**Created:** 2026-05-19  
**Source model:** `outputs/e2e-capability-model.json` (`updatedAt=2026-05-19T19:05:00Z`)  
**Model-change note:** this artifact is a consolidation map only. I did **not** change `outputs/e2e-capability-model.json`; therefore no validator run was required for this iteration. One map finding is that some evidenced surfaces below (notably workload autoscaler and security profile) are still represented primarily by result artifacts rather than first-class model variables/features.

## 1. Current modeled input dimensions

The current capability model has 18 AKS input variables plus observation filters. Important dimensions are grouped here by product area.

### Cluster/profile inputs

- `nodeProvisioning.mode` — NAP mode requested on the managed cluster: `Auto`, `Manual`, or unknown.
- `nodeProvisioning.defaultPools` — Karpenter/default NodePool behavior for NAP: `Auto`, `None`, or unknown.
- `identity.mode` — identity precondition branch for identity-backed scenarios; currently `msi` or unknown.
- `msi.identity.provided` — whether the MSI identity required by an identity-backed scenario exists.
- `identity.oidcIssuer.enabled` — whether OIDC issuer is requested/enabled on the managed cluster.
- `identity.workloadIdentity.enabled` — whether workload identity is requested/enabled.
- `identity.operation` — identity operation shape: create-time enablement or idempotent update.
- `identity.runtime.os` — Workload Identity runtime OS branch: Linux is now proved; Windows remains unknown.
- `identity.kubernetesVersion.branch` — OIDC issuer version branch: Kubernetes `>=1.34` default-enabled discovery/JWKS is now proved; Kubernetes `1.33` explicit-enable runtime remains unknown.
- `bootstrapProfile.artifactSource` — bootstrap artifacts source: `Direct`, `Cache`, or unknown.
- `bootstrapProfile.containerRegistryId.provided` — whether a Cache backing ACR ID is supplied, auto-provisioned, absent, or unknown.
- `bootstrapProfile.operation` — bootstrap operation shape: create, idempotent update, update-to-cache.

### Agent pool inputs

- `agentPool.kind` — agent-pool product branch: `managedsystem`, `virtualmachines`, or unknown.
- `managedSystem.operation` — ManagedSystem-specific operation: create-cluster, add-existing-pool, enable-scenario, mutate-mode, delete-existing-pool, or unknown.
- `managedSystem.request.shape` — payload shape received by RP: minimal `mode`-only, CLI defaults, `mode=System` mutation, or unknown.
- `agentPool.operation` — generic/non-ManagedSystem pool operation: add, update, delete, or unknown.
- `agentPool.request.shape` — VirtualMachines pool CLI/payload shape: single-SKU add, multi-SKU add, manual multi-profile, autoscale single-profile, etc.

### Addon/profile inputs

- `addon.appRouting.enabled` — whether App Routing/Web App Routing is enabled for the cluster/path.
- `appRouting.route.kind` — App Routing branch: nginx disablement, default-domain, public API enable, public API disable, public API default-domain enable.
- `tls.secret.provided` — default-domain TLS-secret precondition/branch, currently used to separate HTTP-only/fallback behavior from DefaultDomainCertificate provisioning.

### Security/profile and workload/runtime inputs

These are evidenced in artifacts but not yet fully modeled as first-class input variables in the JSON model:

- `workloadAutoScalerProfile.keda.enabled` — evidenced by iteration61 public CLI update.
- `workloadAutoScalerProfile.verticalPodAutoscaler.enabled` — evidenced by iteration61 public CLI update.
- `securityProfile.imageCleaner.enabled` / `intervalHours` — evidenced by iteration62 public CLI update.
- `securityProfile.nodeRestriction.enabled` — probed by iteration62; direct REST did not persist in the observed path and no exact CLI flag existed.

### Operation surface inputs / observation-context filters

The model separates product inputs from observation context. Observation filters are:

- `observation.environment` — standalone vs staging.
- `observation.suite` — e2e suite, currently dev.
- `observation.host` — devbox.
- `observation.buildVersion` — standalone build or unknown for staging.
- `observation.surface` — standalone e2ev3, ARM REST, or az CLI.

## 2. Current modeled expectation dimensions

The current capability model has 22 expectation variables. Important behavior dimensions are grouped here.

### Accepted/rejected contract

- `rp.request.accepted` — whether RP/client accepted the request.
- `cluster.operation.succeeded` — whether the managed-cluster-level operation reached success.
- `agentPool.mode.changeRejected` — whether forbidden pool mode mutation is rejected.

### Persisted ARM state

- `appRouting.webAppRouting.enabled` — persisted App Routing enabled/disabled state.
- `appRouting.defaultDomain.configured` — persisted generated default-domain state.
- `nodeProvisioning.profile.persisted` — persisted NAP mode/default pools.
- `identity.oidcIssuer.persisted` — persisted OIDC issuer enabled state and issuer URL.
- `identity.workloadIdentity.persisted` — persisted workload identity state.
- `identity.workloadIdentity.linuxTokenProjected` — Linux pod receives expected Workload Identity env vars and projected token.
- `identity.workloadIdentity.windowsTokenProjected` — Windows pod token projection branch; still unknown/non-goal in iteration76.
- `identity.workloadIdentity.disableReenablePersisted` — Workload Identity disable/re-enable lifecycle branch; still unknown/non-goal in iteration76.
- `identity.oidc.discoveryReachable` — OIDC discovery document is reachable and has expected issuer/JWKS URI shape.
- `identity.oidc.jwksValid` — JWKS endpoint is reachable and contains RSA signing key fields.
- `identity.oidc.signingKeysRotated` — OIDC signing-key rotation branch; still unknown/non-goal in iteration76.
- `identity.oidc.documentDeletedAfterClusterDelete` — post-delete issuer document cleanup branch; still unknown/non-goal in iteration76.
- `bootstrapProfile.artifactSource.persisted` — persisted `bootstrapProfile.artifactSource`.
- `bootstrapProfile.containerRegistryId.present` — Cache path has/persists a registry ID.
- `agentPool.virtualmachines.profile.persisted` — persisted VirtualMachines scale profile.

### Defaulting/mutability

- `agentPool.managedsystem.azureManagedNodes` — Azure-selected ManagedSystem nodes/sizes/count rather than user-specified count/VM size.
- `networkProfile.nap.prereqsConfigured` — NAP-required network profile shape is configured.
- `agentPool.mode.changeRejected` — ManagedSystem mode immutability negative contract.

### Runtime/controller behavior

- `appRouting.nginx.disabled` — App Routing nginx disablement behavior.
- `tls.secret.provisioned` — DefaultDomainCertificate controller provisions requested Kubernetes TLS secret.
- `identity.msi.available` — MSI identity exists for MSI-backed runtime behavior.
- `paf.throttling.behavior` — PAF throttling scenario behavior.
- `agentPool.managedsystem.ready` — ManagedSystem pool reaches ready/Succeeded.
- `agentPool.virtualmachines.ready` — VirtualMachines pool reaches ready/Succeeded.

### DNS/traffic/reachability

- `traffic.route.reachable` — request reaches backend through route/Ingress.
- `traffic.http.status` — expected HTTP status, currently `200` for successful App Routing traffic.

### Cleanup/delete behavior

- `agentPool.managedsystem.deleted` — ManagedSystem pool delete accepted and subsequent show returns NotFound.

### Error shape

The model captures error shape mostly in `judgments[].diagnosis` and artifact text rather than standalone expectation variables. Important current examples are `cli-default-payload`, `PropertyChangeNotAllowed`, `tls-secret`, `cli-help-documentation-mismatch`, and `msi-identity`.

## 3. Feature-to-path coverage matrix

| Feature | Primary input paths | Expected behavior paths | Test/evidence artifacts | Current verdict | Remaining gap |
|---|---|---|---|---|---|
| ManagedSystem Pool | `agentPool.kind=managedsystem`; REST add `managedSystem.operation=add-existing-pool` + `request.shape=minimal-mode-only`; CLI create/add + `request.shape=cli-defaults`; mutation/delete paths | request accepted/rejected; `mode=ManagedSystem`; Azure-managed nodes; mode immutability; delete NotFound | `iteration24-managedsystem-pool-pass.md`; `managedsystem-pool-exploration.md`; `iteration55`; `iteration56`; `20260519T1646Z-managedsystem-priority-staging.md` | Mixed but well-bounded: REST/standalone/delete/immutability pass; CLI create/add fail due payload defaults | Exact CLI fix path; whether e2ev3 should assert CLI-negative contract; spec/doc clarity for minimal allowed fields |
| Node Auto Provisioning | `nodeProvisioning.mode=Auto`; `defaultPools=Auto/None`; update to `mode=Manual` when default pools are None | cluster operation succeeds; NAP profile persists; CNI overlay/Cilium prereqs present | `iteration57-node-autoprovision-staging.md`; `iteration58-node-autoprovision-followup.md` | Pass for create Auto/Auto, update Auto/None, update Manual/None | Dark-side boundaries: invalid network prereqs, Manual while defaultPools Auto, workload scheduling/runtime Karpenter behavior |
| App Routing enable/disable | `addon.appRouting.enabled=true`; `appRouting.route.kind=public-api-enable/public-api-disable` through az CLI | request accepted; ARM `ingressProfile.webAppRouting.enabled` true/false | `iteration59-app-routing-staging.md`; `iteration67-app-routing-disable-staging.md` | Pass | Create-time vs update-time parity; keyvault/nginx mode variants not mapped |
| App Routing default-domain API/state | `appRouting.route.kind=public-api-default-domain-enable` | webAppRouting enabled; `defaultDomain.enabled=true`; generated `*.eastus2.aksapp.io` domain visible in show/defaultdomain show | `iteration68-app-routing-defaultdomain-staging.md`; iteration69/70 setup repeated same state pass | Pass | Disable-default-domain and update toggle edge; domain lifecycle after disable/re-enable |
| App Routing default-domain HTTP traffic | `appRouting.route.kind=default-domain`; non-TLS Ingress host `test.<domain>`; `tls.secret.provided=false` | default domain configured; DNS resolves to App Routing LB; route reachable; HTTP 200 | `iteration69-app-routing-defaultdomain-traffic-staging.md` | Pass | Covers HTTP only; does not prove managed TLS certificate provisioning |
| App Routing DefaultDomainCertificate/TLS secret | `appRouting.route.kind=default-domain`; DefaultDomainCertificate CR targeting `default/default-domain-tls`; TLS Ingress | CRD exists; TLS secret should be provisioned; HTTPS backend reachable with managed certificate | `iteration70-app-routing-defaultdomain-tls-staging.md`; older standalone `e2e-run-results-summary.md` | Fail for TLS-secret provisioning; fallback HTTPS route returned 200 with fake cert only | Owner/source investigation for controller preconditions/logs; not another blind retry |
| OIDC issuer + workload identity API state | `identity.mode=msi`; OIDC/workload identity enabled at create and idempotent update | cluster succeeds; request accepted; OIDC issuer and workload identity persisted | `iteration60-workload-identity-staging.md` | Pass | Disable/update-down paths not covered |
| Workload Identity Linux token projection + OIDC default discovery/JWKS | `identity.oidcIssuer.enabled=true`; `identity.workloadIdentity.enabled=true`; `identity.runtime.os=linux`; `identity.kubernetesVersion.branch=gte-1.34-default-enabled` | OIDC discovery HTTP 200; JWKS HTTP 200 with RSA signing key fields; Linux pod receives `AZURE_*` env vars and projected signed token with expected issuer/audience/subject | `iteration76-workload-identity-oidc-runtime-staging.md`; `iteration77-identity-runtime-model-consolidation.md` | Pass for Linux/default-discovery branch | Windows token projection; workload-identity disable/re-enable lifecycle; OIDC signing-key rotation; post-delete issuer cleanup; v1.33 explicit-enable runtime |
| Workload autoscaler KEDA/VPA | `--enable-keda`; `--enable-vpa`; create-time combined runtime probe | KEDA CRDs/controllers/APIService present; KEDA ScaledObject scales workload up/down; VPA CRDs/webhook/deployments ready; VPA recommendations generated; residual VPA branches split by in-place update, HA/leader-election, cert renewal, Helm metadata, and upgrade survival | `iteration61-workload-autoscaler-staging.md`; `iteration78-workload-autoscaler-runtime-staging.md`; `iteration79-vpa-runtime-model-split.md` | KEDA runtime pass; `workload-autoscaler-vpa-components-recommendations-runtime` pass; VPA residual branches visible unknown | KEDA disable/re-enable CRUD; KEDA upgrade/OS variants; VPA Helm-release assertion, in-place update, HA/leader-election, cert renewal, upgrade, and OS/arch matrix |
| Image Cleaner | Artifact-modeled input: `securityProfile.imageCleaner.enabled=true`, interval 48 | update accepted; `securityProfile.imageCleaner.enabled=true`; interval persisted | `iteration62-security-profile-staging.md` | Pass in artifact evidence; not first-class in JSON model | Add model variables/features; cleanup/runtime image pruning behavior; disable/update interval edges |
| Node Restriction | Direct REST PATCH `securityProfile.nodeRestriction.enabled=true`; no exact CLI flag | expected persisted security profile state | `iteration62-security-profile-staging.md` | Fail/unpersisted in artifact evidence; no CLI surface | Determine whether API version/feature gate/hidden prereq is required; owner/spec inspection before rerun |
| Bootstrap profile artifact source | `bootstrapProfile.artifactSource=Direct/Cache`; explicit Direct create/update; Cache update with auto registry | request accepted; artifactSource persisted; Cache path has containerRegistryId | `iteration63-bootstrap-profile-staging.md` | Pass | Runtime bootstrap source effects not verified; explicit user-provided ACR path and invalid combinations untested |
| VirtualMachines agent pool | `agentPool.kind=virtualmachines`; nodepool add single SKU; add multi-SKU; autoscale update single SKU; manual-scale add/delete multiple single-SKU profiles | request accepted/rejected; pool ready; `virtualMachinesProfile.scale` persisted | `iteration64`; `iteration65`; `iteration66` | Supported boundary: single-SKU add pass, single-profile autoscale pass, manual-scale multi-profile pass; comma multi-SKU add fail | Manual-scale update count-only CLI bug if worth modeling; REST multi-profile shapes; docs/help correction |

## 4. Test-to-expectation mapping

| Test/probe | Intended developer/product contract | Concrete input path exercised | Assertion/expectation path | Observed behavior | Relation to handwritten e2ev3 scenario |
|---|---|---|---|---|---|
| `Scenario_ManagedSystemPool_Enable` | A ManagedSystem pool can be enabled and becomes suitable for critical/system workloads under AKS-managed sizing/lifecycle | Standalone e2ev3; ManagedSystem enable scenario; exact request shape not yet recorded in model | request accepted; pool ready; Azure-managed nodes; taints/affinity/critical addon placement validations | Passed on standalone build `hayuaebld163822451`; validation included two pools, ManagedSystem taints, critical add-ons on ManagedSystem nodes, and affinity | Primary handwritten source for ManagedSystem feature intent; staging REST/CLI probes refine its boundary rather than replace it |
| `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld` | App Routing default domain should create a reachable hello-world route, including TLS path that waits for DefaultDomainCertificate/secret before HTTPS traffic | Standalone e2ev3 default-domain flow; source preflight shows host `test.<domain>`, `DefaultDomainCertificate`, `default-domain-tls`, DNS wait, `TestTLSTraffic` | default domain configured; DNS resolves; TLS secret available; HTTPS traffic succeeds | Older standalone summary failed around default-domain/TLS secret provisioning; iteration69/70 split the failure domain | Handwritten scenario remains broader than iteration69 HTTP-only probe; iteration70 approximates its TLS-secret branch and reproduces secret provisioning failure in staging |
| App Routing staging HTTP traffic probe (iteration69) | Public staging default-domain route can serve a real HTTP workload through generated `aksapp.io` host | Fresh cluster; `az aks approuting enable --enable-default-domain`; hello-world Deployment/Service; non-TLS Ingress for `test.<domain>` | App Routing state enabled; default domain assigned; DNS to App Routing LB; curl HTTP 200 | Passed: DNS resolved to LB, Ingress had address, curl returned HTTP 200 | Approximates the non-TLS traffic and DNS parts of `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld`; explicitly does not cover TLS secret or HTTPS managed cert |
| App Routing TLS/DefaultDomainCertificate staging probe (iteration70) | DefaultDomainCertificate controller provisions `default-domain-tls` and HTTPS succeeds with a managed default-domain cert | Fresh cluster; default domain enabled; create `DefaultDomainCertificate/default-domain-cert` targeting `default/default-domain-tls`; TLS Ingress; curl `https://test.<domain>` | CRD exists; CR Available; TLS secret exists; HTTPS 200 with managed cert | CRD existed and CR create succeeded, but no Available condition and secret NotFound after ~28 min. HTTPS 200 used nginx fake certificate (`CN=Kubernetes Ingress Controller Fake Certificate`, `SSL_VERIFY=18`) | Strong approximation of the handwritten TLS path; shows staging shares the TLS-secret gap. Highest-value next step is source/owner investigation, not repeat execution |
| Node Auto Provisioning staging probes (iterations57/58) | Public NAP profile inputs persist and supported updates work | Create with `mode=Auto/defaultNodePools=Auto` + Azure CNI overlay/Cilium; update `defaultNodePools=None`; update `mode=Manual` after default pools None | cluster operation succeeds; NAP profile persists; network prereqs configured | All three passed; Auto/Auto create, Auto/None update, and Manual/None update persisted | No handwritten case mapped yet; these are public API candidate probes that cover profile contract/state rather than runtime scheduling |
| VirtualMachines agent-pool staging probes (iterations64/65/66) | Non-ManagedSystem `type=VirtualMachines` pool contract should be distinct from ManagedSystem: supported single-SKU and manual-profile paths; reject misleading multi-SKU input | CLI add `--vm-set-type VirtualMachines --vm-sizes <one>`; CLI add `<sku1,sku2>`; autoscale update `--node-vm-size`; manual-scale add/delete one SKU per profile | accepted/rejected contract; pool ready; `virtualMachinesProfile.scale.manual/autoscale` persisted | Single-SKU add passed; comma multi-SKU add failed client-side; autoscale update single SKU passed; manual-scale add/delete second single-SKU profile passed | Adjacent to ManagedSystem rather than direct handwritten ManagedSystem coverage; explains that ManagedSystem backing type `VirtualMachines` does not imply generic VM-pool CLI shapes apply |

## 5. ManagedSystem Pool worked boundary example

### Feature intent

The handwritten `Scenario_ManagedSystemPool_Enable` is the first complete boundary example because it encodes the developer intent: AKS should own a ManagedSystem pool's node sizing/count/lifecycle while critical system workloads can run on the AKS-managed nodes. The supporting validations mentioned in `outputs/iteration24-managedsystem-pool-pass.md` include two-agent-pool validation, ManagedSystem node taints, critical add-ons on ManagedSystem nodes, and critical-addon deployment affinity.

### Accepted paths

- **Direct ARM REST add to an existing cluster with minimal payload.** Evidence in `outputs/iteration56-managedsystem-staging-refresh.md` and refreshed in `outputs/20260519T1646Z-managedsystem-priority-staging.md` shows `PUT agentPools/msyspool?api-version=2025-04-02-preview` with body `{"properties":{"mode":"ManagedSystem"}}` is accepted.
- **Observed persisted state.** The pool reaches `Succeeded`, has `mode=ManagedSystem`, `type=VirtualMachines`, null top-level `vmSize`/`count`, and Azure-selected managed nodes. The 2026-05-19 priority retest again observed CriticalAddonsOnly taints and managed `virtualMachineNodesStatus`.
- **Delete.** Standard `az aks nodepool delete` removes the ManagedSystem pool; follow-up show returns NotFound in iteration56 and the 2026-05-19 priority retest.
- **Standalone e2ev3.** `Scenario_ManagedSystemPool_Enable` passed on standalone build `hayuaebld163822451` in `outputs/iteration24-managedsystem-pool-pass.md`.

### Rejected paths

- **CLI preview create-cluster path.** `az aks create --enable-managed-system-pool` fails because the active preview CLI sends non-default fields. Iteration56 and the 2026-05-19 retest report `InvalidParameter` with fields such as `OSTypeCasePreserved`, `availabilityProfile`, `count`, `networkProfile`, `osType`, `scaleSetPriority`, and `workloadRuntime`.
- **CLI preview add-existing-pool path.** `az aks nodepool add --mode ManagedSystem` fails for the same reason, with `scaleDownMode` also appearing in the rejected default-field list.
- **Mode mutation.** Direct REST ManagedSystem -> System mutation is correctly rejected with `PropertyChangeNotAllowed`; the pool remains ManagedSystem/Succeeded.

### Expected behavior paths

- Positive contract: request accepted; pool reaches ready/Succeeded; persisted `mode=ManagedSystem`; Azure chooses nodes/size/count; critical node taints/affinity are valid.
- Delete contract: delete accepted; subsequent show NotFound.
- Negative contract: pool mode is immutable; mutation rejected with a clear error.
- Tooling boundary: CLI preview should either construct the minimal `name` + `mode` payload or be treated as a client/tooling failure, not an RP product failure.

### Observed contexts

- **Standalone e2ev3:** pass (`outputs/iteration24-managedsystem-pool-pass.md`).
- **Staging ARM REST:** pass (`outputs/iteration56-managedsystem-staging-refresh.md`; `outputs/20260519T1646Z-managedsystem-priority-staging.md`).
- **Staging CLI:** fail due default-field payload behavior (`iteration56`; `20260519T1646Z`).
- **Initial exploration:** `outputs/managedsystem-pool-exploration.md` first identified the REST pass/CLI fail split and the broader feature shape.

### Adjacent surfaces

- **Node Auto Provisioning:** adjacent AKS-managed capacity/profile input space; NAP create/update passes in iterations57/58.
- **Default node pools:** NAP `defaultNodePools=Auto/None` affects how AKS-managed node capacity is expressed at cluster level.
- **VirtualMachines pools:** ManagedSystem pools persist as `type=VirtualMachines`, but generic VirtualMachines pool CLI contracts have their own single-SKU/manual-profile rules (iterations64–66).

### Unknown edges

- Exact public CLI fix path: which CLI layer should suppress default fields for ManagedSystem create/add.
- Whether e2ev3 should add a negative CLI/default-payload assertion or keep the handwritten scenario focused on RP behavior.
- Spec/doc ambiguity: docs/spec should make clear that ManagedSystem pool create accepts only `name` + `mode` and that user-managed VM size/count fields are invalid.
- Whether direct REST create-cluster with ManagedSystem as initial system pool has a minimal accepted payload distinct from add-existing-pool; current best positive path is add-existing-pool.

## 6. App Routing boundary update

App Routing default-domain is now split into separate behavior paths; this prevents the old single fail/pass label from hiding the actual product boundary.

| App Routing sub-path | Verdict | Evidence | Interpretation |
|---|---:|---|---|
| Public API/state: `az aks approuting enable --enable-default-domain` | Pass | `outputs/iteration68-app-routing-defaultdomain-staging.md`; repeated setup in iterations69/70 | RP/CLI persists `webAppRouting.enabled=true`, `defaultDomain.enabled=true`, and an autogenerated `*.eastus2.aksapp.io` domain. |
| HTTP default-domain routing | Pass | `outputs/iteration69-app-routing-defaultdomain-traffic-staging.md` | Non-TLS workload/Service/Ingress on `test.<domain>` reached backend; curl returned HTTP 200. |
| DNS to App Routing LB | Pass | `outputs/iteration69-app-routing-defaultdomain-traffic-staging.md` | ExternalDNS/default-domain route published `test.<domain>` to App Routing LB. |
| DefaultDomainCertificate CRD existence | Pass | `outputs/iteration69...`; `outputs/iteration70...` | `defaultdomaincertificates.approuting.kubernetes.azure.com/v1alpha1` existed after App Routing enablement. |
| DefaultDomainCertificate TLS-secret provisioning | Fail / owner-diagnostics-needed | `outputs/iteration70-app-routing-defaultdomain-tls-staging.md`; `outputs/iteration80-app-routing-tls-source-hypothesis.md`; `outputs/iteration81-app-routing-tls-owner-escalation.md` | CR creation succeeded, but no Available condition and `default/default-domain-tls` remained NotFound after ~28 minutes. Iteration80 found the iteration70 CR/input source-equivalent to handwritten e2ev3 and source-visible CRD/controller requirements, so this is not classified as `probe-input-wrong`. |
| HTTPS backend reachability with fallback certificate | Partial / not managed TLS success | `outputs/iteration70-app-routing-defaultdomain-tls-staging.md` | `curl -vk https://test.<domain>/` returned HTTP 200, but the served cert was nginx's fake self-signed fallback cert, not the managed default-domain secret. |

**Current TLS status:** `fail / owner-diagnostics-needed`, not `probe-input-wrong`. Iteration80 showed iteration70 used a valid customer-side `DefaultDomainCertificate default/default-domain-cert` targeting `default-domain-tls`; source-visible behavior should create the Secret and set `Available=True`. No additional customer-cluster-only rerun should be launched. The only useful rerun is owner/diagnostic-gated: collect CCP `app-routing-operator` pod image/args/env/status/logs and underlay `default-domain-svc` status/logs, or validate an owner-supplied concrete precondition/fix.

## 7. Coverage gaps and high-density future candidates

| Rank | Gap / candidate | Why it matters | Evidence missing | Cheapest next action | Needs cloud execution/source/docs/owner? |
|---:|---|---|---|---|---|
| 1 | App Routing DefaultDomainCertificate TLS-secret root cause | This is the clearest active product/controller uncertainty: API/state and HTTP pass, but managed TLS secret does not appear. It directly explains the older handwritten scenario failure. Iteration80 found the observed CR shape sufficient/source-equivalent, so the open gap is owner/CCP diagnostics rather than probe-input correction. | CCP `app-routing-operator` image/args/env/status/logs; underlay `default-domain-svc` status/logs; owner confirmation of expected operator/chart/preconditions. | Use `outputs/iteration81-app-routing-tls-owner-escalation.md` for owner handoff; rerun only with CCP/underlay diagnostics or an owner-supplied concrete fix/precondition. | **Owner diagnostics first**; no customer-cluster-only cloud rerun. |
| 2 | JSON model missing first-class workload autoscaler and security-profile variables/features | The artifacts contain pass/fail evidence, but the model summary undercounts current coverage and future selection logic cannot query these surfaces. | Formal input/expectation variables and feature/test/judgment relations for KEDA/VPA, Image Cleaner, Node Restriction. | Add already-evidenced model relations from iterations61/62 and run validator. | Local model edit + validator; no cloud needed. |
| 3 | Handwritten e2ev3 inventory beyond the small set already mapped | Project goal says handwritten cases are primary intent source. Current map is still biased toward recent staging probes. | Scenario catalog to feature/input/expectation mapping for remaining handwritten cases, including setup, assertions, and historical boundaries. | Local/source inventory: read e2ev3 plan/scenario/step/assertion files and produce a scenario-to-feature matrix. | Source inspection; no cloud needed. |
| 4 | ManagedSystem public CLI fix/negative contract | ManagedSystem RP path works, but public CLI create/add remain broken. This is a high-impact tooling boundary and a possible future e2e negative assertion. | Exact CLI decorator/request construction fix; docs/spec confirmation for name+mode-only payload. | Inspect active `aks-preview` source around ManagedSystem pool construction; draft bug/fix notes tied to iteration56/priority evidence. | Source/docs inspection; owner/CLI handoff likely; no immediate cloud. |
| 5 | Runtime coverage for API-state-only passes | Several public API probes prove ARM persistence but not workload/runtime behavior: OIDC/workload identity federation, KEDA/VPA scaling, Image Cleaner cleanup, bootstrap Cache/Direct runtime source. | Runtime behavior under a minimal workload for one selected API-state feature. | After local inventory, choose one high-density runtime probe that covers multiple persisted profiles or resolves a high-risk unknown. | Cloud execution eventually, but only after map chooses a target. |
| Final decision | **Superseded by iteration75 probe-selection artifact.** The model is now rich enough to pick a concrete future run, not only local/source investigation. | Iterations73/74 added source-derived model structure and resolved Node Restriction as an operation-shape issue. | Use the validated failing/unknown feature set to choose the next run. | See `outputs/iteration75-model-driven-probe-selection.md`. | No cloud execution in iteration75; execute only after selected coverage/non-goals are explicit. |

## 8. Next high-density probes

Iteration75 selected Workload Identity + OIDC as the top runtime probe. Iteration76 executed the scoped Linux/default-discovery branch, and iteration77 split the model so that the completed pass no longer hides residual identity/OIDC branches.

Current identity/OIDC branch status:

- **Passed:** `workload-identity-runtime-token-projection-linux` and `oidc-issuer-default-enabled-discovery-jwks-runtime`, backed by `outputs/iteration76-workload-identity-oidc-runtime-staging.md`.
- **Still unknown but visible:** `workload-identity-runtime-token-projection-windows`, `workload-identity-disable-reenable-lifecycle`, `oidc-issuer-default-enabled-signing-key-rotation`, `oidc-issuer-default-enabled-post-delete-cleanup`, and `oidc-issuer-v133-explicit-enable-runtime`.

Iteration78 executed the Combined KEDA/VPA runtime probe, and iteration79 split the VPA runtime model so bounded evidence is first-class instead of hidden under one grouped unknown. Branch status after the split:

- **Passed:** `workload-autoscaler-keda-runtime`, backed by `outputs/iteration78-workload-autoscaler-runtime-staging.md` (KEDA profile persisted, CRDs/controllers/APIService ready, cron `ScaledObject` scaled a ready workload from 1 to 4 replicas and back to 1).
- **Passed:** `workload-autoscaler-vpa-components-recommendations-runtime`, backed by `outputs/iteration78-workload-autoscaler-runtime-staging.md` (VPA CRDs/webhook service and admission/recommender/updater deployments ready; `hamster-vpa` generated CPU/memory recommendations with updateMode `Off`).
- **Still unknown and now visible:** `workload-autoscaler-vpa-inplace-update-runtime`, `workload-autoscaler-vpa-ha-leader-election-runtime`, `workload-autoscaler-vpa-cert-renewal-runtime`, `workload-autoscaler-vpa-upgrade-survival-runtime`, and `workload-autoscaler-vpa-helm-release-runtime`. The legacy `workload-autoscaler-vpa-runtime` roll-up remains unknown only as an aggregate/source-intent pointer.
- **Still unknown:** `workload-autoscaler-keda-crud`, because disable/re-enable was an explicit non-goal.

The current top three recommendations are now:

1. **App Routing DefaultDomainCertificate TLS owner diagnostics, not a blind rerun.** This is the clearest active fail: API/state, DNS, HTTP, CRD creation, and fallback HTTPS are separated, but managed TLS-secret provisioning failed in iteration70. Iteration80 found the CR/input source-equivalent to handwritten e2ev3, so current status is `fail / owner-diagnostics-needed`; use the iteration81 escalation packet and rerun only with CCP `app-routing-operator` plus underlay `default-domain-svc` diagnostics or an owner-supplied fix/precondition.
2. **Focused VPA residual probe if autoscaler remains the priority.** A good next VPA cloud probe should target `workload-autoscaler-vpa-inplace-update-runtime` plus cheap same-cluster checks for Helm metadata and HA/leader-election. Cert renewal and upgrade survival are likely longer-running and should be explicitly scoped before inclusion.
3. **KEDA disable/re-enable CRUD or Node Restriction corrected full PUT/runtime-default probe.** KEDA CRUD is the remaining KEDA lifecycle branch; Node Restriction covers `node-restriction-disable-contract` and `node-restriction-runtime-default` using the operation-shape correction from `outputs/iteration74-node-restriction-source-spec-resolution.md`.

Residual identity/OIDC branches remain valuable but are no longer the next best cloud run unless Windows parity, lifecycle cleanup, key rotation, or Kubernetes `1.33` explicit-enable behavior becomes the explicit priority.
