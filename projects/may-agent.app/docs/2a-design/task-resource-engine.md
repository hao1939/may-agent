# Task Resource Engine

**Design status:** Accepted.
**Implementation status:** Core reconciliation, generation fencing, Conditions,
parent/child work, indexed parent/dependency relationships, bounded
concurrency, resource-backed Task list/get and opt-in outcome projection,
fenced mid-attempt event emission, and indexed recovery are implemented for
current Apps. The public SDK uses
`agent` for the managed agent selected for bounded attempts. Retained Task
records may still spell that field `owner`; the Host normalizes it at the
storage boundary and does not expose it as Task ownership. Normal Runtime
descriptor construction requires resource authority, and routing and recovery
have no JSON fallback. The generic store/reconciler still compiles retained
JSON support for the guarded offline importer and focused fixtures; separating
and then retiring that compatibility boundary remains open. Condition owner
and review fields are still optional, and current recovery can remove a review
deadline from an unresolved wait; those are convergence gaps.

The task engine is the single Host execution path for App-owned work. Read
[agent-app.md](agent-app.md) first.

## One App work path

The Host stores a request when a caller expects a result. The App does not
reconcile that inbox record directly; it resolves the input to a task and
reconciles the task. The Host completes the correlated request from the
accepted task result. Conversation and presentation adapters observe that
result independently; transport delivery never gates Task completion.

Every actionable App input therefore creates, revises, attaches to, or wakes a
task. A simple task converges on its first bounded attempt and leaves a compact
receipt. The same resource naturally supports repeated reconciliation, exact
waits, decomposition, dependencies, and maintenance without selecting another
work mechanism.

Facts with no owned outcome or desired-state change remain facts and do not
enter the App. Sessions, workflows, analyses, and child App calls are bounded
capabilities used while reconciling a task; none is another App lifecycle.

A fresh admitted App input wakes a waiting Task for one bounded
reconsideration. Existing Conditions remain evidence; the App decides whether
they still apply. This makes human feedback and newly requested work actionable
without turning duplicate ticks or recovery scans into event storms.

A typed cross-App dependency may name an exact `taskId`. Runtime then admits
the input against that existing Task and waits for the same Task lineage. With
no `taskId`, normal App task resolution creates or finds the requested outcome.

## Mental model

```text
App input declares, revises, attaches to, or wakes TaskIntent
  -> Host persists canonical task state
  -> queue receives (appId, taskId)
  -> worker rereads and claims the current generation
  -> one selected handler works until it returns an accepted result or exact wait
  -> Host validates and atomically applies one result
  -> task converges, waits on exact evidence, or becomes visible attention
```

Observers publish facts. The Condition tracker updates only exact Conditions
still owned by waiting/running tasks and wakes those task IDs. Events are the
normal trigger. Indexed startup, due, expired-lease, and safety queries repair
a lost in-memory wake without scanning an App tree.

The queue is an in-memory hint. The persisted task, trigger, Condition, and
attempt state are sufficient to recover it.

## One attempt interface

Executor choice does not change Task semantics. A Task may use its App's
default agent executor, name a workflow, or select a registered executor;
`codex` and `claude` are the built-in native adapters. `workflow` and
`executor` are mutually exclusive; omitting both means the default agent.

The executor extension boundary is deliberately small:

```ts
type TaskExecutor = (attempt: TaskAttempt) => Promise<TaskReconcileResult>;
```

`TaskAttempt` supplies the exact App and attempt identities, cancellation
signal, resolved role, current `TaskDetail`, working/output paths, direct child
and wait views, ordered unaccepted Events, result schema, and the fenced
`publish`/`onEvent` capabilities. The SDK owns this type; transport adapters
may project it to JSON but must not define a narrower semantic contract.

An executor reads current Task state and its bounded unobserved event batch,
keeps working while safe progress is available, optionally publishes retry-safe
progress or findings, and returns only when it has one accepted result or an
exact external wait. Internal model turns are not Task attempts. `onEvent` is
an optional low-latency view of new durable Task input such as feedback,
approval, steering, or cancellation.
The listener's attempt-local `accept` consumes the exact input only with an
admitted result; the next attempt still receives it if the executor cannot
incorporate it live. Before the result can publish a dependency, merge a task
workspace, apply task actions, or move the Task to attention, the Runtime
checks again for newer unaccepted Task input. If any exists, it applies no
effect and immediately retries from that evidence. The Runtime owns fencing,
leases, event persistence, result admission, and recovery, so an executor
implements no scheduler, queue, retry loop, or Task storage.

