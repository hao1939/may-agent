# ops/repair-feature-compact-environment-overblock-projection-residue-20260709w

- Attempt: `a_ops_repair-feature-compact-environment-overblock-projection-residue-20260709w_20260709125158`
- Reviewed at: 2026-07-09T11:43Z

## Result

Success.

I finished one additional bounded compact-holder/projection cleanup beyond the earlier workload-identity and hcp-interceptor passes by tightening runtime projection for two remaining mixed warning-family holders that were still surfacing generic placeholder wait types even though their holder text already named exact represented frontiers:

- `hold-compact-cost-analysis-reviewed-exception-frontier`
- `hold-compact-managedsystem-pool-reviewed-exception-frontier`

The repair keeps the same exact compact holders in place, but rewrites their stale generic `blocker.waiting_for` payloads to the truthful represented frontier type derived from compact state and holder text.

## Why these were still residue

Live runtime inspection showed both holders still existed under `aks-feature-compact-loop`, but their `waiting_for` payloads were too generic:

- `cost-analysis` holder used `type=environment.available`
- `managedsystem-pool` holder used `type=evidence.available`

Those generic types contradicted the maintained compact authority and their own blocker text:

- `features/cost-analysis/compact/staging.summary.md` says the exact blocker is an execute-ready promotion candidate that still depends on underlay kubeconfig plus owner review.
- `features/managedsystem-pool/compact/staging.summary.md` says the exact blocker is a mixed terminal-and-promotion frontier led by `spec.managedsystem.cli-create-variant` promotion/reclassification plus preserved reviewed-exception members.

So these holders were no longer broad environment-overblock noise in text, but their runtime projection still made them look like it.

## Code change

### `workflows/lib/feature-compact-runtime-projection.ts`

Added a bounded refresh path for **existing exact compact holders**:

- new helper `genericProjectionPlaceholder(...)` recognizes stale placeholder wait types:
  - `environment.available`
  - `evidence.available`
  - `publish.auth.ready`
- new helper `shouldRefreshExistingExactProjection(...)` decides when a holder already bound to the correct `taskId` still needs its `blocker.waiting_for` payload refreshed to the sharper represented frontier.
- projection logic now updates `blocker.waiting_for` even when the exact holder is already the current `taskId`, if the holder still carries one of those generic placeholders and the represented frontier text indicates a sharper prerequisite/promotion boundary.

This is intentionally narrow:

- no new umbrella wait was created
- no compact rerun was reopened
- no task-tree restructuring was done
- only the stale runtime projection payload for already-correct exact holders is tightened

## Bounded holder outcomes

### cost-analysis

Before:
- holder: `hold-compact-cost-analysis-reviewed-exception-frontier`
- `waiting_for.type = environment.available`

After projection repair:
- same holder remains
- `waiting_for.type = environment.prerequisite.ready`
- payload now carries the exact compact frontier identity:
  - `featureKey = cost-analysis`
  - `target = staging`
  - `errorClass = reviewed-exception`
  - `scope = feature-compact`

This matches the maintained compact summary's real dependency on underlay/runtime-input readiness rather than a generic environment bucket.

### managedsystem-pool

Before:
- holder: `hold-compact-managedsystem-pool-reviewed-exception-frontier`
- `waiting_for.type = evidence.available`

After projection repair:
- same holder remains
- `waiting_for.type = owner.decision`
- payload now carries the exact compact frontier identity:
  - `featureKey = managedsystem-pool`
  - `target = staging`
  - `errorClass = reviewed-exception`
  - `scope = feature-compact`

This matches the maintained compact summary's real mixed promotion/terminal frontier instead of a generic evidence placeholder.

## Test coverage added

Added a focused regression in `workflows/feature-compact-loop.test.ts`:

- `refreshes existing exact holders from generic wait types to the represented promotion or prerequisite frontier`

The test proves that when a compact feature already points at the correct exact holder, runtime projection now still sharpens the holder's `blocker.waiting_for` payload if it is stuck on a generic placeholder.

Verified expectations:

- `cost-analysis` refreshes from `environment.available` → `environment.prerequisite.ready`
- `managedsystem-pool` refreshes from `evidence.available` → `owner.decision`
- neither feature is rebound to a different `taskId`

## Acceptance mapping

### 1. Additional bounded holder rewrite beyond workload-identity and hcp-interceptor

Satisfied.

This pass tightened two additional remaining holders (`cost-analysis`, `managedsystem-pool`) so they now cite their exact represented frontiers through runtime projection instead of generic placeholder types.

### 2. Fewer misleading environment-overblock warnings or one exact documented reason residue cannot be reduced further

Satisfied.

This removes another class of misleading residue: holders whose text was exact but whose runtime `waiting_for` payload still looked like generic environment/evidence noise.

### 3. Do not create another umbrella wait and do not broad-rerun unchanged compact packages

Satisfied.

No new wait tasks were created and no compact package reruns were dispatched.

## Remaining residue boundary

The biggest remaining residue is no longer these placeholder `waiting_for` payloads. The harder remaining cases are holders whose live task-tree surface is itself still a generic compact-local carrier because downstream exact frontier groups are not yet fully materialized for binding, such as the previously documented app-routing proving case.

That remaining boundary is structural task-surface completeness, not the simple projection-placeholder problem fixed here.
