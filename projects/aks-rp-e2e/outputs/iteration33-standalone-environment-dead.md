# Iteration 33: Standalone Environment No Longer Exists

**Date**: 2026-05-14T12:23Z
**Build**: `hayuaebld163822451` (also checked `hayuaebld145579920`)

## Finding

Both standalone RP environments referenced in the project context are dead:

1. **`hayuaebld145579920`** (in azureconfig) — DNS doesn't resolve, blob container `standalone-jfxrmidhgvlofihl` returns 404 ContainerNotFound
2. **`hayuaebld163822451`** (in project context) — No resource group exists, no kubeconfigs, no blob container

## Evidence

```
# Container not found
$ az storage blob download --account-name akse2eunderlay --container-name standalone-jfxrmidhgvlofihl --name meta
ERROR: ContainerNotFound

# Resource group not found  
$ az group show -n hayuaebld163822451 --subscription feb5b150-...
ERROR: ResourceGroupNotFound

# Old kubeconfig DNS dead
$ kubectl --kubeconfig hcphayuaebld145579920-eastus2-svc-0-kubeconfig get ns
dial tcp: lookup standalone-251204xs73t9-svc-0-eastus2-t6mlo6uc.hcp.eastus2.azmk8s.io: no such host

# RP not running locally either
$ curl -sk --connect-timeout 5 https://localhost:8443/healthz
# exit code 7 (connection refused)
```

## Root Cause

Standalone environments are **ephemeral** — provisioned by CI pipelines and recycled automatically. The environments used in iterations 1-30 have been cleaned up since then.

## What's Needed to Resume

1. **Deploy a new standalone environment** — Run the CI pipeline that provisions a standalone RP (creates underlay clusters, deploys RP pods, publishes blob metadata)
2. **Or hijack an active environment** — Recent containers exist (e.g., `standalone-xxlhzznwdejahkol` from 12:11 UTC today) but these belong to other CI runs and have no RP deployed yet (only infra pods)
3. **Update `azureconfig.yaml`** with the new `build_version` and `underlay_container_name`

## Previous Context Corrections

- "Standalone RP endpoint: localhost:8443 on devbox" was **incorrect**. The standalone RP runs as pods inside underlay clusters in Azure, not as a local process. The `sd connect` command sets up kubectl port-forwarding/proxy.
- "Build `hayuaebld163822451`" — no evidence this build was ever deployed as a standalone environment. The azureconfig on devbox has always referenced `hayuaebld145579920`.

## Impact on Pass Claims

The pass evidence for `Scenario_Traffic_AppRouting_Nginx_Disablement` and `Scenario_ManagedSystemPool_Enable` was collected during earlier iterations when the standalone environment was live. Those results remain valid historical evidence but **cannot be reproduced** until a new standalone environment is deployed.
