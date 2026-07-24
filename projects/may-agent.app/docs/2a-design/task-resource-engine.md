# Task Resource Engine

**Design status:** Accepted.
**Implementation status:** Core reconciliation implemented; pending-event
outbox, exact escalation continuation, and full pressure/drain guarantees
remain partial.

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

## Keyed runtime contract

The execution key is `(appId, taskId)`. The controller serializes one current
attempt for that key while allowing unrelated keys to run concurrently. Every
wake follows the same path:

```text
persist event or task change
  -> correlate to stable task key
  -> enqueue key as an in-memory hint
  -> reread and claim current generation
  -> run one bounded workflow or owner attempt
  -> admit result and pending event intents atomically
  -> dispatch events or wait on Conditions
```

The persisted task, trigger, and Condition state make a queue hint recoverable;
the queue itself does not become another authority. Delivery is therefore
at-least-once around restart boundaries. Duplicate wakes are expected and
deduplicated by key, while stale claims and results are rejected by generation,
resource version, and attempt identity.

## Authority

| Surface                   | Authority                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `.state/tasks/state.json` | Sole mutable authority for task resources, Conditions, attempts, triggers, receipts, pending event intents, and structural groups. |
| `.state/tasks/tree.json`  | Generated disposable projection for people, agents, UI, and queries.                                                               |
| `tasks/seed.json`         | Boot-only desired state for a new app.                                                                                             |
| `project.json`            | Authored app/project configuration.                                                                                                |
| HTTP, UI, and query views | Derived read models.                                                                                                               |

The runtime never restores canonical state from `tree.json`, and generic task
operations never rewrite `project.json`. Read models may be regenerated at any
time.

### Generated task projection

`tree.json` explains current work; it is not a copy of canonical history. Its
stable content is intentionally small:

- projected structural groups and live tasks;
- each task's current summary, evidence, attempt count, and active attempt;
- current Conditions;
- active task IDs; and
- satisfaction facts only for dependencies referenced by live tasks.

Full resources, historical attempts, triggers, and receipt payloads remain in
canonical state and are omitted from the projection. Consumers that need
recovery or audit history must read the appropriate canonical or trace surface,
not infer it from `tree.json`.

## Task resource

Each executable task has:

- `metadata.id`: stable identity;
- `metadata.generation`: execution-relevant desired-state revision;
- `metadata.resourceVersion`: revision of that task resource;
- `spec`: outcome, acceptance, mode, owner/workflow binding, input, outputs,
  dependencies, containment, priority, and category; and
- `status`: observed generation, phase, summary, evidence, current attempt,
  and linked Condition IDs.

Attempts, triggers, Conditions, receipts, and pending event intents are
separate durable records.
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
- apply state transitions and pending event intents atomically; and
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

An explicit workflow binding is the selected execution method for that task
generation. An unavailable workflow records `HandlerUnavailable` and moves the
task to `attention`; it is not replaced by direct owner execution. A successful
app reload enqueues the task once after the named workflow resolves again.

An owner or workflow execution that ends without a valid handler decision
records `HandlerExecutionFailed`. It remains in `attention` until fresh
structured runtime evidence proves that the same owner can execute again, such
as a later successful session for that owner. The controller then requeues the
same task generation once. It does not inspect provider error prose, assume
that time alone repaired the runtime, or apply this recovery to a completed but
invalid/rejected handler decision.

A workflow may return `needs-owner` explicitly. This is the only automatic
workflow-to-owner handoff, and it creates at most one sequential owner attempt.
Missing, blocked, thrown, timed-out, and invalid workflows do not imply
handoff.

`needs-owner` is an exception to a learned process, not its normal failure
branch. A domain workflow is expected to invoke its owning agent for in-scope
repair and verification before handing the same task back to the owner. Merge
conflicts, failed tests, and rejected hypotheses are ordinary domain feedback.
They become `needs-owner` only after the workflow has exhausted its bounded,
safe in-scope moves. Work that requires another owner is an explicit
escalation, not `needs-owner`.

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
- app/project id aliases may normalize to that same app root during admission;
- mode defaults to `achieve`;
- priority defaults to `P2`;
- outputs default to an empty list; and
- the desired result field is `outcome`.

`needs-owner` is valid only from a workflow. A resolved owner returns
`converged` or `waiting`. Waiting requires at least one exact typed Condition
or one live direct child after the result actions are admitted. Conditions are
invalid on other results.

When a completed carrier creates a successor wait task, the carrier still
returns `converged` without top-level Conditions. The external wake belongs to
the successor task's desired work and will become that task's Condition when the
successor reconciles.

A thrown exception, timeout, unavailable runtime, invalid envelope, rejected
action batch, or verifier rejection fails the attempt. `failed` is an attempt
state, not a handler decision.

