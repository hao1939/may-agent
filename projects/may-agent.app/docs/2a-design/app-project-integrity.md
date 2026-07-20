# Agent App integrity contract

**Design status:** Accepted.
**Implementation status:** Implemented by the convention-first Agent App runtime.

An Agent App is healthy when its declared desired state and observed runtime
state converge through one controller path.

## Authority

- `app.ts` owns event correlation, schedules, actions, and the accountable
  owner.
- `.state/tasks/state.json` is the sole mutable task-resource authority.
- `.state/tasks/tree.json` is regenerated from resources and structural groups.
- Workflows preserve reusable processes and return structured results.
- Agents supply adaptive capability and ownership fallback.
- Infrastructure owns event delivery, the app queue, attempts, concurrency,
  persistence, retries, recovery, and stale-result rejection.

Neither workflows nor agents mutate task storage directly.

## Required invariants

1. Each app has one `tasks.accepts` list, one `tasks.resolve` function, and one
   deduplicating work queue.
2. Semantic events create or advance stable desired task identities. Targeted
   task events, Condition observations, and periodic resync enqueue those same
   identities.
3. A workflow is discovered from `workflows/<name>.ts`; an unbound task reaches
   its resolved owner, then the app owner.
4. A task claim records generation, resource version, spec hash, handler, and
   one durable attempt. A stale result cannot mutate newer desired state.
5. Waiting state always names typed Conditions with an observable subject,
   expected value, owner, and optional stale resync interval.
6. Completing an achieve task atomically writes a bounded receipt, removes the
   live resource/projection, and wakes dependents.
7. Maintain tasks stay live after convergence and may be reconciled again by a
   later event or resync.
8. The task graph contains no assignment outbox, worker session binding,
   reviewer queue, mutable archive, or app-specific recovery scheduler.

## Operational checks

- selectors do not route one project's event into another app;
- action dispatch translates each declared action once;
- inbox acknowledgement happens only after accepted handling;
- configured concurrency is enforced by the app controller;
- app loading is atomic, so a failed reload leaves the prior installation
  intact;
- restart recovery, Condition wake/resync, receipt wakeup, and owner fallback
  have focused tests.

The detailed model and migration requirements live in
`../3-proposals/app-task-reconciliation-model.md`.
