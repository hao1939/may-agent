# Task Resource Engine

**Design status:** Accepted.
**Implementation status:** Implemented.

The task resource engine is the optional autonomy attachment for durable app
work. It follows the Kubernetes pattern: an app declares desired state, one
generic controller reconciles observed state toward it, and the task tree is a
read model rather than a scheduler.

See [Agent App Contract](agent-app.md) for the app boundary and the historical
[App Task Reconciliation Model](../archive/decisions/app-task-reconciliation-model.md)
for the decision rationale.

## Mental model

```text
app resolver or admitted task action
  -> declare desired task spec
  -> enqueue stable task ID

accepted targeted wake
  -> persist trigger for an existing task
  -> enqueue stable task ID

Condition observation
  -> atomically persist Condition status and task trigger
  -> enqueue stable task ID

passive resync
  -> enqueue runnable task IDs only

worker
  -> re-read and atomically claim the current canonical task by ID
  -> invoke its workflow or resolved owner
  -> validate and atomically apply one result
```

The queue carries task IDs, never copied specs. A stale queue reader therefore
cannot restore older desired state. Resync repairs delivery; it does not invent
a trigger, rewrite a spec, poll a domain source, or schedule work from the tree
projection.

The compact rule is:

> Apps organize work. Agents decide. Workflows repeat learned processes. The
> controller enforces mechanics. Conditions represent external facts. Read
> models explain canonical state.

## Authority

| Surface                   | Authority                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `.state/tasks/state.json` | Sole mutable authority for task resources, Conditions, attempts, triggers, receipts, and structural groups. |
| `.state/tasks/tree.json`  | Generated disposable projection for people, agents, UI, and queries.                                        |
| `tasks/seed.json`         | Boot-only desired state for a new app.                                                                      |
| `project.json`            | Authored app/project configuration.                                                                         |
| HTTP, UI, and query views | Derived read models.                                                                                        |

The runtime never restores canonical state from `tree.json`, and generic task
operations never rewrite `project.json`. Read models may be regenerated at any
time.

## Task resource

Each executable task has:

- `metadata.id`: stable identity;
- `metadata.generation`: execution-relevant desired-state revision;
- `metadata.resourceVersion`: revision of that task resource;
- `spec`: outcome, acceptance, mode, owner/workflow binding, input, outputs,
  dependencies, containment, priority, and category; and
- `status`: observed generation, phase, summary, evidence, current attempt,
  and linked Condition IDs.

Attempts, triggers, Conditions, and receipts are separate durable records.
Event IDs, timestamps, handler summaries, and current observations are runtime
state; they never become desired task fields.

## One controller per attached app

An app that declares tasks gets one logical level-based controller and one
deduplicating key queue. An app without tasks gets neither. Multiple loops,
focus plans, or one-off tasks are ordinary resources in that same controller;
they do not create controller types or schedulers.

The controller may:

- deduplicate task IDs;
- check dependencies and exact Conditions;
- resolve the accountable owner and optional workflow;
- claim at most one current attempt for a task generation;
- validate handler results and task actions;
- reject stale results;
- apply state transitions atomically; and
- perform bounded delivery and attempt recovery.

It must not:

- interpret task prose;
- decide project strategy, decomposition, or priority;
- contain AKS-, Scout-, Gym-, Evaluation-, or May-specific policy;
- infer external truth from time or Condition age; or
- scan the tree projection as a scheduling queue.

Cron owns time. Watchers own external observation. The controller owns task
mechanics.

## Handler resolution

Ownership resolves by convention:

```text
task.owner
  ?? nearest explicit ancestor owner
  ?? app.owner
```

The resolved owner must be a runnable agent. An unresolved owner moves the task
to `attention` before an attempt is claimed.

If `task.workflow` is present, the runtime resolves that workflow under the
resolved agent. The workflow is reusable experience delegated by that owner.
Without a workflow, the owner handles the task directly.

An unavailable workflow records `HandlerUnavailable` and hands the same task
to its owner sequentially. A workflow may also return `needs-owner` explicitly.
Neither path creates a concurrent second claim or hides the broken binding.

## One executable result contract

The SDK owns the exact model schema and runtime admission contract:

```ts
type HandlerResult =
  | {
      state: "converged" | "waiting";
      summary: string;
      evidence: string[];
      actions?: TaskAction[];
      conditions?: ConditionSpec[];
    }
  | {
      state: "needs-owner";
      summary: string;
      evidence: string[];
    };
```

Unknown fields are rejected. Task actions use the same schema and convention
defaults in model output, authored workflows, tests, and production admission:

- parent defaults to the app root;
- mode defaults to `achieve`;
- priority defaults to `P2`;
- outputs default to an empty list; and
- the desired result field is `outcome`.

