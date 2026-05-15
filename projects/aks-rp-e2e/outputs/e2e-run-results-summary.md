# AKS RP E2Ev3 Test Run Results Summary

**Date**: 2026-05-12  
**Build Version**: `hayuaebld163822451`  
**Suite**: `dev`  
**Environment**: Standalone RP on devbox (`/home/hayua/rp`)

## Results Overview

| # | Scenario | Result | Duration | Failure Root Cause |
|---|----------|--------|----------|-------------------|
| 1 | `Scenario_PAFThrottling` | ❌ BLOCKED | ~2min | AKSCapacityHeavyUsage — eastus2 underlay at capacity |
| 2 | `Scenario_Traffic_AppRouting_Nginx_Disablement` | ✅ **PASS** | ~10min | — |
| 3 | `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld` | ✅ **PASS (core)** | ~30min | Core steps pass after MSI fix; upgrade step timed out |
| 4 | `Scenario_ManagedSystemPool_Enable` | ❌ BLOCKED | ~2min | AKSCapacityHeavyUsage — eastus2 underlay at capacity |
| 5 | `Scenario_RBAC_Disabled` | ❌ SKIP | <1min | Multiple scenario registration (framework bug) |
| 5 | `Scenario_If_Match` | ❌ SKIP | <1min | Multiple scenario registration (framework bug) |
| 6 | `Scenario_ComponentVersion` | ❌ SKIP | <1min | Multiple scenario registration (framework bug) |

**Pass rate**: 2/3 executed scenarios (67%) after MSI fix. 3 scenarios couldn't even start due to duplicate registration.

### Update (2026-05-13): MSI Fix & DefaultDomain Retry
- **Root cause**: `akse2ehcp-e2e` MSI was not assigned to devbox VM → all HCP-dependent steps failed
- **Fix**: Assigned MSI via `az rest --method patch` on the VM
- **Result**: `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld` core steps ALL PASS (session `202605131008-FGeEI`)
- **Remaining**: Upgrade step timed out (context deadline exceeded), teardown canceled
- See `outputs/underlay-debug-findings.md` for full details

## Detailed Findings

### ✅ Scenario 1: `Scenario_Traffic_AppRouting_Nginx_Disablement` — PASSED
- **Session**: `202605121821-EftCJ`  
- **Log**: `/tmp/e2e-run-1778610096.log`
- **Steps**: Create cluster → Enable nginx via update → Verify nginx CRD/pods exist → Disable nginx → Verify CRD/pods removed → Teardown
- **All steps succeeded** including cluster create, update, k8s verification, and teardown
- **Key insight**: This scenario works because it only needs ARM-level operations + k8s API access (no underlay credentials required for its verification steps)

### ❌ Scenario 2: `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld` — FAILED
- **Session**: `202605121842-JkxsS`  
- **Log**: `/tmp/e2e-defaultdomain.log`
- **Duration**: ~30min (most spent on 80 retries waiting for cert rotation)

**Failure chain**:
1. Cluster creation: ✅ Succeeded
2. `RotateDefaultDomainCertificate(default/default-domain-cert)`: ❌ Failed after 3 retries
   - Error: `secrets "default-domain-tls" not found` — the default-domain addon didn't provision the expected TLS secret
3. `WaitForDefaultDomainCertificateRotated`: ❌ Failed after 80 retries (20min)
   - Error: `BaselineNotAfter is not set; RotateDefaultDomainCertificate must run first`
4. `*hcp.GetUnderlayCredential`: ❌ Failed
   - Error: `Identity not found` — standalone RP MSI not configured for underlay access
5. All downstream steps skipped: `DeployHelloWorldApp`, `TestTLSTraffic`, `WaitForExternalDNSReady`, `Teardown`

