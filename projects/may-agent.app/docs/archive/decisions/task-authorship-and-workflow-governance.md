# Task Authorship Convention

**Historical context:** [Task Resource Engine](../../2a-design/task-resource-engine.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Not adopted; superseded by the uniform fenced-authoring rule
**Scope:** Who may create or change executable task specifications
**Aligns with:** [Task Resource Engine](../../2a-design/task-resource-engine.md),
[Agent App](../../2a-design/agent-app.md),
[Projects](../../2a-design/projects.md), and
[Workflows](../../2a-design/workflows.md)

## Summary

> Historical alternative. The persisted `managedBy` field and task-retirement
> lifecycle proposed below were not adopted. The current contract keeps one
> task specification and one reconciler: pure resolver observations and fenced
> owner actions may both revise it, and Apps use `validateAction` only for
> narrower domain policy. See
> [Task Resource Engine](../../2a-design/task-resource-engine.md).

The alternative was rejected because it adds a second lifecycle distinction,
requires ambiguous persisted-state migration, conflicts with the accepted
single-action self-update rule, and does not remove a storage or controller
authority. Removing the old `runtime/` prefix guard gives every task identity
the same generation-fenced admission semantics without a compatibility reader
or manager-transfer mechanism.

The task engine already has one storage writer: the generic reconciler. What is
not consistently represented is who manages a task's desired specification.

Today an app resolver can materialize a task, while a handler action can update
the same non-`runtime/` task ID. A later resolver event can then restore the app
version. Both writes are mechanically valid, but the task has two competing
authors.

Use one convention:

> A task's specification manager is determined automatically by the path that
> creates it. The reconciler persists and enforces that manager; people and apps
> do not configure it per task.

This keeps one controller, one task schema, and one mutable authority. It adds
one immutable provenance fact, not another workflow or control plane.

## Mental model

Four concepts must remain separate:

| Concept               | Meaning                                                                            |
| --------------------- | ---------------------------------------------------------------------------------- |
| Specification manager | Which layer may declare or revise task meaning                                     |
| Execution owner       | The agent accountable for handling the task                                        |
| Handler               | The direct owner or explicitly bound owner-owned workflow used for this generation |
| Storage writer        | The reconciler that validates and atomically applies every transition              |

The compact rule remains:

> Apps organize known responsibilities. Owners organize novel work. Workflows
> repeat learned processes. Agents provide judgment. The reconciler enforces
> mechanics.

## Convention

Each executable task resource stores one runtime-assigned metadata field:

```ts
type ProjectAppTaskResource = {
  metadata: {
    id: string;
    generation: number;
    resourceVersion: number;
    managedBy: "app" | "owner";
  };
  spec: ProjectAppTaskSpec;
  status: ProjectAppTaskStatus;
};
```

`managedBy` is not an authored option:

- it is absent from resolver intents;
- it is absent from task actions;
- it is absent from ordinary UI mutation;
- the runtime assigns it from the creation path; and
- it is immutable for the task resource's lifetime.

The defaults are complete:

| Creation path                                    | Runtime assignment               |
| ------------------------------------------------ | -------------------------------- |
| `tasks.resolve(event)` materializes a task       | `managedBy: "app"`               |
| Handler `create-task` action creates a task      | `managedBy: "owner"`             |
| Executable task is copied from `tasks/seed.json` | `managedBy: "owner"`             |
| Structural seed group                            | No manager; it is not executable |

An app-managed responsibility should normally be materialized by the resolver,
not individually configured in the seed. The seed remains boot-only
initialization, primarily for structural groups and initial owner-organized
work.

`managedBy: "owner"` names the owner/action layer. It is not the same as
`spec.owner`, which selects the task's execution owner.

## App-managed tasks

An app-managed task is a known event-correlated responsibility.

Examples include a scheduled observer, source exploration carrier, owner-review
carrier, or known callback watcher.

Rules:

- only resolver observation may create or revise its specification;
- the resolver remains pure, cheap, deterministic, and returns zero or one
  stable intent per event;
- a handler may reconcile the task, return evidence, establish Conditions, and
  create owner-managed follow-up work;
- task actions may not update, close, unblock, or rebind the app-managed task;
- an achieve task may complete through its own admitted terminal result;
- a maintain task remains stable across ordinary wakes; and
- the task still has an execution owner even when its workflow is deterministic.

Changing app source without another accepted resolver observation does not
rewrite live task state.

## Owner-managed tasks

An owner-managed task is project work created through an admitted task action
or copied from the boot seed.

Examples include implementation, investigation, repair, migration,
verification, documentation, and workflow-authoring work.

Rules:

- admitted owner-layer actions may create, update, close, unblock, split,
  replace, or rebind owner-managed work;
- `expectedGeneration` rejects stale changes;
- a running handler may not mutate or close its own task through an action;
- its terminal result owns the current task transition;
- a newly discovered shape becomes a successor or sibling task; and
- human steering enters through a typed event and the same owner/action path.

An admitted action is attributable to the resolved owner and handler of the
current attempt. The reconciler applies it but does not become its author.

## Collision and mutation rules

The runtime rejects the whole action or observation atomically when:

- a resolver encounters an owner-managed task with the same ID;
- a task action targets an app-managed task;
- a running task action targets its own task;
- an update uses a stale generation;
- a workflow binding is unavailable or ambiguous; or
- human/UI input attempts to bypass the event and owner/action path.

An authorship collision produces a visible integrity event and attention for
the triggering signal. The runtime never selects the last writer.

Task IDs describe identity, not management. After migration, `runtime/` has no
special authority semantics and the prefix-only mutation guard is removed.

## App-managed task retirement

Removing a schedule or resolver branch is not enough to retire a live maintain
task. Retirement must be an explicit app-authored desired-state operation.

Extend resolver output with one narrow absent intent:

```ts
type ProjectAppTaskResolution =
  | ProjectAppTaskIntent
  | {
      id: string;
      desired: "absent";
      reason: string;
    }
  | null;
```

The reconciler accepts this only for an app-managed task. It rejects retirement
while the task has a running attempt, live child, or live dependency reference.
When admitted, it removes the task resource and current projection and emits a
retirement observation with the reason. Retirement is not task completion and
does not create a completion receipt.

The app must emit or receive an explicit semantic event that resolves to the
absent intent. Code deletion by itself never mutates runtime state.

## Human direction

Human authority does not mean direct task-file mutation:

```text
human input
  -> typed project event
  -> existing owner-review or targeted task wake
  -> accountable owner judgment
  -> admitted task actions, exact Condition, or evidence-backed no-op
```

Approval may satisfy an exact Condition. Novel decomposition remains owner
judgment and never moves into the generic reconciler.

## Workflow governance

Only the minimum governance rule belongs here:

- every workflow belongs to one agent;
- a workflow is reusable process, not task authority;
- app-managed workflow binding changes come from the resolver;
- owner-managed binding changes come from an admitted owner action;
- binding changes advance task generation;
- missing workflows move to attention without silent direct-owner fallback;
- workflow creation or improvement is finite owner-managed project work with
  tests and later evidence; and
- repeated work is a promotion signal, never automatic workflow creation.

Workflow discovery, execution, provenance, validation, and retirement remain
owned by [Workflows](../../2a-design/workflows.md). This proposal does not create a
second workflow lifecycle or registry.

## `needs-owner`

The governance rule remains small:

- only a workflow may return `needs-owner`;
- it means the accountable owner has not yet decided;
- it causes at most one sequential handoff to the resolved owner; and
- workflow failure, timeout, blocking, or unavailability does not imply
  handoff.

Whether the current failed-attempt/attention persistence should become a
completed workflow disposition is an independent attempt-model refinement. It
must not be coupled to specification-management migration in this proposal.

## Read models

The generated tree and WebUI may show:

- `managedBy`;
- execution owner;
- selected handler and workflow;
- acceptance basis; and
- an authorship collision or app retirement observation.

These are projections. They never become mutation authority.

## Migration

Do not keep a permanent inference or compatibility path.

1. Audit live executable resources in each task-enabled app.
2. Mark resolver-materialized responsibilities as `app` and handler/seed work
   as `owner` in one explicit state migration.
3. Add automatic assignment for all new resources.
4. Add app-managed absent-intent retirement.
5. Enforce collision and mutation admission.
6. Remove the prefix-only `runtime/` guard and all migration inference.
7. Expose the persisted manager in read models.

The migration must be completed before strict admission is enabled. Ambiguous
resources stop migration and require an explicit decision; they are not guessed
from their names.

## Tests

Required focused tests:

- resolver creation assigns app management;
- handler creation and executable seed initialization assign owner management;
- structural groups have no manager;
- manager assignment cannot be supplied or changed by task input;
- resolver may revise an app-managed task;
- owner action may revise an owner-managed task;
- cross-manager collisions and mutations are rejected atomically;
- self-mutation remains rejected;
- app retirement requires an explicit absent intent and no live references;
- ordinary source removal does not retire live state;
- binding changes still advance generation; and
- direct and Gym agent execution remain independent of task infrastructure.

## Acceptance criteria

This proposal is complete when:

- every executable task has exactly one automatically assigned immutable
  manager;
- resolver and owner-action paths cannot silently overwrite one another;
- seed behavior remains boot-only and requires no per-task authority setting;
- app-managed retirement is explicit and event-driven;
- execution owner and specification manager are visibly distinct;
- the reconciler remains the only task-storage writer and contains no project
  strategy;
- workflow governance remains in the existing workflow design; and
- no prefix inference, authority transfer, second controller, or compatibility
  writer remains.

## Non-goals

This proposal does not:

- add configurable per-task authority;
- support manager transfer during a task's lifetime;
- add another task type, controller, queue, or storage authority;
- let the UI edit canonical task state directly;
- redesign workflow execution or promotion; or
- change `needs-owner` attempt persistence.

## Recommended decision

Approve the automatic authorship convention and explicit app-retirement path.
Keep the persisted manager as one immutable runtime-assigned provenance field,
not user configuration. Move detailed workflow lifecycle and `needs-owner`
persistence work to their existing design surfaces and implement them
independently.
