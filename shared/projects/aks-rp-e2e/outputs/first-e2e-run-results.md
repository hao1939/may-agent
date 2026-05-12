# First E2E Test Run Results

**Date:** 2026-05-12  
**Build Version:** `hayuaebld163822451`  
**Scenario:** `Scenario_PAFThrottling`  
**Suite:** `dev` (standalone)  
**Result:** ❌ FAILED — ManagedIdentityCredential not assigned to resource

## Summary

Successfully executed the e2ev3 test framework against standalone build `hayuaebld163822451`. The test binary built, loaded config from Azure blob storage, selected the scenario, provisioned the cluster, but failed during the `GetUnderlayCredential` step due to a managed identity configuration issue.

## What Worked

| Phase | Status | Details |
|-------|--------|---------|
| Bazel build | ✅ Succeeded | Cached, 0.265s, binary at `bazel-bin/test/e2ev3/cmd/dev/dev_/dev` |
| go mod tidy | ✅ Succeeded | All modules tidied |
| gazelle | ✅ Succeeded | BUILD files regenerated |
| Config blob | ✅ Succeeded | Loaded from `https://akse2eci.blob.core.windows.net/config/hayuaebld163822451` |
| Azure CLI auth | ✅ Succeeded | Using AzureCLICredential |
| Scenario selection | ✅ Succeeded | `Scenario_PAFThrottling` found and selected |
| RegisterSubscription | ✅ Succeeded | Subscription and default features registered |
| Provision | ✅ Succeeded | Cluster provisioned |
| StartTestPlan | ✅ Succeeded | DAG execution started |
| Teardown | ✅ Succeeded | Resource group `e2erg-bld163822451-yiqfGAfKGKn` deletion initiated |

## Failure Point

```
*hcp.GetUnderlayCredential[/subscriptions/18153b17-4e27-4b58-863e-f8105b8892a2/resourceGroups/e2erg-bld163822451-yiqfGAfKGKn/providers/Microsoft.ContainerService/managedClusters/e2eaks-Aru]: [Failed]
    ManagedIdentityCredential authentication failed. the requested identity isn't assigned to this resource
    GET http://169.254.169.254/metadata/identity/oauth2/token
    RESPONSE 400: 400 Bad Request
    {"error": "invalid_request", "error_description": "Identity not found"}
```

**Root cause:** The test tried to get underlay credentials for the managed cluster using a Managed Identity that isn't assigned to the devbox VM. This is expected for standalone environments where the devbox doesn't have the same MSI assignments as production CI VMs.

## Steps Skipped Due to Failure

All steps downstream of `GetUnderlayCredential` were skipped:
- `k8s.ToggleDefaultValueUpdater[apiserver-paf-throttling-count-threshold]`
- `resourcescaler.SingleGiantVirtualNodeHandler`
- `Verify PAF Objects`
- `resourcescaler.DedicatedModeHandler`
- `k8s.ToggleDefaultValueUpdater[ccp-autoscaler-reconciler-period-in-minutes]`
- `handlers.DedicatedOom`

## Scenario Naming Discovery

Scenarios in the dev suite are registered from two sources:
1. **Direct registration** in `BuildTestSuiteCases()` (lines 73-109 of `main.go`)
2. **Suite imports** via `GetTestScenarios()` / `ListScenarios()` (lines 112-200)

Many scenarios appear in BOTH sources, causing `SelectScenario` to fail with "multiple scenario found". Only scenarios registered in exactly one source work with `-s`. `Scenario_PAFThrottling` (line 189) is unique because it's added directly without also being in a suite's `GetTestScenarios()`.

## Build Pipeline Details

```
Build version file: {"Version":"hayua-local-1778576938","GitBranch":"hayue/e2e","GitHash":"githash-40b24b73f55d","BuildTime":"2026-05-12T09:08:58Z"}
163 images registered
K8s versions: 1.33.0, 1.34.0, 1.35.0, 1.36.0
Session ID: 202605120919-uIFZU
Pipeline ID: 68881
```

## Command Used

```bash
export PATH=/usr/local/go/bin:$PATH
cd /home/hayua/rp
test/e2ev3/hack/e2ev3 dev --build-version hayuaebld163822451 -s Scenario_PAFThrottling --debug
```

## Next Steps

1. **Fix MSI assignment** — The devbox VM needs the managed identity assigned that `GetUnderlayCredential` expects. This is a standalone environment configuration issue.
2. **Try a simpler scenario** — Look for scenarios that don't require underlay credentials (e.g., RP-only scenarios like `Scenario_ComponentVersion`). However, most are duplicated in the dev suite.
3. **Deduplicate scenario registration** — The dev suite's `BuildTestSuiteCases()` should either not directly list scenarios that also come from suite imports, or use a deduplication step.
4. **Use `--plan` flag** — Check if the framework supports `--plan` to select by plan name instead of scenario name, which might avoid the duplication issue.