`needs-owner` is valid only from a workflow. A resolved owner returns
`converged` or `waiting`. Waiting requires at least one exact typed Condition;
Conditions are invalid on other results.

A thrown exception, timeout, unavailable runtime, invalid envelope, rejected
action batch, or verifier rejection fails the attempt. `failed` is an attempt
state, not a handler decision.

## Acceptance

Mechanical admission proves that a result is safe to apply; it does not prove
the domain claim. Every completed task receipt therefore records an
`acceptanceBasis`:

```ts
type AcceptanceBasis = {
  method: "deterministic" | "workflow-contract" | "owner-judgment";
  verifier?: string;
  evidence: string[];
};
```

- `deterministic`: an optional workflow verifier accepted the postcondition;
- `workflow-contract`: the owner delegated acceptance to the bound reusable
  process; or
- `owner-judgment`: the accountable owner handled or accepted the work.

A verifier runs after handler admission and before the result transaction. A
rejected or invalid verifier fails the attempt and creates no receipt.

## Generation and resource version

Each mutated resource advances its own `resourceVersion`. A task's
`generation` advances only when its normalized execution intent changes:

- outcome and acceptance;
- mode;
- effective owner or workflow binding;
- stable input and declared outputs; or
- dependencies.

Containment, category, and priority are desired organization but do not by
themselves invalidate active work. They change task `resourceVersion`, not
generation. A parent move that changes inherited effective ownership does
change generation.

Triggers, timestamps, attempt summaries, Condition observations, and read
projections never change task generation.

## Conditions and watchers

A Condition describes one exact external observation:

```ts
{
  id: "credential-ready:xhs",
  type: "credential.ready",
  subject: "credential:xhs",
  expected: { field: "state", equals: "ready" }
}
```

A watcher monitors the external source and emits a semantic event. It does not
invoke an agent, know task IDs, or mutate task storage. The generic Condition
tracker matches the event and, in one state transaction:

1. updates Condition status;
2. stores the exact event as each linked task's trigger; and
3. returns the task IDs to enqueue.

The worker later claims the current task spec and that exact trigger together.
A queue hint alone is never treated as the observation.

## Paths and output admission

Infrastructure resolves `appDir`, `projectDir`, and `workspaceDir` before
invoking a handler. Declared outputs are resolved once and admitted only inside
the app and domain roots.

Output admission validates the task contract; it is not a filesystem sandbox.
Tool policy and process isolation still constrain actual writes.

## Phases and modes

- `pending`: current desired state still needs reconciliation;
- `running`: one current attempt owns the generation;
- `waiting`: exact Conditions remain open;
- `attention`: normal workflow/owner recovery could not produce an applicable
  result; and
- `converged`: a `maintain` task currently satisfies desired state.

`achieve` is finite. On convergence the engine atomically applies actions,
writes a compact receipt, removes the task from the live graph, and enqueues
dependents.

`maintain` is standing desired state. It remains live after convergence and may
be woken by a later event or resync. Loops are ordinary maintain tasks. Focus
plans and bounded work are normally achieve tasks.

## Parents, dependencies, and completion

Parents express containment. Dependencies express ordering. Neither creates a
second scheduler.

- Every live `parentId` resolves to a live task resource or structural group.
- Missing parents, self-parenting, and cycles are rejected.
- Parent changes do not wake a parent automatically.
- A parent that must resume declares `dependsOn` or an exact Condition.
- An achieve task cannot be absorbed while it has live children.

Receipts preserve the minimum lineage, deduplication, acceptance, and evidence
needed after finite work leaves the live graph. The engine does not keep an
archive tree. Reusable experience belongs in workflows, skills, tests, design,
and domain evidence.

## Recovery and lifecycle

Stale handler results cannot close a newer generation or a different current
attempt. Interrupted previous-runtime attempts are either safely requeued from
persisted trigger/current evidence or moved to attention; they are never
silently treated as running forever.

Pausing and resuming are explicit control operations. A paused app has no task
controller, schedules, event routing, recovery, or resync. Lifecycle changes
go through `setProjectLifecycle(config, next, reason)` and are journaled;
ordinary task saves cannot change lifecycle.

## Required invariants

Tests and live audits must prove:

1. `state.json` is the only mutable task authority;
2. events, Conditions, and resync enqueue IDs without rewriting desired spec;
3. a stale reader claims the current canonical spec;
4. Condition status and trigger persistence are atomic;
5. at most one current attempt exists per task;
6. the model schema and runtime admission contract are identical;
7. stale results and invalid action batches apply no partial mutation;
8. completion receipts contain `acceptanceBasis`;
9. parents and declared outputs pass admission boundaries; and
10. direct or Gym execution works without attaching this task runtime.
