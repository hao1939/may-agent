# ops-repair-compact-app-routing-exact-frontier-projection-20260709

Status: bounded runtime/code limitation confirmed; no truthful single-task replacement exists in current app model.

## Assigned question

Can `hold-compact-app-routing-package-partial-frontier-202607090657` be replaced by exact surviving app-routing frontier waits, or does current app runtime/code still require one generic compact holder?

## Current compact ground truth

Controller-visible compact state and maintained compact diagnostics agree that app-routing is **not** one generic environment wait anymore.

### Exact residual frontier from maintained compact artifacts

`features/app-routing/compact/staging.summary.md` and `features/app-routing/compact/staging.diagnostics.json` currently split the 9 quarantined app-routing members into three exact frontier groups:

1. **accepted-environment-blocked-frontier**
   - `spec.app-routing.vm-prerelease.default-acnginx-internal`
   - `spec.app-routing.vm-prerelease.default-external-nginx.external-public`
   - `spec.app-routing.vm-prerelease.default-internal-nginx.internal-private`
   - `spec.app-routing.vm-prerelease.osm-external-nginx.internal`
2. **accepted-product-gap-frontier**
   - `spec.app-routing.default-domain-tls-lifecycle`
3. **reviewed-exception-frontier**
   - `spec.app-routing.default-domain-istio-hello-world`
   - `spec.app-routing.default-domain-tls-secret`
   - `spec.app-routing.rollback-istio-to-nginx`
   - `spec.app-routing.tls-lifecycle-rotation`

The maintained resume condition is also split-oriented: resume each preserved frontier only through its own exact owner action, gate change, evidence promotion, or policy repair.

## What the live app currently projects

Current feature-compact state points app-routing at one blocked holder:

- state task id: `hold-compact-app-routing-package-partial-frontier-202607090657`
- blocker waiting_for type: `owner.decision`
- goal text: `Hold compact feature app-routing on exact package-partial wait until the named condition changes.`

That holder text embeds the split-frontier explanation, but the task identity and `waiting_for` contract still collapse the mixed frontier into one feature-level blocked leaf.

## Existing exact waits already present elsewhere in the tree

The broader task tree already contains some exact app-routing waits outside the compact loop, for example:

- `wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705`
- `hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705`
- `wait-spec-app-routing-rollback-istio-to-nginx-existing-target-return-20260708`

Those prove the tree can carry exact app-routing sub-frontiers, but they do **not** fully cover the compact residual frontier:

- there is no compact-linked exact holder for the four environment-blocked VM-prerelease members,
- there is no compact-linked exact holder for `spec.app-routing.default-domain-tls-lifecycle`,
- and the compact runtime has no way to point one feature at several exact residual waits simultaneously.

## Exact bounded code limitation

The current app code still requires one generic compact holder because the feature-compact runtime projection is **single-holder, single-wait-type** per feature.

### 1) Feature compact state stores only one task pointer

`workflows/lib/feature-compact-loop-store.ts` defines app-owned feature state with singular fields:

- `taskId?: string | null`
- `waitingFor?: Record<string, unknown> | null`

There is no array/map for multiple residual frontier links.

### 2) Exact-wait materialization creates one holder per feature/errorClass

`workflows/feature-compact-loop-controller.ts`:

- `nextCompactExactWaitTaskId(...)` creates ids shaped like `hold-compact-<feature>-<errorClass>-frontier`
- `materializeExactFeatureCompactWaits(...)` creates **one** blocked wait task for a feature when package-partial followup is needed

So the controller contract is feature-scoped, not frontier-group-scoped.

### 3) waiting_for type is derived from the whole merged reason text

`compactExactWaitReason(...)`, `compactWaitOwner(...)`, and `compactWaitingFor(...)` derive one owner and one `waiting_for.type` from the combined reason text.

For app-routing, that merged reason text contains words like:

- `owner`
- `product`
- `promotion`

Because of that, `compactWaitingFor(...)` resolves the holder to `owner.decision`, even though the maintained frontier is actually mixed across environment-blocked, product-gap, and reviewed-exception groups.

### 4) Runtime reprojection can only backbind to one live exact wait task id

`workflows/lib/feature-compact-runtime-projection.ts` collects at most one live exact wait task id per feature and repairs state back to that one id. It does not synthesize or project multiple compact frontier links from `selectionBlocker.frontierGroups` / `nextStepClassification` / diagnostics metadata.

## Conclusion

`hold-compact-app-routing-package-partial-frontier-202607090657` cannot be truthfully replaced by exact surviving mixed residual waits **within the current app runtime model**.

The blocker is not lack of frontier evidence; the frontier is already explicit in maintained compact artifacts. The blocker is app code shape:

- one compact feature record -> one `taskId`
- one holder -> one `waiting_for`
- one heuristic owner/type derived from merged text
- no frontier-group projection from compact diagnostics into multiple wait links

Therefore the current generic holder is still required **until** the app supports frontier-group projection for compact features.

## Minimal planner/app-ops follow-up implied by this finding

If the planner wants truthful replacement instead of one generic holder, it will need a separate app repair to:

1. teach compact state/projection to represent multiple residual frontier links per feature, or
2. teach the compact controller to materialize explicit frontier-group children (environment/product/reviewed-exception) and store them in a multi-link structure rather than a single `taskId`.

Without that schema/controller change, replacing the current holder by hand would either:

- drop some residual frontier members, or
- misclassify the mixed frontier as one owner/type again.
