# 2026-07-15 no-work-with-gaps refill root cause

Assigned task: `ops/repair-no-work-with-gaps-refill-20260715`

## Summary

The `no-work-with-gaps` alert is a real compact-loop liveness bug, not a pure metric false positive.

Current app state shows zero runnable/review/waiting domain backlog outside this repair, while the domain workspace still carries many non-pass draft/unknown verification gaps with explicit rerun-ready subsets. The suppression point was the compact-loop controller: it only materialized grouped repair/follow-up work for `error` features, but many current compact features were stored as `blocked` exact-frontier holders even though their maintained diagnostics carried non-empty `compactLiveReadiness.readySpecIds`. That left the loop in blocked-only stewardship with `noRefillNow=true`, so no truthful executable backlog was created.

Patch landed in `workflows/feature-compact-loop-controller.ts` so blocked `package-partial` compact frontiers with non-empty rerun-ready member sets now create grouped follow-up work that preserves existing exact waits while restoring executable backlog.

## Baseline evidence

### Project/root baseline

From `app/.state/project-state.json` at the start of this task:

- `runnableLeafCount = 0`
- `waitingLeafCount = 0`
- `reviewLeafCount = 0`
- `activeLeafCount = 1` (this repair task itself)
- `blockedLeafCount = 121`
- focus summary: `active=[ops/repair-no-work-with-gaps-refill-20260715], review=[none], waiting=[none], runnable=[none]`

This confirms the alert premise: outside this repair task, the live task tree had no executable frontier.

### Domain gap evidence

`bun run status -- --gaps` still reports non-pass gaps, including draft/unknown Windows GPU and Windows prerelease paths, for example:

- `path.windows-gpu.vmss-prerelease-grid [draft]`
- `path.windows-gpu.vmss-prerelease-cuda [draft]`
- `path.windows.mixed-os-combination-virtualmachines [draft]`
- `path.windows.node-pool-create-virtualmachines-gen2 [draft]`
- `path.windows.vm-prerelease-custom-kubelet-config [draft]`
- `path.traffic-alb-controller.ingress-routing` / `upgrade-survival` remain compact-rerun-ready while `enable-lifecycle` stays the blocked residual member

So the project was not actually “out of work”; it was out of represented executable backlog.

## Why the blocked-only posture was wrong

### Windows compact authority still advertises runnable work

`features/windows/compact/staging.summary.md` currently says:

- compact package is partial
- `Rerun-ready member set`
  - `spec.windows.node-pool-create-virtualmachines`
- `Use only the rerun-ready member set above until active-frontier quarantined members are repaired or reclassified.`

That is not a blocked-only frontier. It is an explicit instruction that one bounded member remains runnable while other members stay quarantined.

### Traffic ALB authority shows the same pattern

`features/traffic-alb-controller/compact/staging.summary.md` currently says:

- compact package is partial
- `Rerun-ready member set`
  - `spec.traffic-alb-controller.ingress-routing`
  - `spec.traffic-alb-controller.upgrade-survival`
- `Use only the rerun-ready member set above until excluded/quarantined members are repaired or reclassified.`

Again: not blocked-only.

### This is systemic, not one feature

A direct scan of `app/.state/feature-compact-loop/state.json` plus maintained compact diagnostics found **29 blocked `package-partial` features** whose `compactLiveReadiness.readySpecIds` sets are non-empty. Sample rows:

- `aad-rbac` → 4 rerun-ready members
- `app-routing` → 11 rerun-ready members
- `cluster-autoscaler` → 18 rerun-ready members
- `jwt-authenticator` → 3 rerun-ready members
- `localdns` → 5 rerun-ready members
- `net-integration` → 34 rerun-ready members
- `network-cni` → 53 rerun-ready members
- `storage-csi` → 30 rerun-ready members
- `traffic-alb-controller` → 2 rerun-ready members
- `windows` → 1 rerun-ready member

## Root cause in app code

The controller path before this patch behaved like this:

1. `feature-compact` state preserved many mixed frontiers as `status: "blocked"` with exact holder tasks.
2. `materializeFeatureCompactFollowups()` called `compactFollowupGroups()`.
3. `compactFollowupGroups()` only considered features where `status === "error"` and retry budget was exhausted or retryability was false.
4. Blocked `package-partial` features were therefore invisible to grouped backlog creation, even when their maintained diagnostics still advertised rerun-ready subsets.
5. With only blocked holders left, controller workflow progress collapsed to:
   - `openChildren = 0`
   - `openSupportChildren = 0`
   - `unrepresentedNonTerminalCount = 0`
   - `noRefillNow = true`
6. That produced the false blocked-only story seen on the loop root and starved the project of executable compact backlog.

In short: **the controller treated “represented by exact blocked wait” as sufficient, even when the same compact authority explicitly said a bounded rerun-ready subset still existed.**

## Patch landed

### File changed

- `workflows/feature-compact-loop-controller.ts`

### Behavioral change

The controller now:

1. Reads `compactLiveReadiness.readySpecIds` from each maintained compact diagnostics JSON file; human-readable summaries are not execution authority.
2. Detects blocked `package-partial` compact features whose structured rerun-ready set is non-empty.
3. Includes those blocked frontiers in grouped compact follow-up creation.
4. Creates grouped support work with a backlog-restoring goal:
   - preserve exact blocked waits
   - review the current rerun-ready member sets
   - requeue only bounded, dependency-clear work
5. Records the source states (`blocked`) and exact ready spec ids in follow-up context so the repair task is reviewable as a blocked-frontier refill, not a generic retry-drained error.
6. Records a stable work fingerprint and does not recreate the same completed support task until the structured ready set or compact failure/input fingerprint changes.

### New automated guard

Added regression coverage proving the controller creates a grouped compact follow-up for a blocked `package-partial` frontier when structured diagnostics contain a non-empty ready set, while preserving the existing blocked holder unchanged. Additional cases prove missing, malformed, and empty diagnostics do not infer work from prose and that a later pulse does not recreate unchanged completed support work.

## Verification

`bun test workflows/feature-compact-loop.test.ts` passes after the patch, including the new regression case.

Key proof points from the new test:

- blocked holder `hold-compact-windows-eligibility-frontier-20260707` stays `blocked`
- controller creates one grouped compact follow-up child
- follow-up goal contains `Restore truthful executable backlog`
- follow-up context includes `errorClass: "package-partial"` and `sourceStates: ["blocked"]`
- follow-up context carries `rerunReadySpecIdsByFeature` and a stable `workFingerprint`
- follow-up acceptance explicitly names `compactLiveReadiness.readySpecIds`

## Worker-mode boundary

This session did **not** mutate the live task tree beyond source-code/test changes, and it did **not** emit runtime events. The repair is landed as code plus evidence.

## Exact next action proposal for planner/app-ops

Because worker mode cannot emit the runtime transition, the planner/app-ops reviewer should trigger the patched controller once:

### Canonical event proposal

- event: `project.task.tick`
- action: `feature-compact-loop`
- project: `aks-rp-e2e`
- target.taskId: `aks-feature-compact-loop`

### Expected post-pulse outcome

The patched controller should materialize a grouped compact follow-up task under `aks-feature-compact-loop` (expected base id: `reconcile-compact-loop-package-partial`) with a backlog-restoring goal, while preserving the existing exact blocked holder tasks.

That pulse is the truthful refill step that should clear the present `no-work-with-gaps` condition without refreshing or broadening the preserved exact waits.
