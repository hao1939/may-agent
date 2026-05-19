# e2ev3 handwritten coverage inventory

**Iteration:** 72  
**Created:** 2026-05-19  
**Scope:** local/source inventory only. No staging, `az`, cluster creation, or cloud probe was run in this iteration.  
**Source authority:** handwritten e2ev3 source under `devbox:/home/hayua/rp/test/e2ev3`; existing project artifacts only for evidence linkage.

## 1. Inventory method

I started with the requested source-inspection command from `/app/projects/aks-rp-e2e`:

```bash
ssh devbox 'cd /home/hayua/rp && find test/e2ev3 -path "*/.git" -prune -o -type f \( -name "*.go" -o -name "*.yaml" -o -name "*.yml" \) | grep -Ei "managedsystem|managed.system|app.?routing|default.?domain|node.?auto|provision|workload.?identity|oidc|workload.?autoscaler|keda|vpa|image.?cleaner|node.?restriction|bootstrap|virtualmachines|virtual.?machines" | sort'
```

That found relevant handwritten source under these primary areas:

- `devbox:/home/hayua/rp/test/e2ev3/sigs/rp/nativerp/plans/managedsystem*.go`
- `devbox:/home/hayua/rp/test/e2ev3/sigs/rp/virtualmachine/plans/**/*.go`
- `devbox:/home/hayua/rp/test/e2ev3/sigs/rp/nodeprovisioner/{suites,pipelines}/...`
- `devbox:/home/hayua/rp/test/e2ev3/sigs/traffic/plans/approuting/**/*.go`
- `devbox:/home/hayua/rp/test/e2ev3/sigs/security/workloadidentity/plans/*.go`
- `devbox:/home/hayua/rp/test/e2ev3/sigs/autoscale/keda/plans/*.go`
- `devbox:/home/hayua/rp/test/e2ev3/sigs/ccp/plans/overlayvpa.go` and `devbox:/home/hayua/rp/test/e2ev3/sigs/ccp/handlers/verify_vpa_*.go`
- `devbox:/home/hayua/rp/test/e2ev3/sigs/ccp/plans/node_restriction.go`
- `devbox:/home/hayua/rp/test/e2ev3/sigs/security/imagecleaner/plans/impl.go`
- `devbox:/home/hayua/rp/test/e2ev3/sigs/security/networkisolatedcluster/plans/bootstrap_profile.go`

Follow-up inspection used `grep -R "NewScenario\|Scenario_"` and targeted `sed` reads of plan/step/assertion files. This inventory prioritizes the feature areas already present in `outputs/input-expectation-knowledge-map.md`; it is not a complete catalog of every unrelated e2ev3 scenario.

## 2. Scenario catalog

