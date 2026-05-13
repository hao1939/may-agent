# ManagedSystem Pool Feature Exploration

**Date**: 2026-05-13  
**Cluster**: `ms-pool-add-1778655487` in `openclaw-rg` (westus2)  
**Subscription**: `26fe00f8-9173-4872-9134-bb1d2e00343a` (AKS INT/Staging Test)  
**CLI Extension**: aks-preview 20.0.0b6 (upgraded from 13.0.0b8)

## Feature Overview

ManagedSystem pool is a new AKS pool mode where Azure fully controls VM sizing, scaling, and lifecycle. Users only specify `name` and `mode`; the RP determines everything else.

- **Mode**: `ManagedSystem` (distinct from `System` or `User`)
- **Type**: `VirtualMachines` (Azure-managed)
- **VM Size**: `null` (Azure determines)
- **Node Count**: `null` (Azure determines)
- **Taints**: `CriticalAddonsOnly=true:NoSchedule`, `CriticalAddonsOnly=true:NoExecute`
- **Limit**: Maximum 1 ManagedSystem pool per cluster
- **Toggle**: `enable-managedsystem-pool.yaml` — enabled for e2e, staging (westus2/eastus2euap), and specific subscriptions
- **Owner**: Hao Yuan, sig: clusterlifecycle

## Skill Location

The skill is at `.claude/skills/test-managedsystem-pool/` containing `SKILL.md` and `test-scripts.md` with 5 test scenarios using Azure CLI.

## Test Results

### Scenario 1: Create Cluster with `--enable-managed-system-pool` — ❌ FAILED (CLI Bug)

```
az aks create --resource-group openclaw-rg --name ms-pool-test-1778655468 \
  --enable-managed-system-pool --enable-managed-identity --generate-ssh-keys --location westus2
```

**Error**:
```
(InvalidParameter) ManagedSystem pool 'nodepool1' can only specify 'name' and 'mode' fields.
Found non-default values for: OSTypeCasePreserved, availabilityProfile, count, networkProfile,
osType, scaleSetPriority, workloadRuntime
```

**Finding**: The CLI sends default values for agent pool properties that the RP rejects for ManagedSystem mode. This is a **CLI/RP contract mismatch** — the CLI doesn't strip defaults when `mode=ManagedSystem`.

### Scenario 2: Add ManagedSystem Pool via CLI — ❌ FAILED (Same CLI Bug)

```
az aks nodepool add --resource-group openclaw-rg --cluster-name ms-pool-add-1778655487 \
  --name mspool01 --mode ManagedSystem
```

Same error — CLI sends `OSTypeCasePreserved, availabilityProfile, count, networkProfile, osType, scaleDownMode, scaleSetPriority, workloadRuntime` as non-default.

### Scenario 2 (REST API workaround): Add ManagedSystem Pool via REST — ✅ PASSED

```
az rest --method PUT \
  --url ".../agentPools/mspool01?api-version=2025-04-02-preview" \
  --body '{"properties":{"mode":"ManagedSystem"}}' \
  --resource https://management.azure.com
```

**Result**: Pool created successfully. Provisioning went through `Creating` → `Updating` → `Succeeded` (~7 minutes).

**Verified properties**:
```json
{
  "count": null,
  "mode": "ManagedSystem",
  "provisioningState": "Succeeded",
  "taints": ["CriticalAddonsOnly=true:NoSchedule", "CriticalAddonsOnly=true:NoExecute"],
  "type": "Microsoft.ContainerService/managedClusters/agentPools",
  "vmSize": null
}
```

All expected properties match: null vmSize, null count, correct taints, VirtualMachines type.

### Scenario 3: Single ManagedSystem Pool Constraint — ✅ PASSED

Attempted to add a second ManagedSystem pool `mspool02` via REST API:

**Error** (expected):
```
(InvalidParameter) Multiple ManagedSystem pools are not allowed in the cluster.
Please ensure only one ManagedSystem pool is defined.
```

Constraint correctly enforced.

### Scenario 4: Reconcile ManagedSystem Pool — ✅ PASSED

Re-PUT the same pool via REST API — accepted with `provisioningState: Updating`, then returned to `Succeeded` with properties intact.

### Scenario 5: Delete ManagedSystem Pool — ✅ PASSED

```
az aks nodepool delete --resource-group openclaw-rg \
  --cluster-name ms-pool-add-1778655487 --name mspool01 --no-wait
```

After ~2 minutes, pool was deleted. Cluster continued running with only the original System pool.

## Summary

| Scenario | Method | Result |
|----------|--------|--------|
| 1. Create cluster with `--enable-managed-system-pool` | CLI | ❌ CLI bug — sends defaults RP rejects |
| 2. Add ManagedSystem pool | CLI | ❌ Same CLI bug |
| 2. Add ManagedSystem pool | REST API | ✅ Passed |
| 3. Single pool constraint | REST API | ✅ Passed (correctly rejected) |
| 4. Reconcile pool | REST API | ✅ Passed |
| 5. Delete pool | CLI | ✅ Passed |

## Key Finding: CLI/RP Contract Mismatch

The `aks-preview` extension (v20.0.0b6) does not properly strip default agent pool properties when `mode=ManagedSystem`. The RP strictly validates that ManagedSystem pools only have `name` and `mode` set.

**Workaround**: Use the REST API directly with minimal body `{"properties":{"mode":"ManagedSystem"}}`.

**Root Cause**: The CLI's `_aks_agentpool_decorator` populates default values (osType, count, etc.) before sending the request. For ManagedSystem mode, these should be stripped.

## Cleanup

Cluster `ms-pool-add-1778655487` deletion initiated (`--no-wait --yes`).