`signal` stops only the current execution resources. Runtime aborts it after
the durable Task cancellation names that exact attempt. Adapters translate the
same signal into managed-session cancellation, workflow-step cancellation,
Codex turn interruption, or CLI process-tree termination. The signal never
replaces the terminal Task cancellation or its result-admission fence.

Every adapter receives the same bounded Task detail and ordered event batch,
may publish a fact through the current generation/attempt fence, and returns
one `TaskReconcileResult`. An event addressed to `{ appId, taskId }` is durable
feedback, approval, or steering for that Task. Live forwarding is optional:
managed sessions support it, while a headless CLI that cannot accept a live
message receives the event on the next attempt.

Runtime creates one fenced attempt and gives it to the selected adapter.
Omitted or `agent` selects the managed-agent adapter. For another name, a Host
registration takes precedence over the built-in `codex` and `claude` adapters.
A missing name becomes attention. Selection never creates another scheduler or
recovery system.

Codex/Claude process records, native session IDs, prompts, and output files are
attempt evidence only. They do not create another Task, retry policy, queue, or
completion authority. The Host accepts their result only through the same
generation-fenced Task result transaction.

## Task and task view

A task is the resource. It has one stable `(appId, taskId)` identity, desired
outcome, current observation, and acceptance evidence.

Tasks may name a parent for decomposition and dependencies for ordering. A UI
may arrange those relationships as a tree, but the tree is not another
resource:

```text
parent task
  -> child task A
  -> child task B
```

The Host schedules task IDs from canonical task state. It never schedules a
tree, restores state from a tree, or treats tree placement as ownership.
Humans normally encounter a task through the App request that depends on it;
the task view supplies progress and diagnostic detail while the request remains
the promised result.

## Resource read interface

Exact Tasks use the same small resource-read shape inside and outside an App.
There is one transport-neutral service backed by canonical task state:

```text
tasks.list({ appId, status?, limit?, cursor? })
  -> bounded TaskPage

tasks.get({ appId, taskId })
  -> TaskDetail or not-found

```

The programmatic App read capability also exposes an opt-in shadow view:

```text
tasks.outcomes({ includeDone? })
  -> TaskOutcomePage
```

The model-facing Task tool requires an exact Task identity and returns only the
outcome containing that Task:

```text
tasks.outcomes({ taskId, includeDone? })
  -> TaskOutcomePage
```

This prevents a reconciliation attempt that already knows its Task or accepted
wait from loading the App's complete outcome projection into model context.
Use bounded `tasks.list` for discovery and `tasks.get` for exact Task detail.

The current shared `TaskView` is deliberately small:

```text
{ id, status, generation, outcome, summary?, response?, result?, evidence? }
```

The list form returns bounded views from live resources and immutable completed
receipts. It accepts exact status filters, a capped page size, and an opaque
continuation token. Omitting status includes every phase.

`result` is a bounded App-defined object for machine-readable domain decisions.
Runtime validates its transport shape and size but never interprets its domain
meaning. A parent that needs a child's verdict reads this object; it never
reconstructs the verdict from `summary`, `response`, evidence labels, or task
prose. Human explanation stays in `summary` or `response`.

The get form returns one exact `TaskDetail`, including parent, mode, acceptance,
input, selected execution mechanism, dependencies, and Conditions. Attempt and
activity evidence remain linked records rather than copied Task truth.

The optional outcome projection groups exact Task identities for a simpler read
view while preserving every member and link. It is not a new work resource,
write API, or completion authority; list/get remain the exact Task interface.

The contract is shared; only scope binding and transport differ:

- a workflow or observer receives the same reader already bound to its current
  App;
- an agent `tasks` tool supplies the current App-attempt scope;
- the daemon control socket carries those read operations for out-of-process
  adapters;
- HTTP binds the scope through `GET /api/apps/:appId/tasks` and
  `GET /api/apps/:appId/tasks/:taskId`; and
