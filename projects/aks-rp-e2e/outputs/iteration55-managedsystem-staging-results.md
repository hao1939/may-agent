# ManagedSystem Pool Tests — Staging via az CLI (Iteration 55)

**Date:** 2026-05-16  
**Environment:** AKS INT/Staging Test (subscription `26fe00f8-9173-4872-9134-bb1d2e00343a`)  
**CLI:** az 2.86.0 + aks-preview 20.0.0b6  
**Region:** eastus2  

## Test Cluster
- RG: `mspool-test-rg`
- Cluster: `mspool-test` (1-node System pool, Standard_D8ds_v4)

## Test Results

### ✅ Scenario 1: Create ManagedSystem Pool (PASS)

**Method:** Direct REST API PUT (az CLI `nodepool add --mode ManagedSystem` fails due to CLI sending non-default fields)

```
PUT .../agentPools/msyspool?api-version=2025-04-02-preview
Body: {"properties":{"mode":"ManagedSystem"}}
```

**Result:** Pool created successfully.
- `provisioningState`: Succeeded
- `mode`: ManagedSystem  
- `type`: VirtualMachines (auto-selected)
- `vmSize`: Standard_D8ds_v4 (auto-selected, 2 nodes)
- `osDiskType`: Ephemeral
- `maxPods`: 250
- `nodeTaints`: `CriticalAddonsOnly=true:NoSchedule`, `CriticalAddonsOnly=true:NoExecute`
- `nodeImageVersion`: AKSUbuntu-2204gen2containerd-202604.24.0

**Key finding:** ManagedSystem pool only accepts `name` and `mode` — all other properties are managed by AKS. The CLI's `az aks nodepool add --mode ManagedSystem` sends defaults (osType, count, etc.) that the API rejects. Must use REST API directly.

**CLI bug filed?** No, but this is a known limitation — the CLI sets defaults that conflict with ManagedSystem's "only name+mode" constraint.

### ❌ Scenario 2: Convert ManagedSystem → System (NOT ALLOWED)

```
PUT .../agentPools/msyspool?api-version=2025-04-02-preview
Body: {"properties":{"mode":"System"}}
```

**Error:** `PropertyChangeNotAllowed: Changing property 'agentPoolProfile.mode' from 'ManagedSystem' to 'System' is not allowed.`

**Conclusion:** ManagedSystem pools cannot be converted back to System mode. This is by design — the mode is immutable once set.

### ✅ Scenario 3: Delete ManagedSystem Pool (PASS)

```
az aks nodepool delete -g mspool-test-rg --cluster-name mspool-test -n msyspool
```

**Result:** Pool deleted successfully. `provisioningState` transitioned to `Deleting` then pool was removed.

## Summary

| Scenario | Result | Notes |
|----------|--------|-------|
| Create ManagedSystem Pool | ✅ PASS | Must use REST API, not CLI |
| Convert ManagedSystem → System | ❌ NOT ALLOWED | By design (immutable mode) |
| Delete ManagedSystem Pool | ✅ PASS | Standard delete works |

## Key Findings

1. **ManagedSystem pools are fully AKS-managed**: Only `name` and `mode` can be specified; AKS auto-selects VM size, count, OS, etc.
2. **az CLI bug**: `az aks nodepool add --mode ManagedSystem` fails because CLI sends default values for fields that ManagedSystem mode rejects. Workaround: use `az rest` with direct REST API.
3. **Mode is immutable**: Cannot convert ManagedSystem → System (or presumably any other mode).
4. **Auto-provisioned resources**: AKS chose Standard_D8ds_v4 with 2 nodes, ephemeral OS disk, Ubuntu 22.04.

## Cleanup
- Resource group `mspool-test-rg` deleted with `--no-wait`.
