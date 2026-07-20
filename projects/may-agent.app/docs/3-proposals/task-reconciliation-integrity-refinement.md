# Task Reconciliation Integrity Refinement

**Design status:** Historical; accepted and incorporated into
[Task Resource Engine](../2a-design/task-tree-engine.md).
**Implementation status:** Implemented, migrated, deployed, and live-verified.

This record explains why the task engine's integrity boundary was tightened.
It is not a second current task design. The Tier-2 task engine document is the
authoritative contract.

## Decision

The accepted refinement established these rules:

1. `.state/tasks/state.json` is the sole mutable task authority;
   `.state/tasks/tree.json` is a disposable projection.
2. Events, Conditions, and passive resync enqueue stable task IDs. They never
   submit a copied task spec to the worker.
3. A worker atomically re-reads and claims the current canonical spec and
   trigger by task ID.
4. Condition satisfaction and trigger persistence occur in one transaction
   before enqueue.
5. One SDK-owned executable schema governs model output, workflow output,
   tests, and runtime admission.
6. A completion receipt records deterministic, workflow-contract, or
   owner-judgment acceptance rather than implying that admission proved the
   domain claim.
7. Owners resolve to runnable agents. Human and external waits use Conditions
   plus notification or escalation; `human` is not a worker identity.
8. Task generation tracks execution-relevant desired state. Organization-only
   changes use resource version unless they change effective ownership.
9. Paths are resolved once and declared outputs are admitted against explicit
   roots.
10. Live parents must exist; finite work leaves the live graph through one
    receipt transaction.

## Problems resolved

The pre-refinement implementation allowed several integrity failures:

- app-local output schemas could drift from production admission;
- an unrunnable owner such as `human` could be treated as an agent;
- receipts did not explain how acceptance was established;
- relative output paths could resolve into unintended nested workspaces;
- projections and app-specific readout repair could compete with canonical
  state; and
- most critically, a worker could read an old intent and resubmit it while
  claiming, overwriting newer desired state.

The Condition tracker also persisted Condition status and task triggers in
separate writes and reconstructed incomplete task intent. A crash or stale
copy could therefore lose the wake reason or erase desired fields such as
category.

## Implemented flow

```text
resolver -> declare/update spec -> enqueue task ID
targeted event -> persist trigger -> enqueue task ID
watcher event -> atomically update Condition + trigger -> enqueue task ID
passive resync -> enqueue runnable task IDs only
worker -> atomically claim current spec + trigger by ID
handler -> admit and atomically apply result or recovery
```

The queue is a delivery mechanism, not desired state. The tree is an
observation mechanism, not a scheduler.

## Verification completed

The cutover verified all five Agent Apps—May, AKS, Evaluation, Gym, and Scout—
with:

- no duplicate current attempts;
- no observation-driven spec changes;
- no dangling live parents;
- no legacy receipt `verification` fields;
- no generated `tasks` field in canonical state;
- exact schema/admission parity; and
- a live Scout credential Condition whose exact event was persisted, queued,
  and delivered to the subsequent task attempt.

Historical migration snapshots and journals remain operational evidence. They
are not part of the steady-state design.

## Rejected alternatives

- another scheduler or controller type for loops, focus plans, or one-off work;
- treating the task tree as a dispatch queue;
- allowing watchers or resync to rewrite desired intent;
- retaining `tree.json` bootstrap compatibility;
- using humans as durable worker agents;
- requiring an implicit owner turn after every successful workflow; and
- keeping completed work live as an archive tree.
