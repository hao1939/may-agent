# Iteration 48 — New Build `hayuaebld164286963` Blocker

## What happened
1. Updated `azureconfig.yaml` `build_version` from `hayuaebld145579920` → `hayuaebld164286963`
2. Ran `aksdev sd connect` — **FAILED** with:
   ```
   ContainerNotFound: standalone-jfxrmidhgvlofihl does not exist
   ```
3. The old underlay container was recycled. The new build likely has a new container name.

## Root Cause
The `azureconfig.yaml` still references stale values:
- `underlay_container_name: 'standalone-jfxrmidhgvlofihl'` — container deleted
- `overlay_resource_version: 'r3d0k0el3'` — likely stale too

These values are provisioned per-build by the pipeline and cannot be derived from the build version string alone.

## What's Needed
Human must provide the **underlay_container_name** and **overlay_resource_version** for build `hayuaebld164286963`. These come from the pipeline's `Provision_E2E_Resources` step outputs:
- `AKS_E2E_UNDERLAY_CONTAINER`
- `AKS_E2E_OVERLAY_RESOURCE_VERSION`

Alternatively, run `aksdev e2e generate-azureconfig` with the correct parameters if there's a discovery mechanism.

## Environment State
- devbox RP not listening on localhost:8443 (HTTP_CODE:000) — expected since standalone RP runs inside the underlay cluster, not locally
- `aksdev sd connect` is the correct way to establish connectivity, but it needs valid container metadata
