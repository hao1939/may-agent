# Iteration 50 — Standalone Environment Not Provisioned

**Date:** 2026-05-16  
**Status:** BLOCKED — underlay container missing for new build

## Evidence

Build `hayuaebld164286963` is set in `azureconfig.yaml` but the underlay container `standalone-jfxrmidhgvlofihl` (from the previous build) no longer exists in Azure Storage.

```
aksdev sd connect -v → ContainerNotFound
  The specified container does not exist.
  RequestId:087cbdb4-201e-006c-0b5b-e56bb1000000
```

Provisioning a new environment requires parameters we don't have:
```
aksdev provision generate-manifest aks-overlay requires:
  --cluster-mode, --e2e-overlay-resource-region, --e2e-overlay-resource-version,
  --release-tag, --rp-serving-region
```

## What's Needed from Human

One of:
1. **Provision the new build** (`aksdev provision ...`) and share the updated `underlay_container_name` + `overlay_resource_version`
2. **Share the correct values** for the new build so we can update `azureconfig.yaml`
3. **Run `aksdev sd connect`** after provisioning so we can proceed to e2e tests

## Previous Passes (unchanged)
- Scenario_Traffic_AppRouting_Nginx_Disablement ✅
- Scenario_ManagedSystemPool_Enable ✅
- DefaultDomain confirmed ✅