| Scenario | Source path | Plan/suite/sig area | Feature area | Represented in `outputs/e2e-capability-model.json`? | Linked project evidence artifact |
|---|---|---|---|---|---|
| `Scenario_ManagedSystemPool_Enable` | `test/e2ev3/sigs/rp/nativerp/plans/managedsystem_lifecycle.go` | RP / native RP | ManagedSystem pool add to existing cluster | **Yes**: `managedsystem-pool-standalone-e2ev3` plus REST/CLI boundary features | `outputs/iteration24-managedsystem-pool-pass.md`; `outputs/iteration56-managedsystem-staging-refresh.md`; `outputs/20260519T1646Z-managedsystem-priority-staging.md` |
| `Scenario_ManagedSystemPool_Disable` | `test/e2ev3/sigs/rp/nativerp/plans/managedsystem_lifecycle.go` | RP / native RP | ManagedSystem pool delete/disable and workload migration | **Partial**: delete evidence exists, but handwritten migration-back intent is not modeled | `outputs/iteration56-managedsystem-staging-refresh.md`; `outputs/20260519T1646Z-managedsystem-priority-staging.md` |
| `Scenario_ManagedSystem_AgentPool` | `test/e2ev3/sigs/rp/nativerp/plans/managedsystem.go` | RP / native RP | ManagedSystem as initial cluster pool, workload restrictions, VAPs | **Partial**: ManagedSystem general feature represented; create-time initial-pool/VAP restriction branch not first-class | `outputs/managedsystem-pool-exploration.md` (supporting), no direct staging artifact |
| `Scenario_VirtualMachine_ManagedSystem_AgentPool` | `test/e2ev3/sigs/rp/virtualmachine/plans/managedsystem.go` | RP / VirtualMachine | VirtualMachines-backed ManagedSystem validation | **Partial**: ManagedSystem and VirtualMachines adjacent surfaces modeled separately, not this combined scenario | `outputs/iteration24-managedsystem-pool-pass.md` (related); VM evidence in iterations64-66 |
| `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld` | `test/e2ev3/sigs/traffic/plans/approuting/default_domain.go` and `steps/*.go` | Traffic / App Routing | Default domain, TLS certificate, DNS, HTTPS traffic, rotation, upgrade | **Yes/partial**: default-domain and TLS-secret features modeled; rotation/upgrade not modeled | `outputs/e2e-run-results-summary.md`; `outputs/iteration69-app-routing-defaultdomain-traffic-staging.md`; `outputs/iteration70-app-routing-defaultdomain-tls-staging.md` |
| `Scenario_Traffic_AppRouting_DefaultDomain_Istio_HelloWorld` | `test/e2ev3/sigs/traffic/plans/approuting/default_domain_istio.go` | Traffic / App Routing | Default domain over meshless Istio Gateway API | **No** as distinct path | None |
| `Scenario_Traffic_AppRouting_Nginx_Disablement` | `test/e2ev3/sigs/traffic/plans/approuting/nginx_disablement.go` | Traffic / App Routing | NGINX mode disable/enable lifecycle | **Yes**: `app-routing-nginx-disablement` test case exists | Existing model evidence (`successful-e2e-run` / `e2e-run-results-summary`), no recent staging artifact |
| `Scenario_OIDC_Issuer` | `test/e2ev3/sigs/security/workloadidentity/plans/enable_oidc_issuer.go` | Security / workload identity | OIDC issuer default-enabled behavior for k8s >= 1.34 | **Partial**: public API create/update represented; default-by-version, JWKS, rotation, deletion not modeled | `outputs/iteration60-workload-identity-staging.md` covers API state only |
| `Scenario_OIDC_Issuer_v133` | `test/e2ev3/sigs/security/workloadidentity/plans/enable_oidc_issuer.go` | Security / workload identity | OIDC explicit enablement for k8s 1.33.x | **Partial**: explicit enable modeled via public CLI, runtime/JWKS/deletion not modeled | `outputs/iteration60-workload-identity-staging.md` |
| `Scenario_WorkloadIdentity` | `test/e2ev3/sigs/security/workloadidentity/plans/workloadidentity.go` | Security / workload identity | Workload identity create, Linux/Windows token projection, disable/re-enable, upgrade | **Partial**: create + idempotent update state modeled; pod token runtime and disable/re-enable not modeled | `outputs/iteration60-workload-identity-staging.md` |
| `Scenario_WorkloadIdentity_Automatic_SKU` | `test/e2ev3/sigs/security/workloadidentity/plans/workloadidentity.go` | Security / workload identity / Automatic SKU | Automatic cluster workload identity subset | **No** as distinct branch | None |
| `Scenario_Keda` | `test/e2ev3/sigs/autoscale/keda/plans/keda.go` | Autoscale / KEDA | KEDA add-on install and workload autoscaling | **No/under-modeled**: artifact evidence exists, JSON lacks first-class KEDA feature | `outputs/iteration61-workload-autoscaler-staging.md` |
| `Scenario_Keda_CRUD` | `test/e2ev3/sigs/autoscale/keda/plans/keda.go` | Autoscale / KEDA | KEDA disable/re-enable lifecycle | **No** as distinct path | None |
| `Scenario_Keda_Upgrade` | `test/e2ev3/sigs/autoscale/keda/plans/keda.go` | Autoscale / KEDA | KEDA survival through cluster upgrade | **No** | None |
| `Scenario_Keda_Mariner` / `Scenario_Keda_AzureLinux` / `Scenario_Keda_Flatcar` | `test/e2ev3/sigs/autoscale/keda/plans/keda_variants.go` | Autoscale / KEDA | OS SKU variants | **No** | None |
| `Scenario_Overlay_VPA_*` | `test/e2ev3/sigs/ccp/plans/overlayvpa.go` | CCP / VPA | VPA add-on components, recommendations, in-place updates, HA, upgrade across OS/arch variants | **No/under-modeled**: artifact evidence exists only as public API state for VPA | `outputs/iteration61-workload-autoscaler-staging.md` covers state only |
| `Scenario_Node_Restriction` / e2ev3 name `Node_Restriction` | `test/e2ev3/sigs/ccp/plans/node_restriction.go` | CCP / security profile | Node Restriction auto-enabled and cannot be disabled | **No/under-modeled**: staging artifact exists; JSON lacks first-class feature | `outputs/iteration62-security-profile-staging.md` |
| `Scenario_ImageCleaner` | `test/e2ev3/sigs/security/imagecleaner/plans/impl.go` | Security / Image Cleaner | Image Cleaner enable/disable, interval update, components, image erasure, upgrade/restart | **No/under-modeled**: staging artifact exists; JSON lacks first-class feature | `outputs/iteration62-security-profile-staging.md` |
| `Scenario_NetworkIsolatedCluster_Bootstrap_Profile_Managed_ACR` | `test/e2ev3/sigs/security/networkisolatedcluster/plans/bootstrap_profile.go` | Security / network isolated cluster | Bootstrap profile Cache with AKS-managed ACR | **Partial**: Direct/Cache API-state features modeled; runtime image pull and disable/re-enable cleanup not modeled | `outputs/iteration63-bootstrap-profile-staging.md` |
| `Scenario_NetworkIsolatedCluster_Bootstrap_Profile_BYO_ACR` | `test/e2ev3/sigs/security/networkisolatedcluster/plans/bootstrap_profile.go` | Security / network isolated cluster | Bootstrap profile Cache with customer-supplied ACR and ACR switch | **No** as distinct path | `outputs/iteration63-bootstrap-profile-staging.md` covers only auto-registry Cache update, not BYO |
| `Scenario_Autoscaled_VMs_CRUD` | `test/e2ev3/sigs/rp/virtualmachine/plans/autoscale.go` | RP / VirtualMachine | VirtualMachines pool manual -> autoscale profile updates and upgrade | **Partial**: single-profile autoscale update modeled; upgrade not modeled | `outputs/iteration65-virtualmachines-multisku-contract.md` |
| `Scenario_Mixed_SKU_Scale` | `test/e2ev3/sigs/rp/virtualmachine/plans/mixed_sku_scale.go` | RP / VirtualMachine | REST/API mixed-SKU manual profile create and scale transitions | **Partial**: manual multi-profile add/delete modeled via CLI; source intent is richer scale sequence | `outputs/iteration66-virtualmachines-manual-scale-staging.md` |
| `Scenario_MachinesAgentPool` | `test/e2ev3/sigs/rp/virtualmachine/plans/machines/machines_agentpool.go` | RP / Machines API | Machines-mode agent pool and Machine CRUD | **No** | None |
| `Scenario_MachinesAgentPoolNAPEnabled` | `test/e2ev3/sigs/rp/virtualmachine/plans/machines/machines_agentpool_nap_enabled.go` | RP / VirtualMachine + NAP | NAP-created default Machines pool, Machine CRUD, disable NAP cleanup | **Partial**: NAP create/update state modeled; Machines runtime/default pool cleanup not modeled | `outputs/iteration57-node-autoprovision-staging.md`; `outputs/iteration58-node-autoprovision-followup.md` |
| NodeProvisioner CheckIn / PreGA suites | `test/e2ev3/sigs/rp/nodeprovisioner/suites/*.go` | RP / NodeProvisioner | Legacy pipeline wrapper around VirtualMachine scenarios | **No direct scenario**: checkin currently has scenarios commented out; PreGA delegates to VirtualMachine prerelease | None |

