# Task Resource Engine

**Design status:** Accepted.
**Implementation status:** Core engine implemented; canonical seed/live-state
migration and compatibility removal remain.

The task engine implements the state side of the
[App Task Reconciliation Model](../3-proposals/app-task-reconciliation-model.md).
It is not a scheduler.

## Resource shape

Each executable task has:

- metadata: identity, generation, and resource version;
- spec: outcome, acceptance, mode, owner/workflow binding, inputs, outputs,
  dependencies, and priority; and
- status: observed generation, phase, summary, evidence, current attempt, and
  linked Condition identities.

Attempts are separate durable records. They contain handler/runtime identity,
start/end state, trigger provenance, and the task generation/spec hash they
claim. Runtime mechanics do not become desired task fields.

## Reconciliation transaction

```text
observe intent
  -> compare spec hash
  -> increment generation only when desired state changed
  -> claim one attempt with generation + resourceVersion CAS
  -> invoke workflow or owner
  -> validate result batch
  -> reject stale claim, or atomically apply result + end attempt
```

Two concurrent wakes may enqueue the same key, but the queue deduplicates them
and the claim check prevents two current attempts for one generation.

## Phases

- `pending` — desired state has not been observed by a successful attempt.
- `running` — one current attempt owns the generation.
- `waiting` — exact Conditions remain open.
- `attention` — the workflow and/or owner could not produce a valid result.
- `converged` — a maintain task currently satisfies desired state.

Legacy task state names are presentation concerns, not alternate authorities.

## Modes

`achieve` describes a finite outcome. On convergence, the engine:

1. validates and applies result actions;
2. records a compact completion receipt;
3. finds dependent tasks;
4. removes the achieved task/resource/trigger from the live graph; and
5. enqueues created and dependent task keys.

`maintain` describes standing desired state. It remains in the graph after
convergence and can be reconciled by later events or resync.

## Conditions

A Condition is typed desired observation:

```ts
{
  id: string;
  type: string;       // event type
  subject: string;    // typed exact identity, e.g. task:x or runId:42
  expected: unknown;
  owner?: string;
}
```

The engine stores Condition generation/resource version and observed state.
A separate app or infrastructure watcher emits semantic observations. The generic Condition
tracker correlates matching events, marks the Condition true, and enqueues every
linked task. Task resync never polls the domain source or treats age as truth;
watchers own refresh and replay of external state.

Blocked holder tasks and polling jobs are not Condition substitutes.

## Actions

The reconciler is the only task mutation authority. Handlers return a maximum
bounded batch of create/update/close/unblock actions with evidence. Updates use
expected revisions. The whole batch validates before any mutation.

Created tasks carry their input/dependencies into stored intent and enter the
same app controller immediately. There is no assignment outbox, reviewer
pipeline, or task-tree dispatch queue.

## Parent and relationship semantics

Parents organize containment and communicate decomposition. Dependencies
express desired ordering. Neither one creates a second scheduler.

The controller never enqueues a parent merely because a child changed. A
parent that must resume after a child uses `dependsOn` or a typed Condition. An
`achieve` parent is not absorbed while it still has live children; its handler
must keep the reconciliation open through those explicit relationships.

Parent counts, progress, and health are derived projections. A parent that has
children is not automatically an executable resource unless it also declares
its own maintain responsibility.

## Finished work and experience

Completion receipts retain the minimum facts needed for dependency wakeup,
deduplication, audit, and later learning: identity/generation/spec hash,
outcome, acceptance, owner/workflow, summary, evidence, and completion time.

The engine does not maintain an archive tree. Reusable experience belongs in
workflows, skills, tests, design, and domain evidence. Keeping every finished
node live makes current state harder to understand without improving future
execution.

## Storage and lifecycle

`.state/tasks/state.json` is the sole mutable authority. It stores task
resources, Conditions, attempts, receipts, and structural groups.
`.state/tasks/tree.json` is a generated read projection and is never read back
as mutation input once canonical state exists. `tasks/seed.json` may initialize
a new app once and must use the same canonical `resources`/`groups` shape; the
retired `tasks/tree.json` path is not a runtime source.

All writes are locked, validated, normalized, and atomically renamed. An app
with `project_lifecycle: "paused"` has no installed controller, schedules,
event routing, recovery, or resync.

Pause and resume are explicit control operations, not conclusions inferred from
the amount of open work. Call `setProjectLifecycle(config, next, reason)`; the
store rejects any ordinary save that changes lifecycle without a reason and
journals every accepted transition. Pausing one app does not require stopping
the May daemon or other apps.
