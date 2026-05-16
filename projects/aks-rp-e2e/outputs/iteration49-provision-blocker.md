# Iteration 49: New Build Requires Provisioning

## Summary
Build `hayuaebld164286963` is set in `azureconfig.yaml` but has **not been provisioned**:
- Resource group `hayuaebld164286963` does not exist
- Blob container `standalone-jfxrmidhgvlofihl` does not exist in `akse2eunderlay` storage account
- `aksdev sd connect` fails with `ContainerNotFound`

## Root Cause
The `underlay_container_name` in azureconfig.yaml (`standalone-jfxrmidhgvlofihl`) belongs to the **old** recycled build. The new build version was set but the environment was never provisioned.

## What's Needed
Either:
1. **Human provisions the new standalone environment** using:
   ```bash
   ./bin/aksdev provision generate-manifest aks-overlay \
     --e2e-build-version hayuaebld164286963 \
     --e2e-overlay-resource-version r3d0k0el3 \
     --e2e-overlay-resource-subscription feb5b150-60fe-4441-be73-8c02a524f55a \
     --e2e-test-underlay-subscription 18153b17-4e27-4b58-863e-f8105b8892a2 \
     --rp-serving-region eastus2 \
     --cluster-mode <standalone?> \
     --e2e-overlay-resource-region <eastus2?> \
     --release-tag <tag>
   ```
   Then: `./bin/aksdev provision overlay --manifest <generated> --rp-root /home/hayua/rp`

2. **Human provides the correct `underlay_container_name`** for the already-provisioned build (if it exists elsewhere).

3. **Human runs `aksdev sd connect`** after provisioning and confirms it works, then we retry `Scenario_PAFThrottling`.

## Evidence
```
$ ./bin/aksdev sd connect -v
level=error msg="get underlay suite failed" error="failed to get underlay metadata: GET https://akse2eunderlay.blob.core.windows.net/standalone-jfxrmidhgvlofihl/meta ... ContainerNotFound"
```

## Date
2026-05-16