- the UI uses the HTTP adapter and renders the returned resources.

There is no separate HTTP read model, agent task model, or SDK task model.
Adapters translate argument placement but preserve the same exact `TaskView`,
`TaskDetail`, and pagination contract.

Exact absence returns not-found. Invalid limits or continuation tokens are
caller errors. HTTP maps absence to 404 and invalid reads to a 400 response;
SDK, socket, and agent callers receive the same underlying Runtime result or
error text.

App-scoped execution may read only its own App unless the Host explicitly
grants a system-level read scope. List results are capped and paginated. Reads
never expose task storage paths, SQL, leases, or mutation handles, and they
never use `.state/tasks/tree.json` as authority.

This common resource shape does not imply a universal CRUD service. Task,
request, conversation, and execution APIs may share `get`/`list`, identity,
pagination, and error conventions while retaining typed filters and details.
The event stream is the change notification: consumers observe a relevant
event and reread current resource state. The read API does not add a second
watch cursor or delivery guarantee.

Human surfaces may ask the same Host reader for `humanActionOnly`. This is a
derived filter over live Tasks and their exact dependency leaves with at least
one unsatisfied Condition owned by canonical identity `human` or
`human:<role>`; it is not another resource or lifecycle. The result is
deduplicated by the leaf Task that owns the Condition and the bounded card adds
`{ requestedAction, since? }`. `since` is present only when the current
Condition start is known; later observation time is not a substitute. Generic
`attention`, age, display-name owners, and adapter state never satisfy this
filter.

There is deliberately no generic task write API. A caller asks the accountable
App for an outcome, optionally naming the observed task. App policy then keeps,
revises, wakes, decomposes, or closes it through the normal input-to-task path
or reconciliation result. Inside an attempt, task changes remain
generation-fenced and atomically admitted with the result.

## Implementation progress

1. **Done:** define `TaskView`, `TaskPage`, and `TaskListOptions` once in the SDK.
2. **Done:** build one Host reader over the loaded App registry and canonical
   task state.
3. **Done:** bind it to the current App as `ctx.read.tasks`.
4. **Done:** expose the same reader to agents through one read-only `tasks` tool.
   App-local agents receive their App scope; a broader scope must be explicitly
   injected by the Host and cannot be requested by tool arguments.
5. **Done:** carry list/get over the daemon control socket and App-ID HTTP
   routes as thin adapters.
6. **Done:** add the opt-in, lossless outcome projection to the App/agent read
   capability without changing exact Task list/get or the default UI.
7. **Remaining:** migrate the default UI and point old path-based project
   endpoints at the shared reader, then remove
   them and their `tree.json` read-model dependency after callers migrate.

Each step uses the same contract fixtures. Do not first implement separate SDK,
tool, socket, and HTTP models and try to reconcile them later.

## Authority and migration

| Surface                       | Role                                                                        |
| ----------------------------- | --------------------------------------------------------------------------- |
| EventHub SQLite resource rows | Authority after that App completes guarded cutover                          |
| `.state/tasks/state.json`     | Legacy authority before cutover; never recreated by resource-backed runtime |
| `.state/tasks/tree.json`      | Disposable legacy human/UI projection                                       |
| `tasks/seed.json`             | Declarative initial state atomically bootstrapped into resource authority   |
| `project.json`                | Authored project configuration, never rewritten by task operations          |

One App has exactly one authority. Cutover requires pause, drained attempts,
import, full shadow comparison, source-revision verification, activation, and
explicit resume. Runtime discovery never imports or activates existing legacy
state implicitly. A brand-new App with no legacy state atomically establishes
resource authority from `tasks/seed.json` (or an empty seed); it never creates
an intermediate mutable `state.json`.
`tree.json` may be regenerated and must never restore canonical state. Task
state retains the bounded detail needed for reconciliation and recovery;
long-term domain evidence belongs in projects, reports, knowledge, session
evidence, or other owned artifacts.

A foreground task read loads only the named task, its parent chain, direct
children and dependencies, linked Conditions and receipts, and a bounded
recent-attempt window. It does not deserialize unrelated resources, groups, or
attempt history.

## Task identity and state