Areas with no obvious first-class handwritten scenario in this priority grep: public CLI-only App Routing enable/disable/default-domain API probes are not mirrored as public CLI e2ev3 cases; Node Auto Provisioning public profile state has no simple standalone scenario except richer Machines/NAP coverage; workload autoscaler/security-profile staging probes are far thinner than existing handwritten KEDA/VPA/ImageCleaner/NodeRestriction cases.

## 3. Case-to-path mapping

### ManagedSystem pool cases

| Case | AKS input paths | Expected behavior/assertion paths | Setup/preconditions | Runtime/assertion steps | Cleanup expectations | Current evidence coverage |
|---|---|---|---|---|---|---|
| `Scenario_ManagedSystemPool_Enable` | Existing cluster with default System pool of `type=VirtualMachines`; add agent pool with `properties.mode=ManagedSystem` and minimal request shape (`name` + `mode`) | Create/add accepted; cluster has two pools; ManagedSystem pool exists; critical add-ons have ManagedSystem affinity; ManagedSystem nodes have `CriticalAddonsOnly` taints; critical add-ons run on ManagedSystem nodes | Azure network plugin, standard LB, Linux; e2ev3 dynamic VM size; K8s credential | Calls `CreateAgentPool` with `Mode=ManagedSystem`; gets MC; validates two pools, add-on affinity, node taints, critical add-ons on ManagedSystem nodes with retries | Whole cluster teardown; separate staging delete evidence shows pool delete NotFound | **Partially covered**: standalone pass covers this strongly; staging REST add/delete covers ARM boundary but not add-on placement/affinity runtime checks |
| `Scenario_ManagedSystemPool_Disable` | Cluster created with System `VirtualMachines` pool and an additional initial ManagedSystem pool with only `name` + `mode` | Delete ManagedSystem pool; workloads/system components migrate back to System pool; cluster remains healthy | Same as enable, but ManagedSystem pool exists at create time | Source comments state delete/validate migration; exact later lines were not fully deep-read this iteration | Cluster teardown after delete/migration validation | **Partially covered**: staging delete proves pool deletion, but not migration-back behavior |
| `Scenario_ManagedSystem_AgentPool` | Cluster creation with first/default agent pool `mode=ManagedSystem`, `count=0`, `type=nil` | CoreDNS ready; ManagedSystem node taints; ValidatingAdmissionPolicies and bindings exist; customer workload cannot schedule on ManagedSystem nodes; reconcile/update accepted | Azure network plugin, standard LB, Linux, dynamic VM size/default K8s | Creates unschedulable test pod; validates pending/unschedulable; validates CoreDNS/VAP/VAPBinding; reconciles cluster and accepts update | Deletes test pod and cluster | **Not fully covered**: model has ManagedSystem, but staging has not proved create-time initial ManagedSystem pool, VAP/VAPBinding, or customer workload restriction |
| `Scenario_VirtualMachine_ManagedSystem_AgentPool` | System default pool with `type=VirtualMachines` and manual profile; mutator adds ManagedSystem pool | Reuses native RP validation: CoreDNS ready, ManagedSystem taints, customer workload restriction | VirtualMachines pool type; ManagedSystem mutator sets pool name/mode/count=0/type=nil/profile=nil | Validates CoreDNS, taints, workload restriction | Cluster teardown | **Partially covered**: adjacent VM and ManagedSystem features evidenced separately; combined VM-backed scenario not directly covered |

