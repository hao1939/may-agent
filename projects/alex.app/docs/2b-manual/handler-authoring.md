# Task Reconciler Authoring

**Supports:** [Task Resource Engine](../2a-design/task-resource-engine.md). Shows how to return outcomes and retain waits through shared Task admission.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#convention-over-configuration).

A Task reconciler performs one bounded attempt and proposes a result. The App
owns the outcome; the Host owns scheduling, fencing, persistence and recovery.
Start with the [SDK Quickstart](sdk-quickstart.md) and its checked App declaration.

## Route input and reconcile current state

Use a pure mapper to select existing or desired Task work. Keep investigation,
network effects and acceptance decisions in the reconciler. An event such as
"PR merged" supplies evidence; it does not decide that deployment or the user's
whole request is complete.

Read the current assignment, accepted results, Conditions and pending input
together. Preserve useful completed work, assess what the new information
changes, and return the remaining work or outcome. Reading input is not its
acknowledgment; use the supported executor/result contract. Code may implement
a deterministic reconciler without an agent call.

For simple measurements, exact controls and presentation, use the existing
[resource writers and notification paths](../2a-design/events.md#immediate-reactions).
Create a Task only when it owns work, not merely because an event arrived.

## Select the execution

`workflow: "handle-request"` resolves
`agents/<selected-agent>/workflows/handle-request.ts`. A Task without a workflow
or named executor uses its explicit or inherited agent. See
[execution selection](../2a-design/task-attempts.md#selecting-the-attempt-mechanism)
for unavailable bindings, blocked workflows and same-Task recovery.

A workflow can call bounded agents and nested workflows with supplied
capabilities. It must not mutate Task storage, acknowledge transport delivery,
or implement controller retries.

## Return evidence and an exact outcome

Use the SDK's `TaskReconcileResult`, `TaskAction`, `Condition` and
`TaskAppRequest` types. The
[Task result contract](../2a-design/task-attempts.md#result-contract)
owns their disposition; do not maintain a second result schema here.

Return the existing attempt `state`:

- `converged` accepts the selected inputs under App policy.
- `waiting` yields on saved Conditions or a review deadline; add `continue: true`
  to schedule another attempt for useful independent work.
- `incomplete` retains failure evidence and unfinished work for recovery.
- Workflows can use `needs-agent` for exceptional bounded judgment from the
  Task's responsible agent; it does not transfer ownership.

The [checked `waitingResult`](../examples/app.ts) illustrates an exact fact contract
and canonical owner. Replace its illustrative pipeline identity with your actual
producer and route. Infra observes the fact and recovers missed delivery in code.
An unchanged wait needs no model call or agent-managed polling interval.

Use Task `reviewAt` only when the agent deliberately chooses to reconsider work
at that time. A due deadline is consumed; another waiting result does not renew
it automatically. Keep unrelated Conditions and input deadlines independent.
This authorizes another owner attempt and may spend model tokens. Infra chooses
its separate missed-result recovery interval; the Task result cannot override it.
`reviewAfterMs` is accepted only for compatibility and no longer requests agent
execution. See [Conditions](../2a-design/task-resource-engine.md#conditions) for
the Host revision and rollout order; older Hosts require the legacy field.

## Task changes and safety

Workers use `actions` and `TaskAction` to update or unblock existing Tasks.
Typed `requests` commission work; assigning-owner controls close Tasks.
Updates use
`expectedGeneration`; the reconciler checks generation and resource version,
then commits task state, receipts, Conditions, and dependent wakeups atomically.

An executable parent owns decomposition and aggregate acceptance. Submit a
`request` and a Condition referencing its ID when its answer is needed.
The target App chooses its Task and executor; the Host retains the exact return
link. Those Tasks run independently and do not hold the parent's worker slot.
Read their correlated reports and answers before accepting the aggregate result.
Do not author a task-lifecycle Condition or an App-local refill event for this path.

Use `tasks({action: "apply", changes})`, `attempt.apply(changes)` or workflow
`ctx.applyTaskChanges(changes)` to submit requests while continuing this attempt.
Final results use the same change fields. Return `state: "waiting"` with
`continue: true` for another bounded pass; omit continuation when only results
remain. Existing Conditions survive; neither choice answers the original input
by itself. The proposed `decision` spelling is deferred.

Exact input-return links determine outstanding results. A parent link or a
related Task is not, by itself, a wait or a subscription.

Parent status does not automatically follow child status. The parent still
decides whether its own acceptance is satisfied. Use `dependsOn` for ordering,
exact Conditions for facts outside the task graph, and a structural group when
a node has no independently reconcilable outcome. Closing a parent does not
silently cancel independently owned children.

Use the current attempt to reconsider waits and advance work. Retire an obsolete
Condition with its exact observed generation and a reason. Assignment revision
and closure belong to the assigning owner; request them through normal feedback.
Broad reprioritization,
duplicate cleanup, and unrelated-branch changes belong to a bounded App task
with an explicit outcome.

Resolver observations and admitted task changes use the same fenced mutation
path. Task ID prefixes carry no authority semantics; add a pure App
`validateAction` rule only when the domain requires a stricter mutation
boundary. Keep these validators pure and give a field path plus a minimal valid
example on rejection. The Host can reuse them while a direct Task agent calls
`finish`, then repeat them at settlement; do not perform effects in validation.
See [completion admission](../2a-design/execution-contributions.md).

App UI actions declare an input schema and a pure `toInput` translation in
`app.actions`. Infrastructure validates the action and durably admits the
resulting App input. Do not add another action lifecycle or event router.

Validate with the app's `bun run check` and runtime reconciliation tests.

## Review checklist

- Does each durable input map to or wake the correct Task?
- Does the attempt return structured evidence through the shared result contract?
- Does each wait name an external fact, accountable owner and a real wake route?
- Can recovery continue the same Task without an App-local scheduler?
- Are storage and result authority retained by the Host?

A **Host handler** is a different role: a small internal adapter for observation,
translation or maintenance. It is not an App reconciler. Its boundary is
[Host-private maintenance](../2a-design/sdk.md#host-private-maintenance-is-not-an-sdk-extension).