The stable execution key is `(appId, taskId)`. A task contains:

- `metadata.id`, `generation`, and `resourceVersion`;
- `spec` describing the outcome, mode, selected agent, workflow or executor,
  inputs, outputs, dependencies, parent, priority, and acceptance; and
- `status` describing observed generation, phase, summary, evidence, current
  attempt, and linked Conditions.

`generation` advances only when execution-relevant desired state changes.
`resourceVersion` advances on any task-resource mutation. Results are admitted
only when the task ID, generation, resource version/claim, and attempt still
match. A stale result applies no mutation.

There is no manager-transfer lifecycle or ownership encoded in ID prefixes.
App policy validates which task changes may revise a task; the generic engine
uses one admission path for all task IDs.

## Controller

Each App has one logical controller and one deduplicating in-memory ready set. The
controller may:

- deduplicate and prioritize task keys;
- derive readiness from dependencies and exact Conditions;
- claim at most one current attempt per key;
- resolve the declared agent and optional workflow;
- validate and apply one result/task-change batch atomically;
- reject stale results; and
- repair bounded delivery and execution state after restart.

It must not interpret task prose, choose project strategy, infer external truth
from time, contain App-specific policy, or use `tree.json` as a scheduler.

Global and per-App capacity limits allow unrelated keys to run concurrently
while serializing each key. Durable excess work stays pending. Trusted human
and normal lanes form the scheduling boundary, and human work has reserved Host
capacity. Inside one lane, Runtime uses the effective priority derived from the
persisted Task and FIFO for peers. A fresh exact wake may move ahead of passive
peers at the same priority, but it cannot override human origin or a higher
priority. Repeated wakes for one Task coalesce; a wake received while its
attempt is running requests exactly one fresh pass. Passive recovery rereads
canonical Task priority rather than carrying a second ordering policy in its
index or queue.

The controller is stable across definition reloads. Publication changes one
immutable definition pointer; a claim captures that pointer and uses its App,
agent, workflow, guard, skill, and shared definitions until the attempt ends.
Later claims use the new pointer immediately, even while older attempts remain
active. Reload may update the App concurrency limit in place: raising it starts
queued work, while lowering it permits active attempts to finish and delays new
claims until usage is below the limit. Pause disables new claims without
discarding the queue. Removing or renaming an App is rejected while it has
unfinished Tasks.

## Selecting the attempt mechanism

Agent selection is:

```text
task.agent ?? nearest explicit ancestor agent ?? app.agent
```

An unresolved or unrunnable agent moves the task to `attention`. If the task
names a workflow, that exact workflow is the selected handler. An unavailable
workflow moves the Task to attention. A failed, timed-out, or invalid execution
retries the same Task; it does not silently fall back to another executor.

A workflow may explicitly return `needs-agent` after exhausting its bounded,
safe moves. That creates at most one sequential agent attempt for the same
task. Work for another App is a typed Runtime-managed task dependency, not
`needs-agent`.

## Result contract

The SDK schema and runtime admission use one result shape. The current SDK
field and type are named `actions` and `TaskAction`; conceptually these are
task changes, not App actions or human commands:

```ts
type HandlerResult =
  | {
      state: "converged" | "waiting";
      summary: string;
      evidence: string[];
      response?: string; // caller-facing only when converged
      result?: Record<string, unknown>; // App-defined current machine state
      actions?: TaskAction[];
      conditions?: ConditionSpec[];
    }
  | {
      state: "needs-agent";
      summary: string;
      evidence: string[];
    };
```

Unknown fields are rejected. `needs-agent` is workflow-only. `waiting` requires
at least one open exact Condition or live direct child after actions are
applied. A waiting result may retain the App's current typed judgment in
`result`; a later attempt reads that object instead of rebuilding state from
summary or evidence prose. A thrown exception, timeout, invalid result,
rejected action batch, or failed verifier is not a domain result. Runtime keeps
the same Task pending and retries it with current evidence. A missing executor
or configuration that cannot run is visible attention.

Creating follow-up work does not complete the current task. Required
decomposition creates direct children and returns `waiting`; independent later
work may be a successor only after the current outcome is actually accepted.

