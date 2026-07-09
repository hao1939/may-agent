# ops-repair-compact-exact-holder-owner-backfill-20260709

## Result

Fixed the app runtime so a surviving `featureCompactExactWait` blocked holder with blank `task.owner` now backfills the same derived owner used at exact-holder creation time, without replacing a truthful existing holder or changing blocker/frontier linkage.

## File-level repair

### 1) Shared owner derivation extracted

Added:

- `workflows/lib/feature-compact-wait-owner.ts`

This exports the exact `compactWaitOwner(reason)` derivation used to classify compact exact waits.

### 2) Exact-holder creation still uses the same owner logic

Updated:

- `workflows/feature-compact-loop-controller.ts`

The controller now imports `compactWaitOwner(...)` from the shared helper, preserving the owner derivation already used when a new exact compact wait is created.

### 3) Runtime projection reconciliation now repairs blank surviving task owners

Updated:

- `workflows/lib/feature-compact-runtime-projection.ts`

Repair changes:

- extended runtime task repair reporting to include `field: "task.owner"`
- added `taskOwner(...)` helper
- during `reconcileFeatureCompactRuntimeProjection(...)`, for each surviving blocked `featureCompactExactWait` holder:
  - derive `desiredOwner = compactWaitOwner(blocker.condition)`
  - if `task.owner` is blank and the derived owner is non-empty, set `task.owner = desiredOwner`
  - emit a `taskRepairs` entry with `field: "task.owner"`
- existing truthful non-blank owners are left untouched
- blocker metadata and compact state projection behavior remain intact

## Regression coverage added

Updated:

- `workflows/feature-compact-loop.test.ts`

Added a bounded regression:

- starts from two pre-existing surviving exact compact holders with blank `task.owner`
- uses the same known residue ids:
  - `hold-compact-app-routing-package-partial-frontier-202607090657`
  - `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`
- runs one bounded `reconcileFeatureCompactRuntimeProjection(...)` pass
- verifies:
  - `task.owner` becomes non-empty
  - app-routing backfills to `product-owner`
  - cluster-autoscaler backfills to `aks-explorer`
  - `blocker.owner` stays intact
  - `blocker.waiting_for` stays unchanged
  - state `taskId` links stay pointed at the same surviving holders

## Proof on the known blank-owner residues

Using the current app runtime snapshots:

### Before reconciliation

- `hold-compact-app-routing-package-partial-frontier-202607090657`
  - `task.owner = ""`
  - `blocker.owner = "product-owner"`
  - `blocker.waiting_for.type = "owner.decision"`
- `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`
  - `task.owner = ""`
  - `blocker.owner = "aks-explorer"`
  - `blocker.waiting_for.type = "pipeline.result.or.artifact.available"`

### Reconciliation output

`reconcileFeatureCompactRuntimeProjection(...)` produced these repairs:

- app-routing:
  - `field = "task.owner"`
  - `before = ""`
  - `after = "product-owner"`
- cluster-autoscaler:
  - `field = "task.owner"`
  - `before = ""`
  - `after = "aks-explorer"`

### After reconciliation

- `hold-compact-app-routing-package-partial-frontier-202607090657`
  - `task.owner = "product-owner"`
  - `blocker.owner = "product-owner"` unchanged
  - `blocker.waiting_for.type = "owner.decision"` unchanged
- `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`
  - `task.owner = "aks-explorer"`
  - `blocker.owner = "aks-explorer"` unchanged
  - `blocker.waiting_for.type = "pipeline.result.or.artifact.available"` unchanged

## Verification

1. `bun test ./workflows/feature-compact-loop.test.ts --timeout 30000`
   - passed all 60 tests
   - includes:
     - `backfills owner on surviving blank-owner exact compact holders without changing blocker links`

2. `bun run typecheck`
   - passed

3. Bounded runtime proof script against the live app snapshots
   - confirmed both known residue tasks start with blank `task.owner`
   - confirmed reconciliation reports two `task.owner` repairs
   - confirmed both tasks end with non-empty owners while blocker owners and `waiting_for` values remain unchanged

## Acceptance mapping

- **Backfill on surviving exact holders:** satisfied by the reconciliation repair in `workflows/lib/feature-compact-runtime-projection.ts`
- **Bounded regression:** satisfied by the new `feature-compact-loop.test.ts` case
- **Proof on existing residues:** satisfied by the bounded runtime proof against:
  - `hold-compact-app-routing-package-partial-frontier-202607090657`
  - `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`