### App Routing cases

| Case | AKS input paths | Expected behavior/assertion paths | Setup/preconditions | Runtime/assertion steps | Cleanup expectations | Current evidence coverage |
|---|---|---|---|---|---|---|
| `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld` | App Routing default domain; `DefaultDomainCertificate` CR targeting `default/default-domain-tls`; TLS Ingress host `test.<defaultDomain>` | Default domain available; DefaultDomainCertificate `Available=True`; TLS secret exists; external-dns healthy; DNS record resolves; HTTPS 200; in dev/test leaf cert hostname/expiry valid; certificate rotation after admin route in dev/test; survives upgrade | App Routing cluster with default domain; underlay/CCP creds for diagnostics/rotation; hello-world Deployment/Service | `GetDefaultDomain`; deploy app; create DefaultDomainCertificate; wait for cert; create TLS Ingress; wait external-dns and DNS record; `TestTLSTraffic`; dev/test rotate certificate, bounce operator, wait rotated cert; upgrade and retest | Cluster teardown | **Partially covered**: iteration69 covers HTTP/DNS without TLS; iteration70 covers CRD/CR and shows secret failure; rotation/upgrade/cert hostname validation not covered |
| `Scenario_Traffic_AppRouting_DefaultDomain_Istio_HelloWorld` | App Routing Istio/Gateway API branch; Gateway + HTTPRoute using default-domain TLS secret | Same cert/DNS/HTTPS expectations as nginx path, but via meshless Istio Gateway class | Gateway API + AppRoutingIstio preview features; hello-world namespace; TLS secret from DefaultDomainCertificate | Create cert before publishing Gateway; create Gateway listener on HTTPS with `CertificateRefs`; create HTTPRoute; wait DNS; HTTPS test; upgrade retest | Cluster teardown | **Not covered**: no current model input for `appRouting.route.kind=default-domain-istio` or Gateway API expectations |
| `Scenario_Traffic_AppRouting_Nginx_Disablement` | `ingressProfile.webAppRouting.enabled=true`, nginx mode initially Disabled; later Enabled then Disabled | Disabled state has no NginxIngressController CRD/deployment; enabling persists `Nginx.Mode=Enabled`, CRD exists, controller CR can be created, deployment ready; disabling persists `Disabled` and deployment/CRD are gone | App Routing enabled cluster; larger VM size/count/maxPods; dev latest stable API | Verify CRD absent; update MC to enable nginx; get MC state; verify CRD exists; create NginxIngressController CR; wait deployment ready; update MC to disable; verify MC state and deployment/CRD deletion | Cluster teardown | **Represented but stale**: model has nginx-disablement; recent staging API enable/disable did not exercise NGINX CRD/deployment lifecycle |

### Identity cases

