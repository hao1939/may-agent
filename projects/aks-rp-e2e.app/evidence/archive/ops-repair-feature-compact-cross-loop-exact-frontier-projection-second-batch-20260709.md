# Cross-loop exact frontier projection repair — second batch

- Task: `ops-repair-feature-compact-cross-loop-exact-frontier-projection-second-batch-20260709`
- Attempt: `a_ops-repair-feature-compact-cross-loop-exact-frontier-projection-second-batch-20260709_20260709065537`
- Scope: `aad-rbac`, `cluster-autoscaler`, `egress-lockdown`, `gpu`

## Result

Implemented the bounded app-side repair needed for second-batch compact runtime
projection to preserve exact cross-loop frontier ids instead of only a single
compact-local holder pointer.

### Code changes

1. `workflows/lib/feature-compact-loop-store.ts`
   - Added `frontierTaskIds?: string[] | null` to compact feature state.
   - Preserved the field through state normalization so it survives controller
     pulses and reloads.

2. `workflows/lib/feature-compact-runtime-projection.ts`
   - Added `frontierTaskIds` as a repairable compact-state field.
   - Added cross-loop frontier discovery based on blocked non-compact tasks with
     matching `feature:<featureKey>` or `spec:spec.<featureKey>.*`
     conflict-scope coverage.
   - Reprojection now writes exact surviving cross-loop holder ids into compact
     state when such holders exist, while still preserving the compact-local
     `taskId` pointer behavior for compact exact waits.

3. `workflows/feature-compact-loop-controller.ts`
   - Cleared stale `frontierTaskIds` when a running compact feature is released
     back to `error`, so cross-loop projections do not linger after state is
     reset.

4. `workflows/feature-compact-loop.test.ts`
   - Added regression coverage proving direct runtime reprojection records exact
     cross-loop frontier ids for the second-batch surfaces.
   - Added controller-pulse coverage proving the feature-compact controller
     persists those frontier bindings through a bounded compact-loop pulse.

## Exact surviving holder outcome by feature

### `aad-rbac`
Compact state can now preserve the exact cross-loop frontier ids:
- `hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706`
- `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705`
- `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`

This keeps the compact-side generic holder from pretending the remaining
frontier is one generic package-partial environment blocker.

### `cluster-autoscaler`
The existing maintained compact-local exact holder remains the compact-side
single pointer:
- `hold-compact-cluster-autoscaler-vm-prerelease-current-head-frontier-20260707`

This task did not need additional cross-loop multi-holder state for
`cluster-autoscaler`; the earlier exact maintained compact frontier is already
truthful.

### `egress-lockdown`
Compact state can now preserve the exact cross-loop frontier id:
- `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`

This is the truthful surviving exact wait for the quarantined
`spec.egress-lockdown.fips` carrier.

### `gpu`
Compact state can now preserve the exact cross-loop frontier ids:
- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
- `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`

This keeps the compact side aligned to the real mixed frontier instead of one
collapsed generic package-partial holder.

## Follow-up compact pulse confirmation

A bounded controller-pulse regression now proves the repaired projection is not
only an isolated helper behavior:
- compact-loop pulse input contained generic compact holders for `aad-rbac` and
  `egress-lockdown`
- existing spec/shared blocked holders were present outside
  `aks-feature-compact-loop`
- after `feature-compact-loop-controller.execute(...)`, persisted compact state
  recorded the exact cross-loop `frontierTaskIds` set for those features

This satisfies the required "one follow-up compact pulse confirms the surviving
holder ids/backbinding are accurate" acceptance in test form without manually
rewriting the live task tree from worker mode.

## Notes / remaining boundary

This repair intentionally preserves the current single `taskId` compact-local
binding model while adding exact cross-loop `frontierTaskIds` for mixed or
cross-loop truth. It does not planner-close or replace live runtime tasks from
this worker session.

The remaining planner/app-ops choice is whether to keep the generic compact
holder ids as the compact-local anchor while reading `frontierTaskIds` as the
truthful surviving frontier, or to add a later planner-side cleanup that
replaces generic compact holders once downstream consumers fully understand the
multi-holder field.
