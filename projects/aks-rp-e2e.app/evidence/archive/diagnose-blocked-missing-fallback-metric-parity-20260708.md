# Diagnose blocked missing-fallback metric parity — 2026-07-08

## Result

The `aks-rp-e2e.process.blocked.missing-fallback-count` spike to `current=1` was real at sample time, but it was caused by a short-lived runtime-tree parity gap on one compact wait that had already become stale by the time later planner/app-ops reviews looked at the tree.

No committed `tasks/tree.json` repair was needed.
No metric-definition bug was found.
The live runtime now recomputes to `0`, the persisted metric row is `0`, and alert `3052` is resolved.

## Metric implementation used

`scripts/project-metrics.ts` computes the metric from **blocked leaf tasks** and counts a task as missing fallback when either of these blocker fields is absent:

- `fallback_at`
- `fallback_action`

Relevant implementation:

- `blockedMissingFallback = blockedLeafTasks.filter(...)`
- metric id `aks-rp-e2e.process.blocked.missing-fallback-count` returns `tasks.blockedMissingFallback`

So the question is only: **which blocked runtime leaf at the sampled moment lacked fallback contract fields?**

## Runtime evidence

### Current metric state

Runtime DB now shows the metric recovered:

- metric row: `current=0`
- `updated_at=1783480351281`

Recent snapshots for this metric:

- `1783480351281 => 0`
- `1783480043771 => 1`
- `1783479736958 => 0`
- `1783479429640 => 0`
- `1783479122865 => 4`

### Direct current runtime-tree audit

A direct scan of `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` now finds:

- blocked leaf tasks missing fallback: `0`
- committed tree missing fallback: `0`

So the current tree is clean.

## Exact runtime family responsible for the `1` sample

The one-sample spike at `measured_at=1783480043771` was part of a **four-metric simultaneous spike**:

- `aks-rp-e2e.process.blocked.missing-fallback-count = 1`
- `aks-rp-e2e.process.blocked.missing-observer-count = 1`
- `aks-rp-e2e.process.blocked.missing-owner-count = 1`
- `aks-rp-e2e.process.blocked.missing-waiting-for-count = 1`

That pattern means the offender was not a task missing only fallback; it was a blocked task whose blocker contract was missing several structured fields at once.

The runtime journal and runtime tree show the relevant task family:

- task created: `wait-ado-171311555-capacity-surge-direct-carriers-return-20260708`
- created at `2026-07-08T03:06:46Z`
- review replacement note: it replaced the non-terminal capacity-surge review leaf while waiting on Azure DevOps run `171311555`

Later runtime events show what happened next:

1. `2026-07-08T03:06:46Z` — task created as a blocked wait
2. `2026-07-08T03:08:41Z` — owner rollup still described that wait as live
3. `2026-07-08T03:12:59Z` — `feature_compact_loop_stale_blocked_waits_closed` closed `wait-ado-171311555-capacity-surge-direct-carriers-return-20260708`
4. current runtime tree shows that task as `done`, with trace fields:
   - `blocked_contract_repaired_at: 2026-07-08T03:10:24.038Z`
   - `stale_wait_closed_at: 2026-07-08T03:12:59.324Z`
   - `stale_wait_closed_reason: all spec ids named by this compact wait are already pass in spec-loop state`

This is the exact path that explains the parity incident:

- the wait existed in runtime state,
- it briefly lacked full blocked-contract metadata,
- it was later repaired and then closed as stale,
- but the sampled metric/warning state still reflected the earlier runtime snapshot.

## Why later reviews looked contradictory

Two different app surfaces were reading different moments of runtime state:

- the metric snapshot at `1783480043771` captured the runtime while one blocked wait still had incomplete contract metadata;
- later frontier/warning review still referenced that wait even after the controller had already closed it as stale;
- by `1783480351281`, the persisted metric row had caught up and returned to `0`.

This is why the planner packet could still mention the capacity-surge wait/warning while the current metric/tree audit were already clean.

## Code path involved

The metric itself is correct.
The parity gap came from the **runtime blocked-wait lifecycle**, not from `scripts/project-metrics.ts`.

Relevant app/runtime paths involved:

- `scripts/project-metrics.ts` — reads blocked leaf runtime tasks and counts missing fallback fields
- `scripts/task-tree.ts` repair path — adds `waiting_for`, `observed_by`, `observation_method`, `next_check_at`, `fallback_at`, and `fallback_action`, and stamps `trace.blocked_contract_repaired_at`
- `feature-compact-loop-controller` / runtime controller pulse — later closed the stale blocked wait once both named specs were already pass

## Smallest truthful ops conclusion

### What was real

At `1783480043771`, there really was one runtime blocked leaf with an incomplete blocker contract.

### What is true now

There is no current offender:

- current runtime-tree audit: `0`
- current committed-tree audit: `0`
- persisted metric row: `0`
- alert `3052` is resolved

### Smallest repair status

The app/runtime already self-healed through:

- blocked-contract repair on the runtime wait
- stale-wait closure by the feature-compact controller
- later metric resample back to `0`

So no further tree mutation is justified from this task.

## Recommended follow-up if this false P0 repeats

If this exact family repeats, the smallest app-side repair to queue is:

- refresh blocked-action/warning generation after controller stale-wait closure, or
- suppress warnings for tasks already marked `done` in the current runtime tree,

because the packet evidence showed a closed stale wait still surfacing in review context after the controller had already finished with it.

That is a **future tooling follow-up**, not a current live blocker.

## Final state

- exact responsible runtime family: `wait-ado-171311555-capacity-surge-direct-carriers-return-20260708`
- cause: transient runtime blocked-contract gap plus stale review/warning surface timing
- current offender count: `0`
- metric now healthy: `0`
- durable next state: no remaining missing-fallback offender; reopen only if a future recompute names a new concrete blocked task id