| Case | AKS input paths | Expected behavior/assertion paths | Setup/preconditions | Runtime/assertion steps | Cleanup expectations | Current evidence coverage |
|---|---|---|---|---|---|---|
| `Scenario_OIDC_Issuer` | K8s >= 1.34; OIDC issuer expected enabled by default without explicit request | ARM OIDC profile enabled and issuer URL non-empty; discovery works; projected service account token settings valid; JWKS has expected rotated key count; signing key rotation cases pass; OIDC document deleted after cluster delete | Default K8s >= 1.34, default VM size | Get MC after create; validate OIDC discovery/JWKS/issuer; smoke; rotation; teardown; wait for document deletion | Explicit post-teardown OIDC document deletion validation | **Partially covered**: iteration60 proves create/update API state only; default-by-version, JWKS/rotation/deletion absent |
| `Scenario_OIDC_Issuer_v133` | K8s 1.33.x; OIDC initially disabled, then enabled by MC update | Before-enable discovery absent/expected failure; update accepted; issuer URL set; discovery/JWKS/rotation valid; document deletion after teardown | K8s `~1.33.x`; OIDC profile nil at create | Get before enable; validate not enabled; update OIDC `Enabled=true`; get after; discovery/JWKS/issuer/rotation | Post-teardown document deletion | **Partially covered**: public CLI enablement approximates update state, not negative-before or runtime docs |
| `Scenario_WorkloadIdentity` | OIDC issuer + `securityProfile.workloadIdentity.enabled=true`; Azure CNI; Windows profile; later Windows agent pool; disable/re-enable; upgrade | Cluster state enabled; OIDC discovery/JWKS/issuer valid; Linux pod has projected token/env; Windows pod has projected token/env; disable then re-enable persists; post-upgrade Linux/Windows checks pass | Azure CNI; Windows admin profile; Linux default pool; dynamic Windows pool | Get MC; validate OIDC docs; run Linux workload identity validation; create Windows pool and validate Windows; disable/re-enable WI and revalidate docs; upgrade and revalidate | Cluster teardown | **Partially covered**: iteration60 covers state only; runtime token projection, Windows path, disable/re-enable, upgrade absent |

### Workload autoscaler cases

| Case | AKS input paths | Expected behavior/assertion paths | Setup/preconditions | Runtime/assertion steps | Cleanup expectations | Current evidence coverage |
|---|---|---|---|---|---|---|
| `Scenario_Keda` | `workloadAutoScalerProfile.keda.enabled=true`; AddonManagerV2Preview feature; 4-core Linux node | KEDA resources present; KEDA can scale a Kubernetes workload via cron `ScaledObject` | VM size with 4 cores; KEDA enabled at create | Validate KEDA resources; deploy workload/ScaledObject with min/max replicas; observe autoscaling | Cluster teardown | **Under-covered**: iteration61 proves profile persisted, not KEDA resources or scaling |
| `Scenario_Keda_CRUD` | KEDA enabled at create; update KEDA disabled; update enabled | Resources present after create, absent after disable, present after re-enable | Same as KEDA | MC update mutators toggle KEDA; validate resources after each toggle | Cluster teardown | **Not covered**: no disable/re-enable evidence |
| `Scenario_Keda_Upgrade` | KEDA enabled; cluster upgrade when available | KEDA resources remain present post-upgrade; autoscaling works | Upgrade target available | Validate resources and autoscaling; upgrade MC/agent pools; validate post-upgrade | Cluster teardown | **Not covered** |
| `Scenario_Overlay_VPA_*` | `workloadAutoScalerProfile.verticalPodAutoscaler.enabled=true`; OS/arch variants; K8s version gates for HA/in-place update | Helm release installed; VPA pods ready; component health; VPA versions match K8s; HA replicas/leader election where applicable; cert renewal; test workloads ready; VPA recommendations generated; in-place updates when supported; survives upgrade | VPAPreview feature; node count per pool; OS SKU/arch mutators; K8s 1.34 gates | Create workloads and VPA objects; verify recommendations/in-place; upgrade; repeat component and recommendation checks; cleanup VPA/workload objects | Deletes VPA objects/workload pods and tears down cluster | **Under-covered**: iteration61 proves VPA profile state only |

### Security profile cases

| Case | AKS input paths | Expected behavior/assertion paths | Setup/preconditions | Runtime/assertion steps | Cleanup expectations | Current evidence coverage |
|---|---|---|---|---|---|---|
| `Scenario_ImageCleaner` | `securityProfile.imageCleaner.enabled=true`, initial interval 168; later disable/re-enable and interval 42 | ImageCleaner state persists; eraser collector pods/components present when enabled and absent after disable; vulnerable image exists while disabled and is removed after enable; interval update persists; survives upgrade and stop/start (where allowed) | EnableImageCleanerPreview feature; non-AGC/non-Automatic branches for some steps | Validate state/components; disable; create vulnerable image pod and verify image exists; enable; wait eraser pod completion and verify image removed; update interval; upgrade; restart; validate again | Cluster teardown | **Under-covered**: iteration62 covers state/interval only, not components or actual image erasure |
| `Node_Restriction` (`Scenario_Node_Restriction` variable) | K8s >= 1.24; RBAC enabled; Azure CNI; `securityProfile.nodeRestriction.enabled=true` | NodeRestriction is present/enabled in MC response; attempt to disable fails with error containing `Node restriction is required`; final state remains enabled | Default K8s >= 1.24; standard LB | Create cluster; get MC; validate securityProfile nodeRestriction; PUT MC with enabled=false expecting error; get MC again and validate still enabled | Cluster teardown | **Divergent**: iteration62 direct REST PATCH did not persist NodeRestriction and no exact CLI flag existed. Handwritten intent says auto-enabled + cannot-disable, implying staging probe likely used wrong API/version/shape/precondition or feature gate |

