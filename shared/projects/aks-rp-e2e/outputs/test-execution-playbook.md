# E2E Test Execution Playbook

Once the standalone environment is deployed and healthy, follow these steps to run e2e tests.

## Pre-flight Checks

```bash
# 1. Verify Go is available
go version  # expect 1.24.3+

# 2. Verify standalone is up (Key Vault DNS resolves)
nslookup $(grep -r "keyvault" /home/hayua/rp/test/e2ev3/config/ 2>/dev/null | head -1 | grep -oP '[a-z0-9-]+\.vault\.azure\.net')

# 3. Check aksbuilder is built / available
ls /home/hayua/rp/hack/aksbuilder.sh

# 4. Confirm BUILD_VERSION exists
cat /home/hayua/rp/.build-version 2>/dev/null || echo "Need to set BUILD_VERSION from last deploy"
```

## Running a Single Scenario (Dev Suite)

```bash
cd /home/hayua/rp

# Pick a lightweight scenario to validate the pipeline
# Good first choices from scenario-catalog.md:
#   - sig-node/node-ready (basic node health)
#   - sig-auth/aad-auth (auth flow)

# Run with debug output:
test/e2ev3/hack/e2ev3 dev \
  --build-version <VER> \
  --scenario <SIG>/<SCENARIO_NAME> \
  --debug
```

## Running a Full SIG

```bash
test/e2ev3/hack/e2ev3 dev \
  --build-version <VER> \
  --sig <SIG_NAME> \
  --debug
```

## Interpreting Results

- **PASS**: Scenario DAG completed all steps successfully
- **FAIL**: Check the step-level output; the failing Mutator/Step is named in the log
- **TIMEOUT**: Standalone may be unhealthy; check pod status with `kubectl get pods -A`

## Common Failures & Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Key Vault 403 | MSI not registered | Re-run localdev MSI simulator mutator |
| DNS NXDOMAIN on KV | Standalone not deployed | Run `hack/aksbuilder_localdeploy.sh` |
| `bazel build` error | Stale cache | `bazel clean --expunge` then retry |
| Auth token expired | Credential refresh needed | `az login` on devbox |

## After Successful Run

1. Capture logs: redirect with `2>&1 | tee /tmp/e2e-run.log`
2. Note the scenario execution time for baseline
3. Try a second scenario from a different SIG to confirm broad health