Action admission remains atomic, but an `unblock-task` action can race normal
reconciliation after the handler reads state. If the named generation is still
current but the target has already moved from `waiting` or `attention` to
`pending`, `running`, or `converged`, the action result is stale rather than an
invalid handler judgment. Release and requeue the calling task from current
state; do not strand it in `attention`. A generation mismatch remains the same
stale-result case, while a missing target without a completion receipt remains
an invalid action.

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

An unresolved explicit owner input (`project.owner.requested` or
`project.comment.created`) remains the primary persisted trigger until the
reconciler emits its correlated owner result. Routine watcher, metric, and
pipeline events may make the same task dirty, but they must not replace that
owner input payload before the owner has processed it. A later owner input may
become primary only while retaining every unresolved owner event reference and
its structured input, so one coalesced owner run can judge every request before
emitting their correlated results.

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

Semantic observations carry the provider's observation time as
`data.observedAt` and, when the provider exposes one, a monotonic
`data.sourceRevision`. Runtime receipt time remains separate. The Condition
tracker must not replace a newer observation with one known to be older;
providers without ordered revisions still rely on exact correlation and
idempotent reconciliation.

### Human Conditions

When an owner agent needs human approval, advice, or action, it creates one
deduplicated escalation and returns `waiting` with an exact Condition for that
escalation's resolved disposition. Infrastructure delivers the request and
correlates the human reply. The resulting semantic event updates the Condition
and enqueues the same task key; no workflow or session remains suspended.

The human disposition becomes trigger evidence for the next attempt. It does
not mutate desired task state or prove task completion until the owner applies
and verifies it. Approval and rejection are resolved outcomes; dismissal does
not satisfy the Condition and moves the task to attention. See
[Escalation](escalation.md).

## Follow-up events

Task-state mutation is atomic inside `state.json`, but the event store is a
separate authority. A result that requires follow-up events therefore writes
stable pending event intents in the same task transaction. Each intent has an
idempotency key derived from its task, generation, attempt, and event identity.

The dispatcher may publish an event more than once across a crash. Event
ingress returns the existing receipt for the same key. After the receipt is
recorded in task state, the pending intent can be removed. Changed dependent
task keys may be enqueued after the state commit because passive resync can
reconstruct those in-memory hints.

Pending events are derived by infrastructure from the admitted transition; they
are not a second workflow result language. Workflows still return the one
result contract above and must not emit their own task-completion claims. Tool
side effects remain subject to ordinary idempotency and verification.

## Paths and output admission

Infrastructure resolves `appDir`, `projectDir`, and `workspaceDir` before
invoking a handler. Declared outputs are resolved once and admitted only inside
the app and domain roots.

`workspaceDir` normally equals `projectDir`. When the selected workflow exports
`workspace = "task"`, infrastructure prepares and reuses a task-generation Git
worktree from the app workspace branch before handler execution. A workflow
that intentionally integrates elsewhere may instead export
`workspace = { kind: "task", baseBranch: "main" }`; the runtime uses that exact
branch as the worktree base. Workspace lineage is observed attempt and receipt
metadata; it is not desired task spec or a second scheduling record.
The workflow runtime supplies the same directory to nested agent tools as their
actual execution root.

Output admission validates the task contract; it is not a filesystem sandbox.
Tool policy and process isolation still constrain actual writes.

## Phases and modes

- `pending`: current desired state still needs reconciliation;
- `running`: one current attempt owns the generation;
- `waiting`: exact Conditions remain open;
- `attention`: workflow execution, owner recovery, or result admission could
  not produce an applicable result; it is a process-recovery state, not an
  ordinary domain outcome; and
- `converged`: a `maintain` task currently satisfies desired state.

`achieve` is finite. On convergence the engine atomically applies actions,
writes a compact receipt, removes the task from the live graph, and enqueues
dependents.

`maintain` is standing desired state. It remains live after convergence and may
be woken by a later event or resync. Loops are ordinary maintain tasks. Focus
plans and bounded work are normally achieve tasks.

## Parents, dependencies, and completion

An executable parent expresses decomposition and aggregate ownership. A
structural group expresses containment only. Dependencies express ordering.
None of them creates a second scheduler: the same app controller still queues
and reconciles task IDs.

A parent may break a large goal into independently runnable child tasks:

```text
parent reconciliation
  -> return waiting + create child actions
  -> admit parent wait and children atomically
  -> enqueue child IDs in the same app controller
  -> run children concurrently within app capacity
  -> meaningful child transition records a trigger for the parent
  -> enqueue and reconcile the same parent ID
  -> parent refills, repairs, or accepts the aggregate result
```

