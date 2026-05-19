# Iteration 74 — Node Restriction source/spec contradiction resolution

**Created:** 2026-05-19  
**Scope:** source/spec/local artifact update only. No staging, `az`, cluster creation, or cloud probe was run.  
**Question:** why does handwritten e2ev3 expect Node Restriction to be enabled/cannot-disable while iteration62 staging showed `securityProfile.nodeRestriction=null` and a PATCH body did not persist?

## Inputs reviewed

- `outputs/e2ev3-handwritten-coverage-inventory.md`
- `outputs/iteration62-security-profile-staging.md`
- `outputs/iteration73-capability-model-source-inventory-update.md`
- Remote source under `devbox:/home/hayua/rp`:
  - `test/e2ev3/sigs/ccp/plans/node_restriction.go`
  - `swagger/private-swagger/resource-manager/Microsoft.ContainerService/aks/preview/versionless/managedClusters.json`
  - `swagger/awesome/models.go`
  - `resourceprovider/server/microsoft.com/containerservice/server/validation/noderestriction/{validator.go,errors.go,mutator.go,validator_test.go}`
  - `resourceprovider/server/microsoft.com/containerservice/server/validation/{mc_validator_prepare_create_cluster.go,mc_validator_update_helper.go,mc_validator_validate_and_update_helper.go}`
  - `resourceprovider/server/microsoft.com/containerservice/server/operations/managedcluster/patchmanagedcluster/patchmanagedcluster.go`
  - `overlaymgr/server/helmvalues/common/common.go`
  - `overlaymgr/server/helmvalues/featureflag/reader.go`
  - `resourceprovider/server/microsoft.com/i18n/stringsresource.go`

## Findings

### 1. The iteration62 PATCH was the wrong operation shape for this property

The public/private swagger exposes `nodeRestriction` under `ManagedClusterSecurityProfile`, but the managed-cluster `patch` operation is tag-only:

- swagger path `/managedClusters/{resourceName}` has `put ManagedClusters_CreateOrUpdate` with body `#/definitions/ManagedCluster`.
- The same path has `patch ManagedClusters_UpdateTags` with body `#/definitions/TagsObject`.

The RP implementation matches that swagger. `resourceprovider/.../operations/managedcluster/patchmanagedcluster/patchmanagedcluster.go` defines:

```go
type PatchRequestBody struct {
    Tags map[string]string `json:"tags,omitempty"`
}
```

and `Decode` logs/handles unsupported fields as patch-only-tags behavior. Therefore iteration62's command:

```bash
az rest --method patch \
  --url "https://management.azure.com${ID}?api-version=2025-04-02-preview" \
  --body '{"properties":{"securityProfile":{"nodeRestriction":{"enabled":true}}}}'
```

was not a valid ManagedCluster create/update operation for `securityProfile.nodeRestriction`. Its observed `error=null` plus `securityProfile={}`/follow-up null should be reclassified as **invalid/irrelevant PATCH shape**, not proof that Node Restriction PUT/update cannot persist.

### 2. Source contract is explicit: PUT/create-or-update validates Node Restriction

The e2ev3 test uses the SDK `BeginCreateOrUpdate` path through `PutManagedCluster`, not PATCH:

- `test/e2ev3/.../node_restriction.go` creates a cluster with `SecurityProfile.NodeRestriction.Enabled=true`.
- The disable step copies the current full managed-cluster response into `PutManagedCluster.Request`, sets `NodeRestriction.Enabled=false`, and expects the PUT/update to fail.
- `test/e2ev3/handlers/azure/azcontainerservice/aks_managed_cluster.go` calls `mcClient.BeginCreateOrUpdate(...)` for `PutManagedCluster`.

The RP validator confirms the intended API behavior:

- `ValidateCreate` returns `NodeRestrictionRequired` when k8s `>= 1.24.0` and input sets `nodeRestriction.enabled=false`.
- `ValidateUpdate` backfills from existing MC, then returns `NodeRestrictionRequired` when k8s `>= 1.24.0` and input sets `nodeRestriction.enabled=false`.
- The expected message is from `i18n.NodeRestrictionRequired`: `Node restriction is required on version %s or above.`
- The validator only runs if the input has `SecurityProfile.NodeRestriction`; nil input passes.

This matches the handwritten e2ev3 expectation for a full create/update path, with the more precise error substring `Node restriction is required`.

### 3. There are two layers: ARM-visible profile and runtime admission plugin

`overlaymgr/server/helmvalues/common/common.go` has runtime/defaulting behavior independent of whether the ARM response includes the profile object:

```go
if k8sVersion.Equal(version_1_24_0) || k8sVersion.GreaterThan(version_1_24_0) {
    // Set node restriction to true for 1.24.0 or above
    return true
}
```

`featureflag.Reader.EnableNodeRestriction` defaults the rollout flag `enable-node-restriction` to true, and the kube-apiserver chart gates `NodeRestriction` admission plugin on `nodeRestrictionEnabled` and RBAC. This means a k8s >= 1.24 RBAC cluster can have runtime NodeRestriction enabled even when the ARM `securityProfile.nodeRestriction` property is omitted/null.

Iteration62's baseline `az aks show` with `nodeRestriction=null` is therefore not enough to refute runtime NodeRestriction enablement. It only says the public ARM response did not include an explicit profile object for that CLI-created cluster.