### Bootstrap profile cases

| Case | AKS input paths | Expected behavior/assertion paths | Setup/preconditions | Runtime/assertion steps | Cleanup expectations | Current evidence coverage |
|---|---|---|---|---|---|---|
| `Scenario_NetworkIsolatedCluster_Bootstrap_Profile_Managed_ACR` | `bootstrapProfile.artifactSource=Cache` with no BYO registry, AKS-managed ACR; later Direct disable and Cache re-enable | Cache state persists; `containerRegistryID` assigned; image pull works; Direct disables cache and clears registry ID; managed ACR bootstrap resources cleaned up; re-enable restores Cache and image pull | NetworkIsolatedClusterPreview; default LB outbound; 3-node pool | Create; validate Cache + registry ID; image pull; update Direct; validate disabled and resources cleaned; update Cache; validate and image pull | Cluster teardown | **Partially covered**: iteration63 covers Direct/Cache state and auto-registry ID, not image pull or cleanup lifecycle |
| `Scenario_NetworkIsolatedCluster_Bootstrap_Profile_BYO_ACR` | `artifactSource=Cache` with customer ACR ID; disable/re-enable; switch to second ACR | Cache state uses exact BYO ACR; image pull works; Direct clears registry ID; re-enable uses selected ACR; update switches ACR | Creates public/BYO ACRs and role assignments | Provision ACR(s), create cluster, validate state/image pulls, disable/re-enable, switch ACR and validate | Cluster and ACR cleanup | **Not covered**: current staging only covered AKS-provisioned registry path |

### VirtualMachines / NAP / Machines cases

| Case | AKS input paths | Expected behavior/assertion paths | Setup/preconditions | Runtime/assertion steps | Cleanup expectations | Current evidence coverage |
|---|---|---|---|---|---|---|
| `Scenario_Autoscaled_VMs_CRUD` | Cluster default pool `type=VirtualMachines` with manual scale profile; update to autoscale profile 1-3 then 3-5; upgrade | Scale profile update accepted and validated; upgrade succeeds | Dynamic VM size; explicit pool name | `UpdateScaleProfileAndValidate` twice; upgrade MC/agent pools | Cluster teardown | **Partially covered**: iteration65 covers single-profile autoscale update, not full upgrade flow |
| `Scenario_Mixed_SKU_Scale` | Create additional VirtualMachines user pool with two manual profiles; scale down via AgentPool PUT; scale down via ManagedCluster PUT; remove one SKU while scaling another; scale up to two SKUs | `virtualMachinesProfile.scale.manual` count/size arrays persist; node counts match expected profiles after each operation | Two VM sizes selected by core-count criteria; default pool VirtualMachines | Create mixed-SKU AP; repeated update/get/verify steps compare manual profiles and nodes | Cluster teardown | **Partially covered**: iteration66 proved multiple single-SKU manual profiles add/delete; source expects richer multi-step REST scale transitions |
| `Scenario_MachinesAgentPool` | Managed cluster with system VMSS pool plus `mode=Machines` pool; separate Machines API resources | Machines pool create returns `mode=Machines`, `type=VirtualMachines`; Machine create/get/update/list/delete works; UltraSSD unsupported SKU returns expected error | Development preview API; Azure CNI overlay; availability zone support | Create Machines AP; create machines including UltraSSD; expected error for unsupported UltraSSD; update tags; list/delete machines; delete Machines AP | Deletes machines and Machines agent pool, then cluster | **Not covered** by current model; adjacent to but distinct from VirtualMachines agent-pool CLI evidence |
| `Scenario_MachinesAgentPoolNAPEnabled` | Cluster with `nodeProvisioningProfile.mode=Auto`; default NAP-created Machines pool `aksmanagedap`; later update MC to Manual | Default Machines pool exists with `mode=Machines`, `type=VirtualMachines`; Machine CRUD works; switching to Manual succeeds and default Machines pool/nodes are deleted | Development preview API; system VMSS pool; Karpenter NodePool CPU limit set to 0 before disable | Get `aksmanagedap`; create/get/update/list/delete machines; patch Karpenter CPU limit; update MC `mode=Manual`; validate profile and default pool cleanup | Cluster teardown | **Partially covered**: iterations57/58 prove NAP Auto and Manual state transitions, but not default Machines pool CRUD or cleanup |
| NodeProvisioner CheckIn/PreGA | Mutators set create/create-agent-pool `type=VirtualMachines`; CheckIn scenario list currently commented; PreGA delegates VirtualMachine prerelease scenarios | No direct new product assertions in checked files | Pipeline/suite wrapper only | N/A | N/A | **No separate coverage gap** beyond VirtualMachine scenario inventory |

