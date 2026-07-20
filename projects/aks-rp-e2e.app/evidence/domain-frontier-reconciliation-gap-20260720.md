# Diagnostic: Domain Frontier Reconciliation Gap

Date: 2026-07-20

## Summary

The AKS scenario-test normalization goal is not stalled because the domain goal
is unclear. It is stalled because the current app loop does not directly
reconcile the domain frontier resource when strict scenario-test inventory is
red.

The app currently relies on `runtime/owner-review` to notice the strict
inventory gap and create new `domain/*` leaves. That indirection is fragile. A
stale or long-running owner-review attempt can block fresh domain refill even
when the domain resource still has unmet acceptance criteria.

This is not a failure of the Kubernetes-style model. It is primarily an app
modeling error, plus one generic runtime boundedness defect:

- the app observed a concrete domain level but routed it through a broad
  singleton owner-review resource instead of the resource that owns that
  desired state; and
- direct owner-handler sessions had no conventional timeout, so one attempt
  could violate the bounded-reconciliation invariant.

The existing per-app work queue already preserves a wake received while the
same task is running as one dirty requeue. No second controller or special
frontier scheduler is required.

## Current Evidence

Strict scenario-test inventory is still red:

```json
{
  "activeSpecCount": 665,
  "referencedPlainActiveSpecCount": 609,
  "referencedScenarioWithAdapterCount": 600,
  "directVitestImplementationCount": 56,
  "missingAdapterFiles": [
    "features/azure-keyvault-secrets-provider/tests/azure-keyvault-secrets-provider-vm-prerelease-dual-pool.test.ts",
    "features/rp-regional-quota/tests/rp-regional-quota-public-create-path.test.ts",
    "features/serverless/tests/serverless-virtual-nodes-multi-pod-burst.test.ts",
    "features/upgrade/tests/upgrade-vm-prerelease-deprecated-api-detection.test.ts",
    "features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction-live.test.ts"
  ]
}
```

The normalization subtree under
`domain/normalize-scenario-tests-repo-frontier-20260715` is underfilled:

```json
{
  "descendantCount": 6,
  "buckets": {
    "review/attention": 5,
    "blocked/waiting": 1
  }
}
```

There are currently no active `domain/*` normalization leaves under that
frontier, even though the parent goal explicitly requires keeping 3-5 concrete
one-spec leaves active or runnable.

`runtime/owner-review` is running with stale evidence:

```json
{
  "phase": "running",
  "observedGeneration": 150,
  "generation": 151,
  "runningAttempt": "r_151_0263a591-96f0-4e11-b7f0-5c587d10d020",
  "startedAt": "2026-07-20T04:19:00.209Z",
  "triggerReason": "scheduled-active-frontier-refill-review"
}
```

Its summary still says there were 2 active domain leaves and that adding more
domain work would duplicate existing work. That evidence became stale after the
two active leaves converged. The current subtree has zero active domain leaves.

## What Failed

The desired domain state exists:

```text
domain/normalize-scenario-tests-repo-frontier-20260715
  -> normalize every active spec until strict scenario-test inventory is clean
  -> keep 3-5 concrete one-spec leaves active or runnable
```

But the wake/refill path is currently:

```text
strict inventory still red
  -> project.owner.requested
  -> runtime/owner-review
  -> app-ops may create domain leaves
```

That means a broad app-ops review task became the bottleneck for a concrete
domain frontier. A fresh strict-inventory signal can be accepted and still fail
to create domain work if `runtime/owner-review` is already running or relying on
stale packet evidence.

## Design Implication

The Kubernetes-style task-resource model is still the right direction:

```text
resource spec = desired state
resource status = observed state
reconciler/owner keeps pushing actual state toward desired state
```

The gap is that this domain resource is too passive. The concrete domain
frontier does not currently have a direct reconciliation path for strict
inventory gaps. Instead, `runtime/owner-review` is acting as an indirect
controller.

That is the wrong shape for this case.

## Specific Misalignments

1. The domain parent task is `maintain`, but it does not directly refill itself
   when its own acceptance evidence is red.

2. `runtime/owner-review` can count stale active leaves and no-op while the
   domain frontier is already drained.

3. Runtime and ops work can distract owner review from the domain capacity
   target. `ops/*`, `runtime/*`, and focus/readout repair tasks should not count
   as normalization frontier capacity.

