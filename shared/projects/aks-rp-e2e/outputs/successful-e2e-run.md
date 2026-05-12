# First Successful E2E Test Run

**Date**: 2026-05-12
**Build Version**: `hayuaebld163822451`
**Scenario**: `Scenario_Traffic_AppRouting_Nginx_Disablement`
**Suite**: `dev`
**Result**: ✅ **PASSED**
**Session ID**: `202605121821-EftCJ`
**Log**: `/tmp/e2e-run-1778610096.log` on devbox

## What Was Done

### 1. Root Cause of Capacity Blocker
The `AKSCapacityHeavyUsage` error was NOT caused by missing underlays or regional capacity. It was caused by **5 leftover clusters from previous failed test runs** consuming all standalone RP capacity (limit: 3 clusters).

### 2. Cleanup via Standalone RP API
Deleted all 5 clusters by calling the standalone RP's DELETE API directly:

**RP Ingress Endpoint**: `aksrpingress-e2e-hayuaebld163822451.eastus2.cloudapp.azure.com`
**ARM Client Cert**: From KeyVault `hcprnj8jekdi` → secret `e2e-arm-client-cert`
**Host Header**: `rp.e2e.ig.e2e-aks.azure.com` (nginx ingress routing)

```bash
# List clusters via standalone RP
curl -sk --cert /tmp/e2e-cert.pem --key /tmp/e2e-key.pem \
  --resolve "rp.e2e.ig.e2e-aks.azure.com:443:<IP>" \
  "https://rp.e2e.ig.e2e-aks.azure.com/subscriptions/<SUB>/providers/Microsoft.ContainerService/managedClusters?api-version=2024-01-01"

# Delete each cluster
curl -sk -X DELETE --cert /tmp/e2e-cert.pem --key /tmp/e2e-key.pem \
  --resolve "rp.e2e.ig.e2e-aks.azure.com:443:<IP>" \
  "https://rp.e2e.ig.e2e-aks.azure.com/subscriptions/<SUB>/resourceGroups/<RG>/providers/Microsoft.ContainerService/managedClusters/<NAME>?api-version=2024-01-01"
```

Deleted clusters: `e2eaks-mfE`, `e2eaks-LEi`, `e2eaks-vHu`, `e2eaks-JCP`, `e2eaks-ATK`

### 3. Test Execution
```bash
cd ~/rp && export PATH=/usr/local/go/bin:$PATH
test/e2ev3/hack/e2ev3 dev --build-version hayuaebld163822451 \
  -s Scenario_Traffic_AppRouting_Nginx_Disablement --debug
```

### 4. Test Timeline
| Time | Step | Status |
|------|------|--------|
| 18:21 | Build binary (Bazel) | ✅ |
| 18:21 | Config blob load | ✅ |
| 18:22 | SelectScenario | ✅ |
| 18:22 | RegisterSubscription | ✅ |
| 18:22 | Preflight | ✅ |
| 18:22 | CreateManagedCluster PUT | ✅ Accepted |
| 18:22-18:25 | ProvisioningControlPlane | ✅ |
| 18:25-18:26 | CreatingAgentPools | ✅ |
| 18:26-18:27 | ReconcilingDNS/Addons | ✅ |
| 18:27 | Cluster Succeeded | ✅ |
| 18:27-18:30 | UpdateManagedCluster (enable nginx) | ✅ |
| 18:30-18:31 | Verify nginx CRD/pods | ✅ |
| 18:31 | Teardown (DeleteResourceGroup) | ✅ |
| 18:31:44 | **test succeeded!** | ✅ |

### 5. Key Log Lines
```
18:31:44 INFO <test/run_scenario.go:71> test succeeded!
18:31:44 INFO <azresources/delete_resource_group.go:46> success to start deleting resource group without wait it done
```

## How to Reach the Standalone RP API

The standalone RP is deployed as AKS clusters with an nginx ingress. To call it:

1. **Get the RP ingress IP**: `nslookup aksrpingress-e2e-<build_version>.<location>.cloudapp.azure.com`
2. **Get the ARM client cert**: `az keyvault secret show --vault-name hcp<overlay_resource_version> --name e2e-arm-client-cert`
3. **Split PEM** into key + cert files
4. **Use curl with mTLS**: `curl -sk --cert <cert> --key <key> --resolve "rp.e2e.ig.e2e-aks.azure.com:443:<IP>" "https://rp.e2e.ig.e2e-aks.azure.com/..."`

Key variables for build `hayuaebld163822451`:
- Overlay resource version: `rnj8jekdi` (from config blob)
- KeyVault: `hcprnj8jekdi`
- Subscription: `18153b17-4e27-4b58-863e-f8105b8892a2`
- Location: `eastus2`
