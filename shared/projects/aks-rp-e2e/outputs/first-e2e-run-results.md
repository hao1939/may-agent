# First E2E Test Run Results

**Date**: 2026-05-12  
**Build Version**: `hayuaebld163822451`  
**Devbox**: `hayua@20.24.129.235` (`/home/hayua/rp`)  
**Suite**: `dev`  
**Tool**: `ssh_exec` (direct SSH command execution)

## Summary

| Scenario | Result | Root Cause |
|----------|--------|------------|
| `Scenario_If_Match` | ❌ SelectScenario Failed | "multiple scenario Scenario_If_Match found" — registered twice (directly + via `rp.GetTestScenarios()`) |
| `Scenario_RBAC_Disabled` | ❌ SelectScenario Failed | Same duplicate registration issue |
| `Scenario_PAFThrottling` | ⚠️ Ran but Failed | Framework executed full DAG; failed at `GetUnderlayCredential` — managed identity not assigned to devbox |

**Key finding**: The e2ev3 framework builds, connects to config blob, provisions resources, and executes the test DAG. The `Scenario_PAFThrottling` failure is an **infrastructure credential issue**, not a framework bug.

## Attempt 1: Scenario_If_Match

```
Command: test/e2ev3/hack/e2ev3 dev -s Scenario_If_Match --debug --build-version hayuaebld163822451

Result:
  flag.Parse: [Succeeded]
  akse2e.NewTestContext: [Succeeded]
  SelectScenario: [Failed]
      multiple scenario Scenario_If_Match found
  RunScenario(): [Skipped]
```

**Analysis**: `Scenario_If_Match` is added to the dev suite both as `rp.Scenario_If_Match` (line ~76 of `cmd/dev/main.go`) AND via `rp.GetTestScenarios()` (line ~168). The `SelectScenario` step uses `strings.EqualFold` exact match, so both register with the same name → "multiple scenario found".

## Attempt 2: Scenario_RBAC_Disabled

Same duplicate registration issue — same root cause as above.

## Attempt 3: Scenario_PAFThrottling ✅ (framework ran)

This scenario is only added once (directly, not also via `GetTestScenarios`), so it passes `SelectScenario`.

```
Command: export PATH=/usr/local/go/bin:$PATH && cd /home/hayua/rp && \
  test/e2ev3/hack/e2ev3 dev -s Scenario_PAFThrottling --debug --build-version hayuaebld163822451
```

### Build Phase (succeeded)
```
aksbuilder tidy + bazel build //test/e2ev3/cmd/dev:dev
Build completed successfully, 1 total action
built binary to '/tmp/tmp.ly4gW4QDfu/dev'
```

### Config Loading (succeeded)
```
09:22:15 INFO <config/blob.go:33> use config from blob https://akse2eci.blob.core.windows.net/config/hayuaebld163822451
09:22:15 DEBU <config/blob.go:40> Azure.Identity: using AzureCLICredential
09:22:16 INFO <config/blob.go:57> success to read config from blob
```

### Test Execution (partial — identity failure)

The framework progressed through:
- `flag.Parse`: ✅ Succeeded
- `akse2e.NewTestContext`: ✅ Succeeded  
- `SelectScenario`: ✅ Succeeded (unique match)
- `RegisterSubscriptionAndDefaultFeatures`: ✅ Succeeded
- `Provision`: ✅ Succeeded
- `StartTestPlan`: ✅ Succeeded
- `GetUnderlayCredential`: ❌ **Failed**

```
*hcp.GetUnderlayCredential[...e2eaks-GxB]: [Failed]
    ManagedIdentityCredential authentication failed.
    the requested identity isn't assigned to this resource
    GET http://169.254.169.254/metadata/identity/oauth2/token
    RESPONSE 400: {"error":"invalid_request","error_description":"Identity not found"}
```

### Teardown
```
09:34:59 INFO success to start deleting resource group without wait it done
  Resource group: e2erg-bld163822451-sNeYGoYJfuj
  Subscription: 18153b17-4e27-4b58-863e-f8105b8892a2
```

### Workflow Step Summary
```
Print Workflow: [Succeeded]
StartTeardown: [Succeeded]
Teardown: [Succeeded]
RegisterSubscriptionAndDefaultFeatures: [Succeeded]
Provision: [Succeeded]
StartTestPlan: [Succeeded]
*hcp.GetUnderlayCredential: [Failed]
*handlers.DedicatedOom: [Skipped]
*k8s.Create[ConfigMap]: [Skipped]
Verify PAF Objects: [Skipped]
RestartDeployment: [Skipped]
CollectManagedClusterAgentNodesLogs: [Succeeded]
DeleteResourceGroup: [Succeeded]
```

## Duplicate Scenario Problem

Most scenarios in `cmd/dev/main.go` are registered **twice**:
1. Directly (e.g., `rp.Scenario_If_Match` on line ~76)
2. Via `rp.GetTestScenarios()` on line ~168

This means `-s <name>` fails with "multiple scenario found" for most scenarios.

**Workaround options**:
1. Use scenarios only added once (like `Scenario_PAFThrottling`)
2. Edit `cmd/dev/main.go` to remove the direct registrations (they're redundant with the `GetTestScenarios()` calls)
3. The production `mv` suite likely doesn't have this problem

## Environment Notes

- **Go**: `/usr/local/go/bin/go` — must set `PATH` explicitly for non-interactive SSH (`export PATH=/usr/local/go/bin:$PATH`)
- **Bazel**: Bundled via aksbuilder at `~/.aksbuilder/bin/bazelisk-linux-amd64-v1.19.0`; cached builds complete in <1s
- **kubectl**: Stale kubeconfig (NXDOMAIN for old cluster DNS) — does not affect e2ev3 which uses its own config blob
- **Azure CLI**: Working (AzureCLICredential succeeded for config blob)
- **Managed Identity**: NOT assigned to devbox — blocks `GetUnderlayCredential` step

## Next Steps

1. **Fix managed identity**: Assign the required managed identity to the devbox VM so `GetUnderlayCredential` succeeds
2. **Fix duplicate scenarios**: Either clean up `cmd/dev/main.go` or use the `mv` suite which may not have duplicates
3. **Re-run with identity fix**: `Scenario_PAFThrottling` should pass once the identity is assigned
4. **Try simpler scenarios**: Look for scenarios that don't need underlay credentials (e.g., pure API/RP tests)