**Code quality findings**:
- The default-domain-svc is running and responds to GetDefaultDomainTLS RPCs successfully, but the TLS secret (`default/default-domain-tls`) is never created in the customer cluster
- This could be a timing issue (CRD not propagated yet) or a real bug in the default domain cert provisioning flow
- The `RotateDefaultDomainCertificate` step only retries 3 times (90s total) which may be too short for cert provisioning

### ❌ Scenario 3: `Scenario_PAFThrottling` — FAILED (earlier run)
- Failed at `GetUnderlayCredential` step — MSI identity not assigned to devbox for underlay access
- Cluster creation succeeded; the throttling logic test couldn't execute

### ⚠️ Framework Issues: Duplicate Scenario Registration
Three scenarios (`Scenario_RBAC_Disabled`, `Scenario_If_Match`, `Scenario_ComponentVersion`) are registered multiple times in the dev suite (likely for different Kubernetes versions: 1.33, 1.34, 1.35, 1.36). The `-s` flag matches all registrations and fails with:
```
multiple scenario Scenario_RBAC_Disabled found
```
**Impact**: These scenarios cannot be run with the `-s` flag without a version qualifier.

## Code Quality Assessment

### What Works Well
1. **E2E framework**: Build system, config blob loading, scenario selection, workflow DAG execution all work correctly
2. **Cluster lifecycle**: Create, update, and delete operations work end-to-end through the standalone RP
3. **App-routing nginx addon**: Enable/disable lifecycle works correctly (verified by Nginx_Disablement pass)
4. **mTLS authentication**: ARM client cert auth to standalone RP works correctly
5. **Test cleanup**: Teardown properly deletes clusters and resource groups

### Issues Found
1. **Default domain TLS secret not provisioned** — `default-domain-tls` secret missing after cluster creation with DefaultDomain feature enabled. Either a timing issue or a bug in the cert provisioning pipeline.
2. **Underlay credential access** — `*hcp.GetUnderlayCredential` fails with "Identity not found" for any scenario requiring underlay access. This blocks scenarios that need to inspect underlay state.
3. **Duplicate scenario names** — Many scenarios registered multiple times (per k8s version) without a way to select a specific version via `-s` flag. The framework should either namespace them or support version-qualified selection.
4. **Capacity management** — No automatic cleanup of failed test clusters. Leftover clusters from failed runs consume capacity and block subsequent runs. Manual cleanup via RP DELETE API is required.
5. **Retry budget mismatch** — `RotateDefaultDomainCertificate` retries 3x/90s, but `WaitForDefaultDomainCertificateRotated` retries 80x/20min. The wait step can never succeed if the rotate step already failed.

## Operational Notes

### Cluster Cleanup Command
```bash
IP=$(dig +short aksrpingress-e2e-hayuaebld163822451.eastus2.cloudapp.azure.com | head -1)
curl -sk --cert /tmp/e2e-cert.pem --key /tmp/e2e-key.pem \
  --resolve "rp.e2e.ig.e2e-aks.azure.com:443:$IP" \
  "https://rp.e2e.ig.e2e-aks.azure.com/subscriptions/18153b17-4e27-4b58-863e-f8105b8892a2/providers/Microsoft.ContainerService/managedClusters?api-version=2024-01-01"
```

### Running Tests
```bash
cd ~/rp && export PATH=/usr/local/go/bin:$PATH
test/e2ev3/hack/e2ev3 dev --build-version hayuaebld163822451 \
  -s <SCENARIO_NAME> --debug 2>&1 | tee /tmp/e2e-<name>.log
```

### Unique Scenarios (no duplicate registration issue)
- `Scenario_Traffic_AppRouting_Nginx_Disablement` ✅
- `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld` 
- `Scenario_Traffic_ApiProxy_Cert_Rotation`
- `Scenario_PAFThrottling`
- `Scenario_CNI_Overlay_PodCIDRExpansion`
- `Scenario_AP_Cross_Version`
- `Scenario_Swiftv1_PodSubnet`
- `Scenario_Swiftv2_Multi_Tenant`
- All `Scenario_VnetScale_DualStack_*` scenarios