### 4. TLS bootstrap is a hidden precondition for explicit enablement below the >=1.24 required branch

The validator also rejects explicit `nodeRestriction.enabled=true` unless `CheckEnableAgentNodeKubeletClientTLSBootstrap` passes. That helper requires:

1. the header `EnableAgentNodeKubeletClientTLSBootstrap` is not explicitly `false`,
2. the corresponding rollout is enabled,
3. the cluster has RBAC or had TLS bootstrap enabled before.

For k8s >= 1.24, explicit `enabled=false` fails before the TLS-bootstrap check. For versions 1.22/1.23, explicit enablement depends on TLS bootstrap/RBAC conditions. The e2ev3 scenario sets RBAC true and Azure CNI.

### 5. The e2ev3 description slightly overstates ARM auto-population

The source says "automatically enabled for K8s >= 1.24" and then creates the cluster with an explicit `SecurityProfile.NodeRestriction.Enabled=true`. The runtime renderer does auto-enable the admission plugin for >=1.24, but the API validator/mutator does not appear to synthesize a non-nil `securityProfile.nodeRestriction` response when the client omits the property. `SetNodeRestriction` copies the input value and sets nil when input is nil.

So the clean model is:

- **Runtime default contract:** NodeRestriction admission plugin should be enabled for RBAC clusters on k8s >= 1.24.
- **Explicit profile contract:** if the client explicitly sets `securityProfile.nodeRestriction.enabled=true`, create/update should preserve/accept it when preconditions hold.
- **Disable contract:** for k8s >= 1.24, an explicit full PUT/update setting `enabled=false` should be rejected with `Node restriction is required on version 1.24.0 or above.`
- **Non-contract:** tag-only ManagedCluster PATCH is not a valid way to update `securityProfile.nodeRestriction`.

## Resolution of the contradiction

The contradiction is mostly resolved as an operation-shape mismatch:

- Iteration62 tested `PATCH` against a property that swagger and RP code classify under full `PUT ManagedClusters_CreateOrUpdate`, while PATCH is tag-only.
- The handwritten e2ev3 and RP validator both target full create/update semantics.
- `nodeRestriction=null` in a public CLI-created cluster does not disprove runtime NodeRestriction for k8s >= 1.24 because overlay runtime logic enables it by version/RBAC even when the ARM profile is omitted.

What remains uncertain is observed public/staging behavior for the full PUT path: no current artifact proves that a full ManagedCluster PUT with `securityProfile.nodeRestriction.enabled=true`, followed by PUT `enabled=false`, reaches the expected reject/error shape in staging.

## Capability-model update made

Updated `outputs/e2e-capability-model.json` to avoid treating the iteration62 PATCH as a failing disable-contract execution:

- Added input variable `securityProfile.nodeRestriction.operation` with values:
  - `create-or-update-put`
  - `tag-only-patch`
  - `runtime-default`
  - `unknown`
- Added expectation variable `nodeRestriction.runtimeAdmission.enabled`.
- Added feature `node-restriction-runtime-default` for the source/runtime >=1.24 admission-plugin default.
- Added feature `node-restriction-tag-only-patch-shape` so iteration62 PATCH evidence is represented separately from the full PUT disable contract.
- Adjusted feature `node-restriction-disable-contract` to include `securityProfile.nodeRestriction.operation=create-or-update-put`.
- Adjusted `Node_Restriction` test case to include the full PUT operation shape.
- Reclassified `NodeRestriction_RESTPatch_Staging` from `fail` to `unknown`, moved it to the `tag-only-patch` operation shape under feature `node-restriction-tag-only-patch-shape`, and changed its notes to say it is invalid/irrelevant for the disable contract rather than contradictory failure evidence.
- Added source-only `NodeRestriction_RuntimeDefault_Source` test case for the runtime admission-plugin default, result `unknown`.
- Updated iteration62 evidence summary to call the PATCH evidence invalid/irrelevant for the PUT contract.

## Validator output

Command:

```bash
cd /app/projects/aks-rp-e2e/capability-model
bun src/validate.ts ../outputs/e2e-capability-model.json
```

Exit: `0`.

Key summary:

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
    "node-restriction-disable-contract",
    "node-restriction-runtime-default",
    "node-restriction-tag-only-patch-shape"
  ]
}
```

Node Restriction is no longer classified as an observed failing feature based on the iteration62 PATCH; it is a source-confirmed, unexecuted full-PUT/runtime contract.

## Recommended next action

Do not run a blind PATCH retry. If Node Restriction is selected for execution later, use one focused staging probe with the correct operation shape:

1. Create a small RBAC cluster with k8s >= 1.24 and explicit `securityProfile.nodeRestriction.enabled=true` using ManagedCluster full PUT/create-or-update (or an e2ev3 scenario), not PATCH.
2. GET and record whether ARM returns the explicit profile.
3. Full PUT the returned ManagedCluster with `securityProfile.nodeRestriction.enabled=false`.
4. Expect HTTP 400/BadRequest with message containing `Node restriction is required on version 1.24.0 or above.`
5. Separately, if runtime default is the target, inspect the kube-apiserver admission plugins or equivalent runtime signal rather than relying only on `az aks show securityProfile.nodeRestriction`.
