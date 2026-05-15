# Underlay Debug Findings & Fix Results

**Date**: 2026-05-13 (updated 2026-05-14)
**Build Version**: `hayuaebld163822451`

## Root Cause Analysis

### Problem 1: `*hcp.GetUnderlayCredential` fails with "Identity not found" — FIXED ✅

**Root cause**: The devbox VM did not have the required MSI `akse2ehcp-e2e` assigned.

The e2ev3 HCP client authenticates using a user-assigned managed identity hardcoded at:
```go
// test/e2ev3/runtime/akse2e/from_azure_config.go
ManagedID: azidentity.ResourceID("/subscriptions/4be8920b-2978-43d7-ab14-04d8549c1d05/resourceGroups/AKSE2EInfra/providers/Microsoft.ManagedIdentity/userAssignedIdentities/akse2ehcp-e2e")
```

**Fix Applied**: Assigned the `akse2ehcp-e2e` MSI to the devbox VM using:
```bash
az rest --method patch \
  --url "/subscriptions/c1089427-.../resourceGroups/hayua-devbox/providers/Microsoft.Compute/virtualMachines/devbox?api-version=2024-07-01" \
  --body '{"identity":{"type":"UserAssigned","userAssignedIdentities":{"/subscriptions/4be8920b-.../resourcegroups/AKSE2EInfra/providers/Microsoft.ManagedIdentity/userAssignedIdentities/akse2ehcp-e2e":{}}}}'
```

### Problem 2: `AKSCapacityHeavyUsage` blocks all cluster creation — ACTIVE BLOCKER ❌

**Root cause**: The standalone RP's single underlay in eastus2 is at or above 95% capacity, triggering the `RedPhase` capacity constraint.

**How the capacity check works** (traced through code):
1. RP toggle `constrain-cluster-creation-in-region` is `true` for E2E tests (`forever_flags.go:125-128`)
2. On PUT ManagedCluster, RP calls `blockClusterCreationBasedConstrainedRegionPlan()` (`putmanagedcluster_blockclustercreation.go:222`)
3. This calls `RPHCPClient.GetAggregatedUnderlaysUsage()` to get region capacity status
4. HCP computes `usage = currentUsage / totalCapacity` per underlay type (az/non-az, public/private)
5. Thresholds (`hcp/server/flags/flags.go:253-260`):
   - Yellow: enter ≥0.88, exit <0.86
   - Orange: enter ≥0.90, exit <0.88
   - **Red: enter ≥0.95, exit <0.93**
6. At `RedPhase`, ALL new cluster creation is blocked (returns `AKSCapacityHeavyUsage`)

**Current state**: 70 clusters in the subscription (37 Failed, ~33 Succeeded). The underlay's `Capacity` field determines the denominator. With usage ≥ 95% of capacity, the region is in `RedPhase`.

**Evidence** (PAFThrottling run 2026-05-14):
```
RESPONSE 400: 400 Bad Request
ERROR CODE: AKSCapacityHeavyUsage
"message": "Creating a new cluster is unavailable at this time in region eastus2."
```

## Scenarios That Work (no cluster creation needed)

| Scenario | Result | Notes |
|----------|--------|-------|
| `Scenario_Traffic_AppRouting_Nginx_Disablement` | ✅ PASS | All steps succeeded (uses pre-existing cluster) |
| `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld` | ✅ PASS (core steps) | Core steps pass; k8s upgrade step timed out at 30min |

## Scenarios Blocked by Capacity

| Scenario | Result | Notes |
|----------|--------|-------|
| `Scenario_PAFThrottling` | ❌ BLOCKED | Cluster creation fails with AKSCapacityHeavyUsage |
| `Scenario_ManagedSystemPool_Enable` | ❌ BLOCKED | Same — requires new cluster |
| Any scenario using `plans.SingleCluster` | ❌ BLOCKED | All require PUT ManagedCluster |

## Unblock Options (in order of preference)

### Option 1: Clean up stale clusters to reduce usage below 93% (RedPhase exit)
Delete failed/unused clusters from the subscription to bring usage below the exit threshold.
- 37 clusters are in `Failed` state, but most belong to other users (kingoliver, pablo, vitto, etc.)
- Only 2 are ours: `e2eaks-SdF`, `e2eaks-CtO` (deletion initiated 2026-05-14)
- **Need**: Delete ~5+ more clusters (from other users or old builds) to get below 93%
- **Action**: Ask Hao to clean up stale clusters from the subscription

### Option 2: Increase the underlay capacity setting
The underlay's `Capacity` field is the denominator. Increasing it lowers the usage percentage.
- **Action**: Update the underlay registration to increase capacity (via HCP admin API or underlay config)

### Option 3: Disable the capacity check toggle for this standalone RP
Override the `constrain-cluster-creation-in-region` toggle to `false`.
- This toggle is baked into the binary with `With(true).When(E2ETest())` — cannot be changed at runtime via config
- **Would require**: Rebuilding the binary or using a toggle override service

### Option 4: Use the custom header bypass
The toggle `allow-custom-constrain-region-threshold` is `true` for E2E. The test framework can pass:
```
custom-region-capacity-status: GreenPhase
```
But this header needs to be injected by the e2e test client, which doesn't do this by default.

## E2E Run Command Reference
```bash
# Build and run (requires Go in PATH):
export PATH=/usr/local/go/bin:$PATH
cd /home/hayua/rp
./test/e2ev3/hack/e2ev3 dev --build-version=hayuaebld163822451 -s <SCENARIO_NAME> --test-region eastus2
```

## Dangling Resources
- `e2eaks-SdF` in `e2erg--260512-1911-ZSBBirBIqxH` — deletion initiated
- `e2eaks-CtO` in `e2erg--260513-1042-FTLaDSSVfio` — deletion initiated
- `e2erg-bld163822451-fbYIEkIxxHU` — resource group created by PAFThrottling run (no cluster, can be deleted)
