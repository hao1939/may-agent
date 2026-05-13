# Iteration 24 — Scenario_ManagedSystemPool_Enable PASSED on standalone

**Date**: 2026-05-13
**Build**: `hayuaebld163822451`
**Scenario**: `Scenario_ManagedSystemPool_Enable`
**Suite**: `dev`
**Result**: ✅ **PASSED** (`test succeeded!` at 12:25:29)
**Session ID**: `202605131200-zcNfQ`
**Log**: `devbox:/tmp/e2e-msp-1778673607.log`

## Root cause of "AKSCapacityHeavyUsage" was NOT regional capacity

The blocker reported in iteration 23 was **the standalone RP's own datastore filling up**, not
Azure-side cluster count. `az aks list` showed ~70 clusters across the subscription, but those
are unrelated — the standalone RP only sees clusters in its own `aks-rp-config.json` scope, and
those leaked across previous test runs.

`forever_flags.go:125-128` (`constrain-cluster-creation-in-region` → `true` for `E2ETest()`)
makes the RP enforce regional capacity, but **the trigger was the per-underlay usage** in the
standalone RP's single eastus2 underlay. With 4 leftover clusters consuming the underlay budget,
new creations got `AKSCapacityHeavyUsage`. After deletion, creation proceeded normally.

We did **not** need to disable the toggle.

## What was leaking

```
e2eaks-rNB  Failed     Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld
e2eaks-koC  Succeeded  Scenario_ManagedSystemPool_Enable
e2eaks-BEL  Succeeded  Scenario_ManagedSystemPool_Enable
e2eaks-OUE  Succeeded  Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld
```

The `Succeeded` clusters are from previous canceled test runs where teardown
(`DeleteResourceGroup`) was kicked off but the e2ev3 binary was interrupted before the delete
finished propagating. Standalone RP's teardown is fire-and-forget (`success to start deleting
resource group without wait it done`), so a Ctrl-C during teardown leaves the cluster behind in
the standalone store even though the ARM RG delete is in-flight.

## Cleanup procedure (canonical recipe)

```bash
# 1. Pull mTLS cert from KV (overlay version is in aks-rp-config blob)
ssh devbox 'az keyvault secret show --vault-name hcprnj8jekdi --name e2e-arm-client-cert \
  --query value -o tsv > /tmp/e2e-pem.pem
awk "/BEGIN PRIVATE KEY/,/END PRIVATE KEY/" /tmp/e2e-pem.pem > /tmp/e2e-key.pem
awk "/BEGIN CERTIFICATE/,/END CERTIFICATE/" /tmp/e2e-pem.pem > /tmp/e2e-cert.pem'

# 2. Resolve ingress IP
IP=$(dig +short aksrpingress-e2e-hayuaebld163822451.eastus2.cloudapp.azure.com | head -1)
SUB=18153b17-4e27-4b58-863e-f8105b8892a2

# 3. List clusters
curl -sk --cert /tmp/e2e-cert.pem --key /tmp/e2e-key.pem \
  --resolve "rp.e2e.ig.e2e-aks.azure.com:443:$IP" \
  "https://rp.e2e.ig.e2e-aks.azure.com/subscriptions/$SUB/providers/Microsoft.ContainerService/managedClusters?api-version=2024-01-01"

# 4. DELETE each one (returns 202 Accepted)
curl -sk -X DELETE --cert /tmp/e2e-cert.pem --key /tmp/e2e-key.pem \
  --resolve "rp.e2e.ig.e2e-aks.azure.com:443:$IP" \
  "https://rp.e2e.ig.e2e-aks.azure.com/<full-resource-id>?api-version=2024-01-01"

# 5. Wait ~5 min; recheck list count goes to 0.
```

## Test timeline

| Time | Step |
|------|------|
| 12:00:51 | CreateManagedCluster PUT accepted (`ProvisioningControlPlane`) |
| 12:11:58 | `ReconcilingAddons` |
| 12:15:41 | CreateAgentPool (`managedsys` pool) started |
| 12:22:16 | `CreatingAgentPool: 2/0 nodes completed` |
| ~12:25 | `validateTwoAgentPools`, `validateManagedSystemNodeTaints`, `validateCriticalAddonsOnManagedSystemNodes`, `validateCriticalAddonsDeploymentAffinity` all pass |
| 12:25:29 | `test succeeded!` and teardown DeleteResourceGroup 202 Accepted |

Total: ~25 minutes wall clock.

## Capability model update needed

- `managedsystem-pool-standalone-e2ev3` → **pass** (was `unknown`).
- Add weakness: "Standalone RP cluster leaks on Ctrl-C during teardown" (teardown is async; the
  client never confirms ARM RG delete, so a canceled run leaves a `Succeeded` cluster in the
  RP datastore that counts against per-underlay capacity).

## Recommended next iterations

1. Update capability model (`outputs/e2e-capability-model.json`): set
   `managedsystem-pool-standalone-e2ev3` to `pass`, evidence = this file.
2. Add a pre-flight check to `outputs/run-e2e.sh` (or wrapper): list standalone RP clusters
   and delete any whose `test_session_id` is not the current run.
3. Retry `Scenario_PAFThrottling` now that capacity is free — that's the remaining `fail`
   from earlier iterations with the MSI fix in place.