## 4. Gaps discovered from handwritten intent

1. **ManagedSystem runtime restrictions exceed REST state.** Handwritten cases assert CoreDNS readiness, ManagedSystem taints, critical add-on affinity/placement, VAP/VAPBinding presence, and customer workload unschedulability. Staging REST evidence proves add/delete/persisted state but not these runtime safety contracts.
2. **ManagedSystem disable is stronger than delete.** Current staging delete evidence stops at NotFound; `Scenario_ManagedSystemPool_Disable` is intended to validate migration back to System pool after deleting the ManagedSystem pool.
3. **App Routing TLS path includes cert quality, rotation, operator bounce, DNS, and upgrade.** Iteration70 isolated TLS-secret provisioning failure, but source intent also checks leaf cert hostname/expiry, dev/test rotation propagation, and post-upgrade TLS traffic.
4. **App Routing has an unmodeled Istio/Gateway default-domain branch.** `Scenario_Traffic_AppRouting_DefaultDomain_Istio_HelloWorld` mirrors the default-domain TLS/DNS traffic contract through Gateway API and AppRoutingIstio instead of nginx/Ingress.
5. **Workload identity handwritten intent is runtime-token centric.** Current evidence covers CLI create/update state; source validates OIDC discovery, JWKS, signing-key rotation, document deletion after cluster deletion, Linux and Windows projected tokens/env vars, disable/re-enable, and upgrade.
6. **KEDA/VPA handwritten coverage is real product behavior, not just profile persistence.** KEDA checks resource presence and actual workload scaling; VPA checks Helm releases, pods, versions, HA, leader election, cert renewal, recommendations, in-place updates, and upgrade survival.
7. **Image Cleaner handwritten intent requires actual erasure.** It disables Image Cleaner to prove a vulnerable image remains, re-enables to wait for eraser completion, then verifies the image is removed across pool types. The staging probe only covered ARM state/interval.
8. **Node Restriction source conflicts with staging result.** The case expects Node Restriction auto-enabled for K8s >= 1.24 and impossible to disable with a specific error substring. The staging probe did not persist the profile; this is a strong signal for source/spec/feature-gate investigation before another run.
9. **Bootstrap profile source adds runtime image-pull and registry lifecycle.** Managed-ACR path expects cache registry assignment, Direct disable cleanup, Cache re-enable, and image pull after each state. BYO-ACR path expects exact registry ID and ACR switching.
10. **VirtualMachines source favors REST/profile semantics over CLI help.** Mixed SKU source explicitly creates two manual profiles and validates scale transitions through AgentPool and ManagedCluster PUT; the CLI comma-multi-SKU failure should not be treated as the whole mixed-SKU contract.
11. **NAP source links Auto mode to a default Machines pool.** `Scenario_MachinesAgentPoolNAPEnabled` expects an `aksmanagedap` Machines pool plus Machine CRUD and cleanup when switching to Manual; current NAP probes verify profile state only.

## 5. Candidate model updates

Do not edit `outputs/e2e-capability-model.json` yet unless the team wants a dedicated model-completeness iteration. The source inventory supports these proposed additions:

### New or expanded input variables

- `managedSystem.clusterCreate.shape`: initial ManagedSystem pool with `count=0/type=nil` vs existing-pool add minimal request.
- `managedSystem.disable.operation`: delete ManagedSystem pool and migrate workloads to System pool.
- `managedSystem.runtime.validation`: taints, critical add-on affinity/placement, VAP/VAPBinding, customer workload restriction.
- `appRouting.controller.kind`: `nginx-ingress` vs `istio-gateway-api`.
- `appRouting.tls.lifecycle`: initial certificate, rotation, post-upgrade validation.
- `identity.kubernetesVersion.branch`: OIDC default-enabled `>=1.34` vs explicit enable `1.33.x`.
- `identity.runtime.os`: Linux pod vs Windows pod workload identity validation.
- `workloadAutoScalerProfile.keda.enabled` and `workloadAutoScalerProfile.verticalPodAutoscaler.enabled` as first-class JSON input variables.
- `securityProfile.imageCleaner.enabled`, `securityProfile.imageCleaner.intervalHours`, and `securityProfile.nodeRestriction.enabled` as first-class JSON input variables.
- `bootstrapProfile.registry.kind`: AKS-managed ACR vs BYO ACR; plus `bootstrapProfile.operation=disable/re-enable/switch-registry`.
- `agentPool.mode=Machines` / `machinesApi.operation`: Machine create/get/update/list/delete.
- `nodeProvisioning.defaultMachinesPool`: existence/cleanup of NAP-created `aksmanagedap` Machines pool.