Task changes and the final result apply in one transaction. Events emitted
while an attempt runs are separate durable commit points: a resource-backed
workflow supplies a stable local key, and the Host verifies the attempt fence,
deduplicates, persists exact wakes, then publishes. Races against a newer
generation or already-advanced target are treated as stale and retried from
current state, not converted into partial mutation or misleading attention.
Cross-App result work is returned as a typed dependency. Its durable App
request row is the correlation record; generic event emission cannot create a
second request lifecycle.

## Acceptance

Mechanical validation proves that a result is safe to apply, not that its
domain claim is true. Every completed receipt records:

```ts
type AcceptanceBasis = {
  method: "deterministic" | "workflow-contract" | "agent-judgment";
  verifier?: string;
  evidence: string[];
};
```

A workflow verifier runs after result validation and before commit. It proves a
positive postcondition. Missing or unknown evidence is not success. When a
workflow can hand off with `needs-agent`, its hard verifier still applies to a
later agent claim of convergence.

## Conditions

A Condition names one exact external observation, for example:

```ts
{
  id: "credential-ready:xhs",
  type: "credential.state",
  subject: "credential:xhs",
  expected: { field: "state", equals: "ready" },
  owner: "app:credential-provider",
  reviewAfterMs: 300_000,
}
```

A Condition that explicitly belongs to a human adds one plain action:

```ts
{
  id: "rollout-approval:v4",
  type: "project.approval.submitted",
  subject: "approval:rollout-v4",
  expected: { field: "decision", anyOf: ["approve", "reject", "hold"] },
  owner: "human:operator",
  requestedAction: "Approve, reject, or hold rollout v4.",
  reviewAfterMs: 3_600_000,
}
```

`requestedAction` is presentation guidance on the Condition, not a second
request. The Host records when the current Condition specification began
waiting; adapters use that time for age. Changing the specification starts a
new wait, while rereconciling the same Condition does not create another human
obligation.

For newly admitted Conditions, `owner` and `reviewAfterMs` are required.
`owner` uses a canonical responsibility identity such as `app:<id>` or
`human:<role>`; a person's display name is not an identity. Legacy Conditions
that omit either field remain readable but are not a model for new waits and
must be repaired or moved to attention when reviewed.

A watcher reads an external source and publishes a fact. It does not know task
storage or invoke an agent. The generic Condition tracker atomically updates
the Condition, stores the triggering event, and returns the affected task IDs
to enqueue.

A Task may wait only when something outside the current attempt can produce the
named observation: an existing Task or submitted operation, an external fact
source, or a human decision. “Deploy this change” is unfinished work, not a
`deployment.completed` Condition. The owning App must perform or durably submit
that work first. A self-owned requested action is rejected by the App boundary;
without a real external wait, the same Task remains runnable.

Every admitted wait must identify:

- the exact fact or Task result being awaited;
- the accountable external owner;
- a durable event or dependency route that wakes this same Task; and
- a next review time that protects against missed wakes or a disappeared
  producer.

Omitting the wake route or review deadline does not turn an incomplete state
into a valid indefinite wait. If Runtime cannot establish who can produce the
fact and how it will arrive, the Task needs attention instead.

## Event input and checkpoints

Each task retains ordered links to actionable events until an accepted
reconciliation has observed them. Claiming a task moves only a bounded prefix
into the attempt; it does not acknowledge that prefix. Result admission records
the attempt result and advances the task event checkpoint atomically. Events
linked during the attempt remain pending. A result with no external effect may
commit and leave them for the next attempt. A result that would publish work,
change another Task, merge a workspace, or classify failure is rejected if it
did not explicitly accept those newer events. Both `maintain` and `achieve`
therefore run again from current evidence before becoming quiet or terminal.

A newer desired task generation may explicitly supersede pending links fenced
to the older specification. Their causal events remain in the event store and
the generation transition records the supersession; they are not replayed as
if they targeted the new specification.

The durable event store remains the event authority. Task state keeps the
event identities, routing relationship, and a bounded canonical envelope
needed for recovery; it does not copy an unbounded event log. One event-backed
attempt persists the ordered batch only—the most relevant `trigger` is derived
in memory. Retained pre-migration attempts and synthetic controller attempts
without a durable event batch may still carry a compatibility trigger.

