# Iteration 53: ManagedSystem Pool Test Inventory & Environment Blocker

## ManagedSystem Pool E2Ev3 Scenarios Found

All in `/home/hayua/rp/test/e2ev3/sigs/rp/nativerp/plans/`:

| # | Scenario | File | Description |
|---|----------|------|-------------|
| 1 | `Scenario_ManagedSystem_AgentPool` | `managedsystem.go` (853 lines) | Creates cluster with ManagedSystem mode agent pool (count 0), validates config and restrictions |
| 2 | `Scenario_ManagedSystemPool_Enable` | `managedsystem_lifecycle.go` | Creates cluster with VirtualMachines System pool, adds ManagedSystem pool, validates |
| 3 | `Scenario_ManagedSystemPool_Disable` | `managedsystem_lifecycle.go` | Creates cluster with System + ManagedSystem pool, deletes ManagedSystem pool, validates migration |

### Supporting files:
- `managedsystem_reconcile.go` — `VerifyReconcileAccepted` step (validates update/reconcile operations)
- `test/e2ev3/mutate/clean_managedsystem_pool.go` — mutation/cleanup helpers
- `test/e2ev3/validate/agent_pool/managedsystem_pool.go` — validation helpers

## Blocker: Standalone RP Environment Dead

**Build:** `hayuaebld164286963`
**Error:** `ResourceGroupNotFound` — Resource group `hcphayuaebld164286963-eastus2` does not exist.
**Command:** `aksdev sd connect --kind svc-0` (from `/home/hayua/rp`)
**RP status:** `curl -sk https://localhost:8443` returns exit code 7 (connection refused)

The standalone environment for this build has been recycled/never provisioned. Cannot run any e2e tests until a new working build is available.

## Next Steps
Human needs to either:
1. Provision build `hayuaebld164286963` (create the resource group), or
2. Provide a new/different standalone build ID that has an active environment
