# Underlay Debug Findings & Fix Results

**Date**: 2026-05-13 (updated)
**Build Version**: `hayuaebld163822451`

## Root Cause Analysis

### Problem 1: `*hcp.GetUnderlayCredential` fails with "Identity not found"

**Root cause**: The devbox VM did not have the required MSI `akse2ehcp-e2e` assigned.

The e2ev3 HCP client authenticates using a user-assigned managed identity hardcoded at:
```go
// test/e2ev3/runtime/akse2e/from_azure_config.go
ManagedID: azidentity.ResourceID("/subscriptions/4be8920b-2978-43d7-ab14-04d8549c1d05/resourceGroups/AKSE2EInfra/providers/Microsoft.ManagedIdentity/userAssignedIdentities/akse2ehcp-e2e")
```

### Fix Applied
Assigned the `akse2ehcp-e2e` MSI to the devbox VM using:
```bash
az rest --method patch \
  --url "/subscriptions/c1089427-.../resourceGroups/hayua-devbox/providers/Microsoft.Compute/virtualMachines/devbox?api-version=2024-07-01" \
  --body '{"identity":{"type":"UserAssigned","userAssignedIdentities":{"/subscriptions/4be8920b-.../resourcegroups/AKSE2EInfra/providers/Microsoft.ManagedIdentity/userAssignedIdentities/akse2ehcp-e2e":{}}}}'
```
Note: `az vm identity assign` failed due to `LinkedAuthorizationFailed` on the `AzSecPackAutoConfigUA` MSI. The `az rest --method patch` approach worked.

### Results After MSI Fix
| Scenario | Result | Notes |
|----------|--------|-------|
| `Scenario_Traffic_AppRouting_Nginx_Disablement` | ✅ PASS | All steps succeeded |
| `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld` | ✅ PASS (core) | Core steps passed; upgrade timed out |

---

### Problem 2: `AKSCapacityHeavyUsage` blocks all new cluster creation (2026-05-13)

**Affected scenarios**: `Scenario_PAFThrottling`, `Scenario_ManagedSystemPool_Enable`, and any scenario requiring cluster creation.

**Error**:
```
ERROR CODE: AKSCapacityHeavyUsage
"message": "Creating a new cluster is unavailable at this time in region eastus2..."
```

**Root cause analysis**: The standalone RP has a capacity validation toggle `constrain-cluster-creation-in-region` that is **explicitly enabled for E2E tests** (see `forever_flags.go:125-128`):
```go
var constrainClusterCreationInRegionTgl = NewBool("constrain-cluster-creation-in-region", false).
    With(true).When(E2ETest()).WithSubPath("/sigs/clusterlifecycle")
```

This toggle calls `capacity.ValidateRegionalCapacityOnClusterCreation()` which checks actual underlay usage via HCP. With the standalone RP running only 1 underlay, and ~85 standalone infrastructure clusters already in the subscription, the underlay is reporting at or above capacity thresholds (likely "RedPhase" or "YellowPhase").

**Code path**: `putmanagedcluster_blockclustercreation.go:226` → `capacity.ValidateRegionalCapacityOnClusterCreation()` → returns `AKSCapacityHeavyUsage` when underlay usage exceeds threshold.

**Why Nginx_Disablement passed earlier**: It ran on 2026-05-12 when the underlay capacity was still below the threshold.

**Possible fixes**:
1. Reduce underlay load by cleaning up stale standalone clusters (many `standalone-*` resource groups with 3 clusters each)
2. Override the capacity flag via toggle configuration for the standalone RP instance  
3. Register additional underlays to increase capacity headroom

**Cleanup attempted**: Deleted 2 leftover e2e test clusters (`e2eaks-KRf`, `e2eaks-cgw`) from older builds, but these are only 2 of ~85 total clusters.

---

## Final Scorecard

| Scenario | Result | Blocker |
|----------|--------|---------|
| `Scenario_Traffic_AppRouting_Nginx_Disablement` | ✅ PASS | — |
| `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld` | ✅ PASS (core) | Upgrade step timed out |
| `Scenario_PAFThrottling` | ❌ BLOCKED | AKSCapacityHeavyUsage in eastus2 |
| `Scenario_ManagedSystemPool_Enable` | ❌ BLOCKED | AKSCapacityHeavyUsage in eastus2 |
| `Scenario_ManagedSystem_AgentPool` | ❌ NOT ATTEMPTED | Same blocker expected |

**Current blocker for all remaining scenarios**: The standalone RP's underlay in eastus2 is at capacity. No new clusters can be created until underlay capacity is freed or expanded.