`reviewAfterMs` is recovery insurance, never proof that the Condition became
true and never the primary execution loop. At review time Runtime first checks
deterministic liveness: whether the dependency or producer still exists,
whether a matching event was missed, and whether the human action remains
open. A healthy wait stays waiting with a later bounded review. A satisfied
Condition wakes the same Task. A missing producer, wake route, or accountable
owner moves the Task to attention.

The review deadline is never silently removed merely because several checks
found no change. The owning App may revise the interval with evidence or
replace the wait with attention. Human waits remain visible to `/todo` between
reviews and do not invoke an LLM repeatedly just to rediscover the same pending
approval. Provider observation time and monotonic source revision, when
available, prevent known older facts from replacing newer Condition state.

Human approval or action uses a human-owned Condition on the exact source Task,
or a typed May conversational request when mediation is required.
The reply satisfies or updates exact evidence for the next attempt; it does not
itself prove the Task outcome.

## Modes and phases

Phases are:

- `pending`: desired state needs another attempt;
- `running`: one current attempt owns the generation;
- `waiting`: exact Conditions or live direct children remain;
- `attention`: the Task cannot run safely without a configuration or domain
  decision; and
- `converged`: a live `maintain` task currently satisfies desired state.

An `achieve` task is finite. Acceptance writes a compact receipt, removes it
from the live graph, and wakes dependents. A `maintain` task remains live and
must be woken by a domain fact/watcher and, only where necessary, a declared
scheduled check. An observation arriving during an attempt keeps the same
maintain task pending for another bounded attempt.

## Parents and dependencies

Executable parents own aggregate outcomes. Structural groups provide display
containment only. Dependencies provide ordering. All use the same App
controller.

```text
parent returns waiting + child task changes
  -> parent wait and children commit atomically
  -> children run within normal App capacity
  -> meaningful child transition stores a parent trigger
  -> parent rereads current children and receipts
```

The parent consumes no attempt slot while waiting. Only live direct children
form its decomposition frontier. Child completion does not automatically prove
parent completion; the parent judges aggregate acceptance. Missing parents,
self-parenting, and cycles are rejected.

Cross-App work uses the same rule without placing a foreign Task in the local
tree. A waiting result declares a typed child App dependency. Runtime admits a
deterministic child request, represents the wait as an exact Condition, and
wakes the parent with the accepted child result Event. The target App owns and
reconciles its Task; the requesting App owns only its parent Task and final
acceptance decision. Open child-request Conditions survive later parent
attempts. A later result can reuse the durable request ID or declare the exact
same target input; Runtime never turns a changed redeclaration into silent
duplicate work. Conflicting replacement fails admission before publication.

## Outputs and workspaces

The Host resolves App, project, and workspace roots before an attempt and
admits declared outputs only inside allowed roots. A workflow may request a
task-generation Git worktree; its branch and lineage are attempt evidence, not
another scheduler or desired-state store. Output admission validates the task
contract but does not replace tool sandboxing or process isolation.

## Follow-up events

Task state and the event store are separate authorities. Task transitions
commit canonical state first; transition events are persisted observational
projections and may be lost if the process stops between those writes. Recovery
does not depend on replaying such an event: persisted task state, triggers,
parent wakes, dependencies, and Conditions make runnable work discoverable
again. Workflows still return the single result contract and do not publish
competing task-completion claims.

## Pause, reload, and recovery

Pause stops new task attempts. App input admission, schedules, observers, and
event routing continue, and task intent/wakes remain durable. Resume rereads
canonical state and queues runnable IDs.

Shutdown stops new claims, drains for a bound, and records unfinished attempts
as interrupted where possible. Restart repairs stale claims and requeues the
same task identities; it never resumes an in-memory workflow stack or fabricates
completion.

Hot reload publishes one validated agent-and-App generation. Prior active
attempts retain their definitions and capacity claims until they end, while the
same controller starts new attempts from the new definition with any remaining
capacity. Reload never waits for an unrelated old attempt to drain. Generation
and attempt fences prevent duplicate execution or stale completion. The durable
definition source link changes at the same publication boundary, so a later
restart restores the accepted generation rather than the checkout that happens
to be present. Runtime-code changes still require process restart.

Recovery follows one ladder:

