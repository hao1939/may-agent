# ops-repair-compact-shared-wait-regeneration-20260709

Date: 2026-07-09
Task: `ops-repair-compact-shared-wait-regeneration-20260709`

## What was broken

The compact controller could recreate duplicate `package-partial` blocked holders even after a feature had already been rebound to the truthful surviving wait.

The concrete repro family was:

- `ossku-migration` -> should stay on `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
- `planned-maintenance` -> should stay on `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
- `egress-lockdown` -> should stay on `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`

Runtime evidence before the repair showed exactly that duplicate regeneration pattern:

- `.state/journal.jsonl` recorded a pulse at `2026-07-09T08:52:14Z` creating
  `hold-compact-egress-lockdown-package-partial-frontier`,
  `hold-compact-ossku-migration-package-partial-frontier`, and
  `hold-compact-planned-maintenance-package-partial-frontier`.
- The same journal then recorded those holders being replaced at `2026-07-09T08:57:55Z` by the surviving shared/spec waits.
- Current runtime inspection still showed regenerated duplicates after that replacement window:
  - `hold-compact-ossku-migration-package-partial-frontier` active again
  - `hold-compact-planned-maintenance-package-partial-frontier-202607090902` active again
  - feature state for `egress-lockdown` still carried `frontierTaskIds = [wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702]`

So the bug was not the reviewer decision. The bug was the controller’s representation test during later pulses.

## Root cause

Two representation gaps in `workflows/feature-compact-loop-controller.ts` let later pulses think those features were unrepresented:

1. `featureKeysRepresentedByTask()` only harvested `feature-compact:*` conflict scopes, but the surviving shared wait uses `feature:*` scopes such as:
   - `feature:planned-maintenance`
   - `feature:ossku-migration`
   - `feature:egress-lockdown`

   That meant shared/spec waits could be real, open, and truthful while the controller still failed to count them as feature representation.

2. `materializeExactFeatureCompactWaits()` only suppressed new holder creation when the feature was already represented by an open loop child. It did **not** suppress creation when the persisted compact state had already been rebound to:
   - `state.features[feature].taskId = <shared wait id>`, or
   - `state.features[feature].frontierTaskIds = [<cross-loop wait id>]`

   That is the exact shape for this bug family:
   - `ossku-migration` / `planned-maintenance` are rebound to one shared compact wait
   - `egress-lockdown` is rebound through a cross-loop spec wait

## Code repair

### 1) Count `feature:*` conflict scopes as valid feature representation

Updated `featureKeysRepresentedByTask()` so shared waits with `feature:<name>` scopes are treated as representing that feature, not only `feature-compact:<name>` scopes.

### 2) Use the same representation logic for open child coverage

Updated `openFeatureScopedChildKeys()` to reuse `featureKeysRepresentedByTask()` so the controller’s open-child coverage logic and blocked-wait coverage logic stay aligned.

### 3) Suppress new exact wait creation when persisted state already projects to an open shared/cross-loop wait

Added `hasOpenProjectedFeatureRepresentation()` and used it inside `materializeExactFeatureCompactWaits()`.

This prevents a new `hold-compact-<feature>-package-partial-frontier` from being created when the feature is already truthfully projected to an open task via:

- `state.features[feature].taskId`, or
- `state.features[feature].frontierTaskIds`

and that projected task is still open and still represents the same feature.

## Verification

### Runtime/source evidence used for diagnosis

- `wait-compact-reviewed-exception-live-ready-policy-family-20260702` currently carries `feature:planned-maintenance` and `feature:ossku-migration` scopes.
- `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702` currently carries `feature:egress-lockdown` scope.
- Compact state currently shows:
  - `ossku-migration.taskId = hold-compact-ossku-migration-package-partial-frontier` before repair diagnosis of this bug family
  - `planned-maintenance.taskId = hold-compact-planned-maintenance-package-partial-frontier`
  - `egress-lockdown.frontierTaskIds = [wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702]`

Those facts match the exact false-negative representation paths fixed in code.

### Bounded controller refresh verification

Added a controller test that simulates the repaired runtime shape:

- `ossku-migration` state projected to `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
- `planned-maintenance` state projected to `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
- `egress-lockdown` state projected via `frontierTaskIds = [wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702]`

The new test verifies that a bounded controller pulse does **not** recreate:

- `hold-compact-ossku-migration-package-partial-frontier`
- `hold-compact-planned-maintenance-package-partial-frontier`
- `hold-compact-egress-lockdown-package-partial-frontier`

and that workflow progress still counts those features as represented.

Test name:

- `controller pulse does not recreate package-partial holders when state already projects to shared or cross-loop waits`

## Environment-overblock warning family tie-back

This fix closes the passive-duplicate regeneration path that kept reopening the compact environment-overblock warning family after truthful replacement work had already happened.

Future blocked-frontier reviews should treat this as the durable controller rule:

- if compact state already points a feature at an open shared wait or cross-loop exact wait, later compact pulses must preserve that binding and must not recreate a feature-local `package-partial` duplicate holder.

That is the controller-side prevention needed so `ossku-migration`, `planned-maintenance`, and `egress-lockdown` do not keep reappearing as passive duplicate warning holders after exact/shared wait consolidation.