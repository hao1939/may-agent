# Iteration 73 capability-model source inventory update

**Created:** 2026-05-19  
**Scope:** local JSON/model work only. No staging, `az`, cluster creation, or cloud probe was run.  
**Primary source:** `outputs/e2ev3-handwritten-coverage-inventory.md`

## Model sections changed

Updated `outputs/e2e-capability-model.json` to convert the iteration72 handwritten e2ev3 inventory into first-class model structure:

- `inputVariables`: expanded from 18 to 34 variables.
  - Added first-class source-derived inputs for KEDA, VPA, Image Cleaner, Node Restriction, workload identity runtime OS, OIDC Kubernetes-version branch, bootstrap registry/lifecycle, App Routing controller/TLS lifecycle, ManagedSystem runtime/disable branches, Machines mode/API, and NAP default Machines pool.
- `expectationVariables`: expanded from 22 to 61 variables.
  - Added runtime/source expectations for KEDA resources/scaling/CRUD, VPA components/recommendations/in-place/HA/cert behavior, Image Cleaner components/erasure/lifecycle, Node Restriction disable error shape, workload identity Linux/Windows token projection, OIDC discovery/JWKS/signing-key rotation/document deletion, bootstrap image pull/cleanup/BYO registry match, App Routing TLS cert quality/rotation/post-upgrade and Istio reachability, ManagedSystem taints/add-on placement/VAP/workload restriction/disable migration, Machines API CRUD, and NAP default Machines pool cleanup.
- `features`: expanded from 25 to 46 features.
  - Existing staging/API-state surfaces remain separate from source-runtime surfaces, so profile persistence is not treated as runtime coverage.
- `testCases`: expanded from 26 to 48 test cases.
  - Added source-derived handwritten cases as `result: "unknown"` unless an existing artifact actually proves pass/fail.
  - Added partial staging state cases for KEDA/VPA and Image Cleaner, and contradictory Node Restriction staging evidence.
- `evidence`: expanded from 19 to 22 evidence refs.
  - Added `outputs/e2ev3-handwritten-coverage-inventory.md` as `kind: "source"`, not execution evidence.
  - Added iteration61 and iteration62 evidence refs with summaries explicitly scoped to partial state evidence.
  - Tightened App Routing iteration69/iteration70 summaries so HTTP/DNS and TLS-secret failure are not conflated with managed TLS success.

## Handwritten scenarios added or represented

Added first-class test cases/feature links for:

- `Scenario_Keda`
- `Scenario_Keda_CRUD`
- `Scenario_Overlay_VPA_Runtime` as a grouped representative for `Scenario_Overlay_VPA_*`
- `Scenario_ImageCleaner`
- `Node_Restriction`
- `Scenario_WorkloadIdentity`
- `Scenario_OIDC_Issuer`
- `Scenario_OIDC_Issuer_v133`
- `Scenario_NetworkIsolatedCluster_Bootstrap_Profile_Managed_ACR`
- `Scenario_NetworkIsolatedCluster_Bootstrap_Profile_BYO_ACR`
- `Scenario_Traffic_AppRouting_DefaultDomain_Istio_HelloWorld`
- `Scenario_Traffic_AppRouting_DefaultDomain_TLS_Lifecycle` for the source TLS rotation/post-upgrade branch
- `Scenario_ManagedSystem_AgentPool`
- `Scenario_ManagedSystemPool_Disable`
- `Scenario_Mixed_SKU_Scale`
- `Scenario_Autoscaled_VMs_CRUD`
- `Scenario_MachinesAgentPool`
- `Scenario_MachinesAgentPoolNAPEnabled`

Also added explicit partial staging/state test cases:

- `KEDA_ProfilePersistence_Staging`
- `VPA_ProfilePersistence_Staging`
- `ImageCleaner_StateInterval_Staging`
- `NodeRestriction_RESTPatch_Staging`

## Existing evidence now marked as partial

- `outputs/iteration61-workload-autoscaler-staging.md` is linked only to KEDA/VPA public API profile persistence. It does **not** prove KEDA resources/scaling or VPA Helm/components/recommendations.
- `outputs/iteration62-security-profile-staging.md` is linked to Image Cleaner state/interval persistence and a Node Restriction contradiction/failure. It does **not** prove Image Cleaner runtime erasure.
- `outputs/iteration69-app-routing-defaultdomain-traffic-staging.md` remains HTTP/DNS-only evidence for non-TLS default-domain traffic.
- `outputs/iteration70-app-routing-defaultdomain-tls-staging.md` remains TLS-secret provisioning failure evidence; the observed HTTPS backend reachability used nginx fake fallback cert and is not modeled as managed TLS success.
- `outputs/e2ev3-handwritten-coverage-inventory.md` is source-intent evidence only. Source-derived tests remain `unknown` unless an execution artifact proves observed behavior.

## Source-derived gaps still unexecuted

Highest-signal unknown modeled gaps after this update:

1. KEDA runtime resources/scaling plus disable/re-enable lifecycle.
2. VPA runtime recommendations, in-place update, HA/certificate behavior, and upgrade survival.
3. Image Cleaner component lifecycle and vulnerable-image erasure.
4. Workload identity Linux/Windows token projection and OIDC discovery/JWKS/rotation/document deletion behavior.
5. Bootstrap Profile managed/BYO ACR image-pull and registry cleanup/switch lifecycle.
6. App Routing Istio/Gateway default-domain reachability and TLS certificate rotation/post-upgrade behavior.
7. ManagedSystem runtime restrictions and disable migration back to System pool.
8. Machines API CRUD and NAP default Machines pool cleanup.

Node Restriction is now modeled as a failing/contradictory feature because source intent expects auto-enabled/cannot-disable behavior while iteration62 staging did not persist `securityProfile.nodeRestriction` through the attempted path.

## Validator command/output

Command run:

```bash
cd /app/projects/aks-rp-e2e/capability-model
bun src/validate.ts ../outputs/e2e-capability-model.json
```

Exit: `0`

Key summary from validator:

```json
{
  "observation": { "variables": 5 },
  "input": { "variables": 34, "paths": 10000, "truncated": true },
  "expectation": { "variables": 61, "paths": 10000, "truncated": true },
  "uncoveredFeatureIds": [],
  "failingFeatureIds": [
    "app-routing-default-domain",
    "paf-throttling",
    "managedsystem-pool-cli-create-cluster",
    "managedsystem-pool-cli-add-existing",
    "virtualmachines-agentpool-cli-add-multi-sku",
    "app-routing-default-domain-tls-secret",
    "node-restriction-disable-contract"
  ],
  "unknownFeatureIds": [
    "workload-autoscaler-keda-runtime",
    "workload-autoscaler-keda-crud",
    "workload-autoscaler-vpa-runtime",
    "image-cleaner-runtime-lifecycle",
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
    "machines-agentpool-nap-default-pool-cleanup"
  ]
}
```

The large path counts are expected after adding independent source-derived dimensions; the validator accepts the model.

## Recommended next action

Do **source/spec investigation before cloud execution**, starting with **Node Restriction**. The model now makes the contradiction explicit: handwritten e2ev3 intent says Node Restriction is auto-enabled and disable is rejected with a specific error shape, while iteration62 staging did not persist it through the attempted public path. Resolve API version, feature gate, precondition, or request-shape ambiguity before selecting another run.
