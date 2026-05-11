# E2Ev3 Test Run Attempt — 2025-01-11

## What We Tried

```bash
ssh devbox
cd /home/hayua/rp
test/e2ev3/hack/e2ev3 dev --build-version hayuaebld148383762 --debug --scenario Scenario_Preflight
```

## Result: Blocked — Standalone Not Running

The pre-built binary launched successfully and resolved the build config from blob storage.
The scenario `Scenario_Preflight` was matched and a workflow DAG was constructed.

**Failure point:** `RegisterSubscriptionAndDefaultFeatures` step failed:

```
fail to register subscription features:
  fail to get rp-ingress client cert:
    fail to get secret https://hcprkit2el3v.vault.azure.net/secrets/e2e-arm-client-cert:
      dial tcp: lookup hcprkit2el3v.vault.azure.net on 127.0.0.53:53: no such host
```

**Root cause:** The standalone environment's Key Vault (`hcprkit2el3v.vault.azure.net`) is not reachable — the standalone infrastructure has been torn down or is not deployed.

## What Worked

- ✅ Pre-built binary found at `~/.aksbuilder/bazeloutput-v8/.../dev`
- ✅ Binary launched, loaded config from blob
- ✅ AzureCLICredential authenticated successfully
- ✅ Build version `hayuaebld148383762` resolved (build_id=149801791, pipeline_id=68881)
- ✅ Scenario matched and DAG constructed

## Prerequisites to Run Successfully

1. **Deploy a standalone environment** — `hack/aksbuilder_localdeploy.sh` or equivalent
2. **Get new build version** — deploy outputs `E2E build version is hayuaebld<BUILD_ID>`
3. **Azure VPN must be active** on devbox
4. **Run:** `test/e2ev3/hack/e2ev3 dev --build-version <NEW_VER> --debug --scenario Scenario_Preflight`

## Next Steps

Human needs to deploy a standalone or confirm one is available, then provide the build version.