### New or expanded expectation variables

- `managedSystem.workloads.unschedulable`, `managedSystem.criticalAddons.affinity`, `managedSystem.vap.present`, `managedSystem.disable.migrationSucceeded`.
- `appRouting.tls.cert.hostnameValid`, `appRouting.tls.cert.notExpired`, `appRouting.tls.cert.rotated`, `appRouting.traffic.postUpgradeReachable`.
- `appRouting.nginx.crdAbsentWhenDisabled`, `appRouting.nginx.deploymentReadyWhenEnabled`, `appRouting.nginx.deploymentDeletedWhenDisabled`.
- `identity.oidc.discoveryReachable`, `identity.oidc.jwksValid`, `identity.oidc.signingKeysRotated`, `identity.oidc.documentDeletedAfterClusterDelete`.
- `identity.workloadIdentity.linuxTokenProjected`, `identity.workloadIdentity.windowsTokenProjected`, `identity.workloadIdentity.disableReenablePersisted`.
- `keda.resources.present`, `keda.workload.scaled`, `keda.resources.absentAfterDisable`, `keda.survivesUpgrade`.
- `vpa.helmRelease.present`, `vpa.components.ready`, `vpa.recommendations.generated`, `vpa.inplaceUpdate.observed`, `vpa.haReplicas.expected`, `vpa.certRenewal.valid`.
- `imageCleaner.components.present`, `imageCleaner.components.absentAfterDisable`, `imageCleaner.vulnerableImage.removed`, `imageCleaner.survivesUpgrade`, `imageCleaner.survivesRestart`.
- `nodeRestriction.disableRejected` with error substring `Node restriction is required`.
- `bootstrapProfile.imagePull.succeeds`, `bootstrapProfile.registry.cleanedOnDisable`, `bootstrapProfile.registryId.matchesBYO`.
- `machinesApi.machine.crudSucceeded`, `machinesApi.unsupportedUltraSSD.rejected`, `nap.defaultMachinesPool.deletedOnManual`.

### New or expanded test cases / feature links

- Add first-class test cases for `Scenario_Keda`, `Scenario_Keda_CRUD`, `Scenario_Keda_Upgrade`, and VPA overlay scenarios; link iteration61 only as **state evidence**, not runtime evidence.
- Add first-class test cases for `Scenario_ImageCleaner` and `Node_Restriction`; link iteration62 as partial/contradictory evidence.
- Add `Scenario_WorkloadIdentity` and `Scenario_OIDC_Issuer*` runtime expectation links separate from public CLI state probes.
- Add `Scenario_NetworkIsolatedCluster_Bootstrap_Profile_Managed_ACR` / `BYO_ACR` to split managed-vs-BYO registry and runtime image pull from artifactSource state.
- Add `Scenario_Mixed_SKU_Scale`, `Scenario_Autoscaled_VMs_CRUD`, `Scenario_MachinesAgentPool`, and `Scenario_MachinesAgentPoolNAPEnabled` to distinguish CLI VirtualMachines profile probes from handwritten REST/Machines API intent.
- Add `Scenario_Traffic_AppRouting_DefaultDomain_Istio_HelloWorld` and App Routing TLS rotation/upgrade expectations.

### Missing evidence links to add once model is edited

- `outputs/iteration61-workload-autoscaler-staging.md` should link to KEDA/VPA **profile persistence only**.
- `outputs/iteration62-security-profile-staging.md` should link to Image Cleaner **state pass** and Node Restriction **state/path failure**.
- `outputs/iteration69-app-routing-defaultdomain-traffic-staging.md` should remain HTTP/DNS only; it must not be linked as TLS success.
- `outputs/iteration70-app-routing-defaultdomain-tls-staging.md` should link to `tls.secret.provisioned=false`, not generic HTTPS success because curl used nginx fake fallback cert.

## 6. Recommended next action

**Recommended next step: local model-completeness edits, not a cloud probe.**

The inventory confirms that `outputs/e2e-capability-model.json` materially under-represents already-evidenced and source-confirmed areas: workload autoscaler, security profile, runtime identity, bootstrap lifecycle, Machines API/NAP default pool, and App Routing Istio/rotation branches. The highest-value next iteration should update the JSON model to add first-class input/expectation variables and test-case links for the unambiguous source-derived surfaces above, while marking existing staging artifacts as partial evidence where they only prove ARM state.

After that local model update, the first source/owner investigation should be **Node Restriction or App Routing TLS**, not a blind run:

- Node Restriction has a direct contradiction between handwritten intent (auto-enabled and cannot disable) and iteration62 staging behavior (not persisted via attempted path).
- App Routing TLS has a reproduced failing behavior and rich source diagnostics/rotation assumptions; owner/source investigation should identify a concrete precondition or bug before rerun.