1. retry a known transient mechanical failure within its bound;
2. repair stale claims, leases, or queue hints;
3. requeue the same persisted task ID;
4. expose `attention` when domain judgment is required; and
5. delegate/escalate only when the next action crosses ownership.

Metrics and watchdogs may reveal a stuck task, but they never create a
replacement lifecycle or change desired state.

## Execution isolation

Task readiness may be coalesced and bounded, but admission is never queued
behind Task execution. Once an Event and its exact wake are durable, the Task
controller starts an isolated worker process for that attempt. The worker
rereads and claims the current generation, constructs context, executes, and
persists the fenced result. Slow workspace inspection, Git commands, file
reads, provider calls, model turns, and tools therefore never execute on the
interface event loop.

The worker uses the same Task resources and EventHub journal as the parent. It
does not create a worker Task, proxy Task, semantic queue, or second retry
policy. Events are persisted once in the worker and relayed with their durable
row IDs so parent-side listeners can observe them without duplicate journal
rows. The parent fans out a bounded batch and then yields to interface work;
the bound is shared across all active workers, not applied separately to each
worker. A burst of progress events must not monopolize the event loop. If the
worker exits, the controller's existing retry and lease recovery continue the
same Task identity.

The parent-side exact wake is constant in scope: it reads the named Task and
its open Conditions, records the trigger, and schedules that identity. It does
not load the Task's children or attempt history and does not treat feedback as
a fresh declaration of the Task goal. Broader context belongs to the isolated
attempt that later reconciles the Task.

An attempt worker loads only its owning App's Task runtime and owning agent.
The recovery worker loads only the agents required by Task-enabled Apps. Both
reuse the read models already published by the parent; they must not
resynchronize every App at startup because those duplicate writes contend with
the Event journal and can delay human-message durability.

The worker is owned by that Runtime process. A private lifetime pipe closes
when the parent exits, causing the worker to stop; normal recovery then
continues the same Task. A worker from an old Runtime must never remain alive
and write beside its replacement.

Startup launches recovery after opening the interfaces, but does not await it
before accepting human input. Task controllers open when that pass either
finishes or yields to their bounded recovery checks. A recovery error is Task
evidence to retry, not a reason to terminate the interface process.

Resource-backed Tasks coordinate concurrent writers with their existing
SQLite transaction and exact resource-version/generation/attempt fences. They
must not also wait on the legacy `state.json` filesystem lock: that duplicate
lock adds no authority and a synchronous wait would freeze unrelated Host
work. The filesystem lock remains only for the guarded legacy JSON importer
until that compatibility path is retired.

Only scheduling and bounded readiness checks remain in the interface process.
Task claim, context construction, execution, and result persistence belong to
the worker process. The startup repair pass uses the same process boundary;
after it finishes, the parent performs only one bounded indexed readiness scan.
Read-only interface queries remain independent and must meet their
responsiveness budget while workers are active.

## Required invariants

Tests and audits must prove:

1. Each App has exactly one mutable task authority; activated resource-backed
   Apps do not read or recreate `state.json`.
2. Queue entries contain IDs and stale readers claim current canonical state.
3. At most one current attempt exists per `(appId, taskId)`.
4. Condition update and trigger persistence are atomic.
5. Result/task-change admission is atomic; stale results and effects based on
   newer unaccepted Task events apply nothing.
6. Completion has an explicit acceptance basis.
7. Parent waits and child creation commit together; meaningful child changes
   durably wake the same parent.
8. Pause/restart/pressure retain work without inventing another attempt; an
   indexed safety query can rebuild a lost ready-set entry.
9. Direct agent and workflow-nested sessions remain correlated to the current
   task generation and obsolete sessions cannot complete it. Workflow and
   session storage project the exact `(appId, taskId, generation, attemptId)`
   binding supplied by Runtime; readers never recover ownership from prompts.
10. A task-owned emitted event is visible only after durable acceptance, and a
    retry with the same local key cannot duplicate it.
11. Every App-owned execution uses this engine; only direct non-App execution
    such as CLI experiments and Gym may run without an App task.
12. Resource-backed Task contention never uses a synchronous filesystem wait,
    and slow Task I/O cannot delay event admission or resource reads.
