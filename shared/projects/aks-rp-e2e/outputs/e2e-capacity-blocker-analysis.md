# E2E Capacity Blocker Analysis — Iteration 7

## Summary

All e2ev3 scenarios that create managed clusters are blocked by a **missing underlay** in the standalone RP environment. The error `AKSCapacityHeavyUsage` occurs in the **async operation** (underlay selection), not the sync PUT admission.

## Root Cause Chain

1. **Sync PUT acceptance**: The PUT call to `rp.e2e.ig.e2e-aks.azure.com` passes preflight and is accepted (returns 202).
2. **Async underlay selection fails**: The async operations processor calls `underlay_selection_goal_resolver.go` → `selectUnderlay()` → finds 0 candidate underlays → returns `AKSCapacityHeavyUsage`.
3. **The error is NOT per-region capacity**: Tested eastus2, westus2, westus3, centralus, southcentralus — all return the same error because there are no underlays registered in any region.

## Key Code Paths

| Component | File | Role |
|-----------|------|------|
| Sync capacity check | `putmanagedcluster_blockclustercreation.go:222` | `blockClusterCreationBasedConstrainedRegionPlan` — bypassable via `custom-region-capacity-status: GreenPhase` header |
| Free-tier block | `putmanagedcluster_blockclustercreation.go:270` | `blockFreeTierClusterCreation` — bypassable via paid SKU tier |
| **Async underlay selection** | `goalresolvers/underlay_selection_goal_resolver.go:348` | **NOT bypassable** — requires actual underlays registered |
| Underlay capacity helper | `common/capacity/capacityhelper.go:52` | `ValidateRegionalCapacityOnClusterCreation` — only for sync path |

## Attempted Workarounds

| Attempt | Result |
|---------|--------|
| `--test-region westus2/westus3/centralus/southcentralus` | Same error — no underlays in any region |
| Added `custom-region-capacity-status: GreenPhase` header via mutator | Header sent successfully (confirmed in logs), sync PUT accepted, but async still fails |
| Set SKU to Standard tier | Bypasses free-tier sync check, but async still fails on underlay selection |

## Evidence

```
# westus2 run output (2026-05-12T11:57)
X-Ms-Failurecause: client:AKSCapacityHeavyUsage
{
 "name": "d1c2cffc-6c65-4440-a3b8-6506b1e5ca82",
 "status": "Failed",
 "startTime": "2026-05-12T11:57:37.5926657Z",
 "endTime": "2026-05-12T11:58:28.7330544Z",
 "error": {
  "code": "AKSCapacityHeavyUsage",
  "message": "Creating a new cluster is unavailable at this time in region westus2..."
 }
}
```

This is an **async operation failure** (has startTime/endTime and operation ID), not a sync rejection.

## What's Needed to Unblock

The standalone RP needs at least one **e2e underlay cluster** registered. This requires:

1. **An AKS cluster to serve as underlay** — provisioned in the same subscription, registered with the standalone RP's HCP component.
2. **Underlay registration** — done via the `devinfraservices/e2e/e2e-underlay/` client library, which registers the underlay cluster in the RP's HCP store (cosmos DB or equivalent).
3. **Owner**: The devbox/standalone environment owner (hayua) needs to provision and register the underlay. This is typically done by the `e2e-ev2-localdeploy` infrastructure tool.

## Alternative Path: Scenarios Without Cluster Creation

No dev-suite scenarios exist that skip `CreateManagedCluster`. All scenarios in `test/e2ev3/cmd/dev/main.go` use `plans.SingleCluster` or equivalent which provisions a real cluster.

## Conclusion

Getting a green e2e pass requires the standalone RP environment to have at least one underlay registered. This is a **DevOps/infrastructure prerequisite**, not a code fix. The e2ev3 framework, build system, config blob loading, subscription registration, preflight, and all sync validation work correctly.
