# Task Reconciler Authoring

A Task reconciler performs one bounded attempt and proposes a result. The App
owns the outcome; the Host owns scheduling, fencing, persistence and recovery.
Start with the [SDK Quickstart](sdk-quickstart.md) and its checked App declaration.

## Select the execution

`workflow: "handle-request"` resolves
`agents/<selected-agent>/workflows/handle-request.ts`. A Task without a workflow
or named executor uses its explicit or inherited agent. See
[execution selection](../2a-design/task-resource-engine.md#selecting-the-attempt-mechanism)
for unavailable bindings, blocked workflows and same-Task recovery.

A workflow can call bounded agents and nested workflows with supplied
capabilities. It must not mutate Task storage, acknowledge transport delivery,
or implement controller retries.

## Return evidence and an exact outcome

Use the SDK's `TaskReconcileResult`, `TaskAction`, `Condition` and
`TaskAppDependency` types. The
[Task result contract](../2a-design/task-resource-engine.md#result-contract)
owns their disposition; do not maintain a second result schema here.

- `converged` claims the current acceptance criteria are satisfied.
- `waiting` needs an exact external Condition or live child/dependency.
- `needs-agent` requests exceptional bounded judgment from the same App's
  selected agent; it does not transfer ownership.

The [checked `waitingResult`](../examples/app.ts) illustrates an exact fact contract,
canonical owner and five-minute review interval. Replace its illustrative
pipeline identity with your actual producer and route. New waits require
`owner` and `reviewAfterMs`; the minimum interval is 60 seconds.

An unchanged wait preserves its future deadline. A due review may renew it after
reevaluation, and elapsed time alone never satisfies it. See
[Conditions](../2a-design/task-resource-engine.md#conditions) for the complete rule.

## Task changes and safety

Task changes create, update, close, or unblock task resources. The SDK field
and type remain `actions` and `TaskAction` during compatibility migration.
Updates use
`expectedGeneration`; the reconciler checks generation and resource version,
then commits task state, receipts, Conditions, and dependent wakeups atomically.

An executable parent owns decomposition and aggregate acceptance. It may return
`waiting` while creating direct child tasks. Those children run as independent
keys in the same app controller and do not hold the parent's worker slot. Child
convergence or attention durably wakes the parent, which rereads bounded live
child state and completion receipts before refilling, repairing, or accepting
the aggregate result. Do not author task-lifecycle Conditions or an app-local
refill event for this path.

Count only direct children as the parent's in-flight work. A related task under
another parent is evidence, not a child representation.

Parent status does not automatically follow child status. The parent still
decides whether its own acceptance is satisfied. Use `dependsOn` for ordering,
exact Conditions for facts outside the task graph, and a structural group when
a node has no independently reconcilable outcome. An achieve task cannot close
while it still contains live child tasks.

A running handler must not close or unblock its own task. It may return one
`update-task` change for that task only when current evidence proves the
desired execution intent itself must change; that change must be the sole
change, advance the generation, finish the current attempt, and queue the same
task again. A no-op or mixed self-update is rejected. Broad reprioritization,
duplicate cleanup, and unrelated-branch changes belong to a bounded App task
with an explicit outcome.

Resolver observations and admitted task changes use the same fenced mutation
path. Task ID prefixes carry no authority semantics; add a pure App
`validateAction` rule only when the domain requires a stricter mutation
boundary.

App UI actions declare an input schema and a pure `toInput` translation in
`app.actions`. Infrastructure validates the action and durably admits the
resulting App input. Do not add another action lifecycle or event router.

Validate with the app's `bun run check` and runtime reconciliation tests.

## Review checklist

- Does each durable input map to or wake the correct Task?
- Does the attempt return structured evidence through the shared result contract?
- Does each wait name an external fact, accountable owner and recovery review?
- Can recovery continue the same Task without an App-local scheduler?
- Are storage and result authority retained by the Host?

A **Host handler** is a different role: a small internal adapter for observation,
translation or maintenance. It is not an App reconciler. Its boundary is
[Host-private maintenance](../2a-design/sdk.md#host-private-maintenance-is-not-an-sdk-extension).
