# ops-repair-feature-compact-multi-frontier-projection-app-routing-20260709

Reviewed at: 2026-07-09T18:00:05Z

## Result

Partial.

The current app workspace already contains the bounded runtime/state repair that lets one compact feature persist **multiple exact frontier links** via `frontierTaskIds` instead of only one `taskId`/`waitingFor` pair. That repair is covered by focused tests and by new persistence/projection code.

However, the live **app-routing** proving case is **not fully flipped yet**. Current runtime state still collapses app-routing onto one generic compact holder (`hold-compact-app-routing-package-partial-frontier-202607090657`) with `waiting_for.type=owner.decision`, and the app state file still has no `frontierTaskIds` for `app-routing`. The smallest remaining blocker is that the current live task tree does not yet provide a complete exact-holder set for the app-routing residual split frontier, so the new multi-frontier projection machinery has no full set of exact frontier children/links to bind.

## File-level repair evidence

### 1. Compact loop state can now persist multiple frontier links

`workflows/lib/feature-compact-loop-store.ts`

The feature state type now includes:

- `frontierTaskIds?: string[] | null`

and normalization/load paths preserve it:

- `normalizeExistingItem(...)` keeps `frontierTaskIds`
- `loadFeatureCompactLoopState(...)` carries forward `existing?.frontierTaskIds`

This is the persistence layer needed to represent more than one surviving frontier link for a single compact feature.

### 2. Runtime reprojection now computes exact cross-loop frontier holders

`workflows/lib/feature-compact-runtime-projection.ts`

The repair now includes:

- `RuntimeProjectionStateRepair.field` expanded to include `frontierTaskIds`
- `crossLoopExactFrontierTaskIds(...)`
- reprojection logic that, for blocked/error compact features, records the exact blocked holders outside `aks-feature-compact-loop` into `feature.frontierTaskIds`

Important details from the current file:

- matching uses both `feature:<featureKey>` scope and `spec:spec.<featureKey>.*` scope
- resulting task ids are deduplicated and sorted
- state repair emits a durable `frontierTaskIds` change record when the set changes

That is the concrete bounded change that moves the model beyond one single holder pointer.

## Test evidence

### Exact warning-family reprojection still works for app-routing/AAD-RBAC style holders

`workflows/feature-compact-loop.test.ts`

The stale warning-family reprojection test still passes and confirms the exact-holder rebinding behavior for:

- `node-http-proxy`
- `machines-agentpool`
- `ccp-coredns`
- `ossku-migration`
- `planned-maintenance`
- `aad-rbac`
- `app-routing`

Relevant expectation for app-routing in the test fixture:

- state rebinding from no pointer to `hold-compact-app-routing-shared-fixture-frontier-20260708`

### New second-batch mixed-surface reprojection test proves multi-link persistence

`workflows/feature-compact-loop.test.ts`

The second-batch persisted-state test now verifies `frontierTaskIds` for mixed/cross-loop surfaces. In that test:

- `aad-rbac` gets a three-task frontier set
- `egress-lockdown` gets its exact spec wait
- `gpu` gets two exact cross-loop waits

This is the specific proof that the runtime state can now preserve **multiple exact frontier links**.

### Commands run

```bash
bun test workflows/feature-compact-loop.test.ts -t 'reprojects stale compact warning-family holders to sharper exact waits'
bun test workflows/feature-compact-loop.test.ts -t 'reprojects persisted state to exact cross-loop frontier holders for second-batch mixed surfaces'
```

Both passed.

## Current app-routing proving-case facts

### Maintained compact summary already describes a split frontier

`/app/projects/aks-rp-e2e/features/app-routing/compact/staging.summary.md`

Current maintained authority says app-routing is partial because the excluded selected members split into exact preserved frontiers:

- `accepted-environment-blocked-frontier`
- `accepted-product-gap-frontier`
- `reviewed-exception-frontier`

and lists the nine residual members explicitly.

### Domain evidence already says this is a split frontier, not one generic wait

`/app/projects/aks-rp-e2e/evidence/archive/reconcile-compact-loop-package-partial-task-a_reconcile-compact-loop-package-partial-202607090138_20260709014539-worker.md`

That evidence states:

- `app-routing` → `repo-local-spec-metadata-split-frontier`
- residual split frontier = 4 accepted environment-blocked + 1 accepted product-gap + 4 reviewed-exception members

### Live task tree still has only a single compact holder for app-routing

`/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`

Current compact holder still present:

- `hold-compact-app-routing-package-partial-frontier-202607090657`

Current blocker facts on that task:

- `waiting_for.type = owner.decision`
- blocker text still summarizes the whole residual split frontier in one holder

### Live compact state still collapses app-routing to one holder

`/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`

Current app-routing entry still shows:

- `taskId = hold-compact-app-routing-package-partial-frontier-202607090657`
- no persisted `frontierTaskIds`

So the runtime code can now store multiple exact links, but the current live app-routing projection has not been rewritten to use them.

## Why app-routing is still partial after the code repair

The new projection machinery can only bind exact links that actually exist in the task tree.

The live tree currently exposes some exact app-routing blocked holders, for example:

- `wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705`
- `hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705`
- `wait-spec-app-routing-rollback-istio-to-nginx-existing-target-return-20260708`

But the maintained compact summary's full residual split frontier is broader than the currently visible exact blocked-holder set. In particular, the live tree does not yet present a complete exact-holder surface for all three maintained frontier groups in a way the runtime can bind as the app-routing proving case.

So the remaining blocker is now **structural task-surface completeness**, not the old "single pointer only" storage limitation.

## Smallest remaining blocker

Smallest remaining blocker:

1. the app/runtime repair for multi-frontier persistence is present;
2. the live app-routing compact state still points to one generic compact holder;
3. the current live task tree does not yet expose the full exact app-routing residual frontier as bindable exact holders/frontier-group children;
4. therefore the controller cannot yet replace the generic holder with a complete multi-link app-routing projection.

## What planner/app-ops should add next

Planner/app-ops follow-up needed, not worker-side tree mutation from this session:

- add or normalize the exact app-routing frontier-holder surface so the three maintained residual frontier groups are each represented by durable exact blocked holders/frontier-group children
- then rerun the compact-loop controller/reprojection path so `app-routing` can persist:
  - one canonical `taskId` if still needed for backward compatibility, and
  - `frontierTaskIds` containing the exact surviving split-frontier holders

Once those exact holders exist, the new runtime machinery should be able to backbind app-routing without collapsing the whole residual frontier into one `owner.decision` compact holder.
