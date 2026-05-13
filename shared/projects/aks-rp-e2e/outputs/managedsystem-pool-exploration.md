# ManagedSystem Pool Feature Exploration

**Date**: 2026-05-13  
**Cluster**: `ms-pool-add-1778659071` (westus2, openclaw-rg)  
**Subscription**: `26fe00f8-9173-4872-9134-bb1d2e00343a` (AKS INT/Staging Test)

## Feature Overview

ManagedSystem pool is a new AKS pool mode where Azure fully manages the system node pool — VM sizing, scaling, and lifecycle. Users only specify intent (mode=ManagedSystem), and the RP determines everything else.

| Property | Value |
|----------|-------|
| Mode | `ManagedSystem` |
| Type | `VirtualMachines` (not VMSS) |
| VM Size | `null` (Azure determines — chose `Standard_DS4_v2`) |
| Node Count | `null` (Azure determines — provisioned 2 nodes) |
| Taints | `CriticalAddonsOnly=true:NoSchedule`, `CriticalAddonsOnly=true:NoExecute` |
| Limit | Max 1 ManagedSystem pool per cluster |
| Toggle owner | Hao Yuan, sig: clusterlifecycle |

## Test Results

### ✅ Scenario 2: Add ManagedSystem Pool to Existing Cluster (via REST API)

**Steps executed:**
1. Created normal cluster: `az aks create --resource-group openclaw-rg --name ms-pool-add-1778659071 --node-count 1 --enable-managed-identity --generate-ssh-keys --location westus2` → Succeeded
2. Added ManagedSystem pool via REST API:
   ```
   PUT .../agentPools/mspool01?api-version=2025-04-02-preview
   Body: {"properties":{"mode":"ManagedSystem"}}
   ```
   → Succeeded after ~10 minutes

**Verification results:**
- Pool `mspool01`: mode=`ManagedSystem`, type=`VirtualMachines`, vmSize=`null`, count=`null`, provisioningState=`Succeeded`
- Azure auto-selected: 2× `Standard_DS4_v2` (visible in `virtualMachineNodesStatus`)
- 2 nodes running: `aks-mspool01-28893367-vms1`, `aks-mspool01-28893367-vms2`
- Taints correctly applied on both nodes: `CriticalAddonsOnly=true:NoSchedule` and `CriticalAddonsOnly=true:NoExecute`
- Original nodepool1 was cordoned (`SchedulingDisabled`) — system workloads migrate to ManagedSystem pool

### ❌ Scenario 1: Create Cluster with --enable-managed-system-pool (CLI Bug)

**Command:** `az aks create --resource-group openclaw-rg --name ms-pool-test-... --enable-managed-system-pool --enable-managed-identity --generate-ssh-keys --location westus2`

**Error:**
```
ManagedSystem pool 'nodepool1' can only specify 'name' and 'mode' fields.
Found non-default values for: OSTypeCasePreserved, availabilityProfile, count,
networkProfile, osType, scaleSetPriority, workloadRuntime
```

### ❌ Scenario 2 via CLI: Add Pool with `az aks nodepool add --mode ManagedSystem`

**Same error** — CLI sends default values that the RP rejects. Only the REST API (sending just `{"properties":{"mode":"ManagedSystem"}}`) works.

## Key Finding: CLI Bug

**The `aks-preview` extension (v20.0.0b6) does not properly strip default agent pool fields when mode=ManagedSystem.** The RP validates that ManagedSystem pools must only specify `name` and `mode`, but the CLI populates defaults for `osType`, `count`, `availabilityProfile`, etc.

**Workaround:** Use `az rest` with the ARM API directly, sending only `{"properties":{"mode":"ManagedSystem"}}`.

**Impact:** Users cannot create ManagedSystem pools through the standard CLI flow. This is a blocking CLI bug.

## Toggle Configuration

The feature is enabled for:
- `deploy-env: e2e` (always)
- `deploy-env: staging` in `westus2` and `eastus2euap`
- Specific subscriptions including the test subscription `26fe00f8-...`

Default: `false` (not generally available)

## Related Code Paths

| Path | Purpose |
|------|---------|
| `test/e2ev3/mutate/clean_managedsystem_pool.go` | e2ev3 mutator for cleaning ManagedSystem pools |
| `test/e2ev3/validate/agent_pool/managedsystem_pool.go` | e2ev3 validation logic |
| `test/e2ev3/sigs/rp/nativerp/plans/managedsystem*.go` | e2ev3 test plans (lifecycle, reconcile) |
| `test/e2ev3/sigs/rp/virtualmachine/suites/managedsystem.go` | VM-based test suite |
| `resourceprovider/server/.../poolmode/managedsystem_validator_test.go` | RP-side validation |
| `nodeprovisioner/server/pkg/handlers/handler_agentpool_managedsystempool_test.go` | Node provisioner handling |

## Cleanup

Test cluster `ms-pool-add-1778659071` deletion initiated (async, `--no-wait`).  
Pre-existing cluster `openclaw-mspool2` remains in `Failed` (stopped) state — not touched.