The parent does not occupy execution capacity while waiting. The runtime
derives readiness from live direct children; handlers do not author
`project.task.reconciled` Conditions or app-specific refill routes. A child
convergence or transition to `attention` is meaningful. Ordinary running or
timestamp changes do not wake the parent.

Only live direct children count as the parent's in-flight decomposition.
Related tasks elsewhere in the graph may be useful evidence, but they do not
keep this parent waiting or occupy its child frontier.

The child transition and parent trigger commit in the same task-state
transaction. The in-memory queue hint follows that commit and passive resync
can reconstruct it. When several children change together, key deduplication
collapses their wakes and the parent rereads all current children and receipts.

- Every live `parentId` resolves to a live task resource or structural group.
- Missing parents, self-parenting, and cycles are rejected.
- Structural groups are passive and are never enqueued.
- A meaningful child transition wakes its executable parent by convention.
- Child status does not automatically determine parent completion.
- A parent receives bounded current child status and completion receipts in its
  reconciliation context.
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

Recovery uses the same task resource and the same app controller:

1. retry a known transient delivery or execution failure within its bound;
2. repair stale leases, attempts, or other mechanical state;
3. requeue the same persisted task ID;
4. move the task to `attention` when progress requires domain judgment;
5. wake the accountable owner once with accumulated, deduplicated evidence;
6. escalate only when the next action crosses an ownership boundary.

Execution recovery is evidence gated. `HandlerExecutionFailed` means the
selected handler produced no applicable decision because its execution did not
complete. A later successful session for the same owner is sufficient evidence
to retry that task once through the ordinary controller. A schema-invalid
decision, rejected action, failed acceptance check, or workspace admission
failure is a different `handler-blocked` condition and is not released by
unrelated runtime success.

The ladder begins after the domain workflow has performed its normal work.
Expected domain failures stay inside the task's reconciliation loop: collect
current evidence, let the agent choose a changed repair, verify it, and repeat
within a bound. Recovery must not blindly rerun an unchanged deterministic
failure, and it must not convert ordinary domain difficulty into attention.

Watchdogs and metrics may detect that this ladder is needed. They do not create
a replacement task, change desired state, or run an app-specific recovery
planner. Equivalent signals attach to the existing task/attempt/alert context
and are coalesced before an owner is woken.

Backpressure is mechanical. Global and per-app concurrency bounds limit new
attempts; excess durable work remains pending instead of starting unlimited
agent sessions. One app must not monopolize all runtime capacity. Pressure may
delay execution, but it must not discard canonical task state or fabricate
completion.

Shared capacity is acquired before an app removes a task key from its local
queue. A capacity-starved app keeps at most one shared-capacity waiter, so its
local running slots remain truthful and a later front promotion can still be
chosen when capacity becomes available. Releasing one shared slot grants one
app another choice from its current queue; it does not reserve that slot for an
older task key selected while capacity was unavailable.

Front promotion is an urgent FIFO lane, not a LIFO stack. Targeted wakes and
newly admitted dependent work run before ordinary queued work, while later
front promotions do not continually overtake an earlier promoted key.

On pause or shutdown, the controller stops claiming new keys, allows a bounded
drain period, and records unfinished attempts as interrupted before exit when
possible. Restart recovery rereads canonical state and requeues the same task
keys; it does not resume an in-memory workflow stack.

On app or workflow hot reload, the replacement controller may collect durable
wake hints immediately but does not claim them until the prior controller's
active attempts have drained. Successive reloads inherit the same drain gate,
so they cannot stack independent worker pools for one app.

Pausing and resuming are explicit control operations. A paused app has no task
controller, schedules, event routing, recovery, or resync. Lifecycle changes
go through `setProjectLifecycle(config, next, reason)` and are journaled;
ordinary task saves cannot change lifecycle.

## Required invariants

Tests and live audits must prove:

1. `state.json` is the only mutable task authority;
2. events, Conditions, and resync enqueue IDs without rewriting desired spec;
3. a stale reader claims the current canonical spec;
4. Condition status and trigger persistence are atomic, and a known-older
   observation cannot replace newer Condition state;
5. at most one current attempt exists per task;
6. the model schema and runtime admission contract are identical;
7. stale results and invalid action batches apply no partial mutation;
8. completion receipts contain `acceptanceBasis`;
9. parents and declared outputs pass admission boundaries; and
10. direct or Gym execution works without attaching this task runtime;
11. recovery reuses the same task identity and cannot invent desired state;
12. equivalent recovery signals produce at most one pending owner wake;
13. result state and pending event intents commit together, and repeated dispatch
    returns one semantic event receipt; and
14. pressure and restart never create an additional attempt for the same key;
15. parent waiting and child creation apply atomically; and
16. a meaningful child transition durably wakes the same executable parent
    without an app-specific route.
