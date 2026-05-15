# e2ev3 Troubleshooting Guide

## Common Failures & Fixes

### 1. Key Vault DNS Resolution Failure

```
dial tcp: lookup <name>.vault.azure.net: no such host
```

**Cause:** Standalone environment not deployed or torn down.  
**Fix:** Redeploy with `hack/aksbuilder_localdeploy.sh`. Ensure Azure VPN is active on devbox.

### 2. Binary Not Found

```
binary not found at ~/.aksbuilder/bazeloutput-v8/...
```

**Fix:** Build first:
```bash
hack/aksbuilder.sh --suite dev
```

### 3. Build Version Invalid

```
failed to resolve build version
```

**Fix:** Get a fresh build version from the deploy output (`E2E build version is hayuaebld<ID>`), or from the ADO pipeline.

### 4. Scenario Not Found

```
no scenario matched
```

**Fix:** Scenario names are Go variables. Search the source:
```bash
grep -rh "NewScenario(" test/e2ev3/sigs/ --include="*.go" | grep -i "<keyword>"
```

### 5. Subscription Not Registered

```
fail to register subscription features
```

**Cause:** The `RegisterSubscriptionAndDefaultFeatures` step needs a running RP with valid certs from Key Vault.  
**Fix:** Same as #1 — ensure standalone is deployed and accessible.

### 6. Timeout During Test

```
context deadline exceeded
```

**Fix:** Increase timeout:
```bash
test/e2ev3/hack/e2ev3 dev --build-version <VER> -s <SCENARIO> --timeout 2h
```

### 7. AzureCLICredential Failure

```
failed to acquire token via Azure CLI
```

**Fix:**
```bash
az login
az account set -s <subscription-id>
```

### 8. Bazel Build Errors

```
ERROR: Build did NOT complete successfully
```

**Fix:**
```bash
# Clean Bazel cache
bazel clean --expunge
# Retry
hack/aksbuilder.sh --suite dev
```

## Debug Techniques

| Technique | Command/Approach |
|-----------|-----------------|
| Verbose logging | Add `--debug` flag |
| Run single scenario | `-s Scenario_Name` |
| Inspect DAG | Look for `flow.BatchPipe` calls in the plan's `Build()` method |
| Check env health | `kubectl get pods -n aks-rp` on standalone cluster |
| View test source | `test/e2ev3/sigs/<sig>/` directories |

## Environment Checklist

Before running e2e tests, verify:

- [ ] Azure VPN connected
- [ ] `az login` session active
- [ ] Standalone deployed (`hack/aksbuilder_localdeploy.sh`)
- [ ] Build version obtained from deploy output
- [ ] Key Vault DNS resolves: `nslookup <kv-name>.vault.azure.net`
- [ ] Binary built or pre-built available