4. Strict scenario adapter inventory and spec-loop verification are different
   acceptance gates. A related spec-verification task being done, skipped,
   blocked, or terminally dispositioned must not close a missing `.test.ts`
   adapter gap.

5. The current event path wakes a generic owner-review task instead of the
   domain frontier task whose desired state is out of compliance.

## Recommended Fix

Make strict scenario-test inventory reconciliation a direct domain-frontier
path.

Preferred shape:

```text
strict inventory red or periodic domain-frontier pulse
  -> watcher emits aks.scenario-test-inventory.observed
  -> app maps that known fact to a targeted wake for the normalization resource
  -> generic reconciler resolves its existing aks-explorer owner
  -> aks-explorer judgment creates/advances 3-5 concrete one-spec leaves
  -> app reconciler validates and applies task actions
```

The watcher must not know the task ID or the desired 3-5 capacity. It owns only
the external inventory command and semantic observation. The app owns the
stable mapping from that observation to its domain resource. The task spec
remains the single authority for expected capacity and acceptance.

The observer and handler may collect facts mechanically:

- run or read `bun scripts/check-scenario-tests.ts --strict --json`;
- count active/runnable `domain/*` leaves under the normalization frontier;
- identify `missingAdapterFiles` paths without active leaves;
- identify stale review/attention residues that do not satisfy the current
  strict-inventory gap.

It should not decide AKS product correctness. It should ask or use
`aks-explorer` judgment for each concrete leaf.

`strictPassed` must come from the command's strict `guard.passed` result. It
must not be inferred from `missingAdapterFiles`: the current observation has 5
missing adapters, but still has 605 spec-referenced plain scenario units and
676 repository plain scenario files. Those are different subsets of the same
larger normalization frontier.

## Accepted Repair

The scoped repair is:

1. Schedule a deterministic strict-inventory check every 30 minutes as a
   bounded level resync. A five-minute unconditional owner wake would consume
   288 sessions per day and exceed the app's 200-session budget by itself.
2. Have the watcher emit only
   `aks.scenario-test-inventory.observed`, including compact strict counts.
3. Have the AKS app translate that semantic event into
   `project.task.tick` for
   `domain/normalize-scenario-tests-repo-frontier-20260715`.
4. Let the one generic reconciler resolve `aks-explorer`, pass fresh task and
   trigger evidence, and apply only typed returned actions.
5. Apply the runtime's conventional 15-minute timeout to direct owner-handler
   sessions. A wake that arrives during that attempt remains dirty and receives
   one fresh pass after the attempt ends.

One useful generic follow-up remains: when a direct child changes terminal
disposition, enqueue a live `maintain` parent by convention. That is analogous
to a Kubernetes owner-reference watch and would make child transitions the
primary refill signal. The periodic inventory observation should remain a
bounded resync safety net, not become a second scheduler. This follow-up should
be implemented in the generic reconciliation feedback path, not as an AKS-only
controller.

## Near-Term Repair

1. Recover or finish the stale `runtime/owner-review` attempt so fresh owner
   review can run.

2. Wake the normalization parent task directly with the five current missing
   adapter paths.

3. Create or advance concrete `domain/*` leaves for missing adapter paths that
   lack active work, especially:

   - `rp-regional-quota-public-create-path.test.ts`, because strict inventory
     still lists it while the spec-verification task is repeatedly skipped as
     already completed.
   - `serverless-virtual-nodes-multi-pod-burst.test.ts`, because the prior
     adapter work exists mostly in receipts rather than live domain work.
   - `upgrade-vm-prerelease-deprecated-api-detection.test.ts`, same pattern.
   - `virtualmachines-spot-pool-eviction-live.test.ts`, same pattern.

4. Keep the current `azure-keyvault-secrets-provider` review/attention leaf
   visible, but do not count it as active capacity until it is actually moving
   or replaced by a valid successor.

## Acceptance For The Repair

The repair is working when all of these are true:

- strict inventory remains visible as the progress metric;
- the normalization frontier has 3-5 active or runnable concrete `domain/*`
  leaves while missing adapters remain;
- `runtime/owner-review` is no longer the only path that can refill strict
  inventory work;
- stale owner-review attempts cannot prevent a fresh high-priority strict
  inventory wake from producing work;
- each remaining missing adapter is either actively worked, exactly blocked,
  escalated, or terminally dispositioned with evidence.
