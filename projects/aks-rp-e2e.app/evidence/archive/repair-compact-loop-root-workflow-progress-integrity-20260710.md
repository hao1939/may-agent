# Compact loop root workflow-progress integrity repair (2026-07-10 retry)

## Exact cause of the mismatch

The mismatch was not just stale runtime state. It was a rollup semantics bug in the shared SDK plus a stale blocked snapshot produced by that bug.

### 1. Runtime feature/state truth was non-terminal

App-owned compact-loop state at `.state/feature-compact-loop/state.json` showed the compact loop was still actively incomplete:

- `pending=19`
- `running=1`
- `error=4`
- `blocked=27`
- active pipeline waits still existed for `cluster-autoscaler`, `egress-lockdown`, and `gpu`

That means the durable root could not truthfully be treated as a pure blocked-wait steward.

### 2. Runtime tree child frontier was blocked-only at the moment of rollup

Before the repair settled, `.state/tasks/tree.json` had `aks-feature-compact-loop` in `state=blocked` with only blocked child holders and no open children. Its `workflowProgress` simultaneously reported:

- `completionReady=false`
- `dispatchHeld=true`
- `pending=19`
- `running=1`
- `unrepresentedNonTerminalCount=19`
- `blockedWaitChildren=47`

So the root had blocked children, but it also had real non-terminal residue and an active live run that were **not** exhausted exact waits.

### 3. Why rollup still kept the root blocked

The shared SDK rollup code in `projects/may-agent/packages/sdk/src/project-task-tree.ts` used this rule for incomplete workflow-controller parents:

- if `dispatchHeld` OR `noRefillNow` OR `backendBlocked`, roll parent to `blocked`
- otherwise fall back to the stricter blocked-only stewardship check

That rule was too permissive. It allowed `dispatchHeld=true` by itself to keep a durable loop root blocked even when:

- `running > 0`, or
- `unrepresentedNonTerminalCount > 0`

Those are exactly the conditions that mean the root is **not** only an exact blocked wait steward.

In this case, the compact loop was dispatch-held by ADO capacity, but still had active/runnable non-terminal residue. The SDK therefore kept the root blocked and attached a `child-blocked` blocker, even though the truthful state was runnable/open rather than pure wait stewardship.

## Smallest truthful repair applied

### Code repair

Updated the shared SDK rollup logic in:

- `projects/may-agent/packages/sdk/src/project-task-tree.ts`

Change:

- removed the direct `dispatchHeld/noRefillNow/backendBlocked => blocked` shortcut from `rolledUpParentState(...)`
- now the parent only rolls to `blocked` when `blockedOnlyWorkflowWaitStewardship(...)` passes, which already requires:
  - blocked/done-only children
  - `blockedWaitChildren > 0`
  - `unrepresentedNonTerminalCount === 0`

Added regression coverage in:

- `projects/may-agent/packages/sdk/src/project-task-tree.test.ts`

New test proves a durable workflow root with `dispatchHeld=true` and `unrepresentedNonTerminalCount>0` rolls to `backlog`, not `blocked`.

### Runtime repair

After the SDK fix, ran:

- `bun run task-tree repair-rollups`

This re-evaluated the live runtime tree under the corrected rule.

## Final settled state after repair

Final controller-visible state in `.state/tasks/tree.json` now truthfully shows `aks-feature-compact-loop` as **active**, not blocked.

Why `active` instead of `backlog` at the final settled snapshot:

- the corrected rollup no longer falsely preserves blocked wait stewardship for dispatch-held residue
- after the repair pulse, the controller recreated one concrete open child:
  - `compact-feature-cluster-autoscaler`
- parent `workflowProgress` now shows:
  - `completionReady=false`
  - `pending=19`
  - `running=1`
  - `error=4`
  - `unrepresentedNonTerminalCount=19`
  - `openChildren=1`
  - `activeGithubRuns=4`
  - `activePipelineFeatureKeys=[cluster-autoscaler, egress-lockdown, gpu]`

So the truthful compact-loop representation is now:

- root `aks-feature-compact-loop`: `active`
- visible blocked holders remain under the root for exact waits/package-partial families
- one concrete active child exists for current compact work
- frontier/show now agree that the root is not a pure blocked steward

## Visible frontier outcome

After repair, `bun run task-tree frontier` shows:

- `active`: includes `aks-feature-compact-loop` and `compact-feature-cluster-autoscaler`
- `blocked`: still includes the preserved exact compact wait holders
- `aks-feature-compact-loop` is no longer listed as blocked

This satisfies the integrity goal: the root no longer hides pending/running compact work inside blocked metadata only.

## Diagnosis summary

The exact mismatch cause was:

1. compact-loop state truth had pending/running/error residue and active pipeline waits;
2. runtime tree child membership happened to be blocked-only at a repair moment;
3. shared SDK rollup semantics treated `dispatchHeld` alone as enough for blocked stewardship;
4. that incorrectly converted the durable root into `child-blocked` state even though non-terminal residue was still represented/runnable.

The repair was therefore:

- fix the SDK rollup rule to require true blocked-only stewardship, then
- rerun rollup repair so the runtime task tree settles to the truthful root state.

## Remaining unrelated issue

`bun run task-tree repair-rollups` also reopened `aks-spec-verification-loop` during this pass. That is a separate durable-loop reconciliation and not part of the compact-loop integrity defect itself.
