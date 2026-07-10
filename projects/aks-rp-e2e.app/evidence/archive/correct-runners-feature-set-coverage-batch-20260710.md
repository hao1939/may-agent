# Correct runners feature-set coverage after ADO run 171599421 — 2026-07-10

## Correction

ADO run `171599421` must not be treated as the full `runners` feature-set result.

The run used:

- `feature_set=runners`
- `plan_path=runs/plans/plan_20260709192619532_51qzyz.json`
- target `staging`

Because `plan_path` was provided, the pipeline executed the provided plan. That plan selected 11 specs.

## Current counts

- `ci/feature-sets/runners.txt` contains 66 spec IDs.
- A fresh staging plan from the full file selected 40 runnable specs:
  - `runs/plans/plan_20260710145631717_ting77.json`
  - 40 specs
  - 38 clusters
- ADO run `171599421` covered 11 selected specs.
- Its reviewed result was 10 pass / 1 error.
- The one error was `spec.virtualmachines.spot-pool-eviction`.
- Therefore runners coverage is not complete:
  - 11/40 runnable specs executed in that batch
  - 10/40 runnable specs passed
  - 1/40 runnable spec needs repair/rerun
  - 29/40 runnable specs still need execution
  - 26/66 inventory specs are not selected by the current planner and need explicit exclusion reasons

## Required task-tree interpretation

The parent runners work owns full feature-set coverage.

Each ADO run owns only its exact `selectedSpecIds`.

Do not close or summarize the runners feature set from one child run unless the child run covers the full current runnable set or the parent has rolled up all batches.

## Next action

Create or keep a focused domain follow-up that:

1. Records run `171599421` as an 11-spec batch result, not the whole feature-set result.
2. Repairs `spec.virtualmachines.spot-pool-eviction` preflight reference lookup.
3. Reruns only `spec.virtualmachines.spot-pool-eviction` after repair.
4. Dispatches the next runners batch from the remaining runnable specs.
5. Tracks coverage against the full runners surface: 66 inventory / 40 runnable / 11 executed / 10 passed.

