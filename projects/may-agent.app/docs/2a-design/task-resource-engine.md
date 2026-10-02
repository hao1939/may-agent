# Task Resource Engine

**Supports:** [System Model](system-model.md#carry-work-through-change-and-interruption). Preserves requirements, accepted work and outstanding facts across bounded attempts.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#one-authority-for-each-resource).

**Design status:** Accepted.
**Implementation status:** SQLite authority, fenced attempts, Conditions,
exact input dependencies, accepted outcomes and indexed recovery are implemented.
Task activation is independent of optional schedules. Attempts are bounded;
unfinished work retries with backoff until progress or authorized owner closure.
Explicit result scope is [merged in Host #269](../archive/reviews/explicit-task-input-consideration-20260930.md); source and deployment evidence remain separate.

This page owns the durable Task contract. Historical `achieve`/`maintain` mode
data does not select a lifecycle; result labels describe attempts, not lifetime.
[Caller feedback](events.md#results-and-correlation) supports explicit updates
while waiting or retrying and factual execution-error returns through the exact
input's caller link. Its [implementation record](../archive/reviews/caller-feedback-and-waiting.md)
retains historical rollout evidence.
[Message Lifecycle](message-lifecycle.md) owns conversational behavior;
[App Contract](agent-app.md) owns declaration and input mapping.

Read the lifecycle below first. Use [the executor contract](task-attempts.md#one-attempt-interface)
and [resource reads](#resource-read-interface) as references when implementing an adapter.


For execution input, live actions, result fields and acceptance, read [Task attempts and results](task-attempts.md). This chapter owns the durable lifecycle and Conditions.

## One lifecycle baseline

One Task lifecycle serves ordinary work, maintenance and Conversation.

A Task remains open after an outcome: the worker chooses how to proceed; its owner
decides whether to retain, revise or close the assignment. Unfinished failure keeps
reconciling with backoff, without a fixed failure-count stop. Attempts stay bounded.
Older resources may retain mode data; new `TaskIntent` has no mode. Timers are
optional input; quiet Tasks consume no worker or recurring model call.

A caller consumes its exact assignment's accepted outcome, not child closure; input/generation/result references distinguish it from old success.
A Conversation normally executes through one stable Task; fresh human input after
closure uses the linked successor below. Turns share the common attempt fence;
Messages, Topics and Requests remain records without a separate executor.
Request closure needs its current scope and explanation and leaves chat available.

Turn Stop fences one execution/input; a worker's `stopped` result records failure evidence and preserves retry eligibility. Owner closure
prevents new claims and late settlement, retaining unresolved work visibly non-success. It neither fulfills Requests nor
implicitly cancels children; old events and ordinary input cannot reopen it. An explicit user request can reopen the same Task through the operator control described below. A conventional result close
requires the exact accepted attempt and current generation/resource-version fences. The shared guard also requires the stored converged phase,
no current attempt and no pending trigger. Rejection preserves every Task fact and link; exact replay returns the existing receipt without
another write. These mechanical checks do not decide responsibility lifetime, and independent structural children can continue. Intentional withdrawal remains a separate cancellation control that may stop active work under existing authority.

Explicit `task.reopen` requires current versions and trusted operator verification of the user's continuation request.
The App maps its optional `input`; Host atomically installs requirements, advances generation once, admits input and archives closure, preserving Task identity.
The App/agent distinguishes observations from requirements. Closed-Task observation routes retain history without waking or retrying;
requirement inputs are never silently archived. Authorized continuation needs no prior rejection. Old accepted answers and input closures remain history.
Pre-reopen events cannot wake the new generation or satisfy its Conditions; unrelated Tasks may still observe them.
See [the operator procedure](../2b-manual/app-operations-recovery.md#rejected-input-and-explicit-task-reopening) for replay, unchanged assignments and Conversation's successor convention.

[Attempt selection](task-attempts.md#selecting-the-attempt-mechanism) owns
prerequisite failures; [Conversation execution](conversation-execution.md) owns
turn controls. The [unification record](../archive/reviews/conversation-input-unification.md)
retains code-deletion and migration evidence. Source verification does not
certify App judgment or an installed release.

## One App work path

For Task-based input, the Host stores a caller-correlation request. The App does not
reconcile that inbox record directly; it resolves the input to a task and
reconciles the task. The Host completes the correlated request from the
accepted task result. Conversation and presentation adapters observe that
result independently; transport delivery never gates Task completion.

Admission and projection failures retain consecutive failure count, first-failure time and recovery deadline. Repetition advances backoff;
new exact evidence permits reconsideration and the due scan repairs lost wakes. Projection failure cannot replace accepted Task outcomes
or consume unrelated waits, inputs or work.

A requirement input naming a closed/missing exact target, or an invalid revision, is a deterministic rejection: `handling.phase=failed` and a readable correction result.
Its `status=done` means input processing ended, not that a human Request was fulfilled; it is not retried as Task work. Unknown storage/mapper
failures keep exponential backoff (250 ms to one hour, subject to scan cadence). Backoff paces recovery; it does not repair deterministic errors.
Runtime returns blockers through the typed App caller link. Without an accountable route, `app.input.admission.failed` addresses the owning App
with input ID, target Task, disposition and fingerprint. May's subscription admits May failures to Conversation review: inspect evidence, correct
what is authorized, and request the specific missing human decision. The failure grants no reopening permission. Other Apps need their own subscription.
Saved fingerprints/event identity deduplicate unchanged feedback across restart; rejected input retries only undelivered feedback, with backoff.
An accepted durable App plan proves delivery responsibility; diagnostics/no-op routes do not. Agent consideration and human notification require later evidence.

Every Task-based App input creates, revises, attaches to, or wakes a
Task. A simple task converges on its first bounded attempt and leaves a compact
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

An open Task remains available after an accepted outcome. Its lifetime is not
selected by historical mode data. SDK `status: done` describes that outcome,
not owner closure; read `closed` separately. A new ask waits for its own exact
answer, while replaying the same admission must not run another cycle. Closed
Tasks and historical immutable receipts are not reopened by this rule.

For a conversational handoff, the App names the accepted ask in
`followUp.requestId`. The Host records the admitted Task reference and its
return links together. Request references require no prior Topic attachment.
[Message Lifecycle](message-lifecycle.md#requests-acceptance-and-closure)
owns this distinction between reference metadata and work admission.

## Mental model

```text
App input declares, revises, attaches to, or wakes TaskIntent
  -> Host persists canonical task state
  -> queue receives (appId, taskId)
  -> worker rereads and claims the current generation
  -> one selected handler works until it returns a proposed result or exact wait
  -> Host validates and atomically applies one result
  -> task records an outcome, waits on exact evidence, or retains failure and retries
```

Observers publish facts. The Condition tracker updates only exact Conditions
still owned by waiting/running tasks and wakes those task IDs. Events are the
normal trigger. Indexed startup, due, expired-lease, and safety queries repair
a lost in-memory wake without scanning an App tree.

The queue is an in-memory hint. The persisted task, trigger, Condition, and
attempt state are sufficient to recover it.

App reload publishes one selected runtime generation. A running attempt retains
its execution definitions; a later session event uses the currently published
adapters and descriptors together, subject to exact Task ownership checks. A
process-scoped subscription must not retain a second, obsolete runtime selection.
If replacement publication is rejected, rollback reinstalls the accepted runtime
options with its descriptors and does not invoke the previous publication callback.
If no runtime was previously installed, rollback leaves no selected options;
later session events and recovery calls cannot use the rejected adapters.
The [lifecycle review](../proposals/task-runtime-organization.md#task-lifecycle-review)
records the reproduced listener gap and its source fix separately from this contract.

An explicitly blocked workflow retains its bounded diagnostic context in Task
evidence so the worker or an authorized caller can investigate the actual failure, not only
a generic attention summary. Context larger than the Task evidence budget
remains on the cited workflow run. This does not turn a prior failure into
policy or make an unchanged automatic retry useful.

## Execution and outstanding results

For the agent's work, ask two independent questions:

- **Running:** is an execution in progress?
- **Waiting:** is a needed result still outstanding?

| Running | Waiting | Meaning |
| --- | --- | --- |
| Yes | No | Working, with no outstanding result needed from elsewhere. |
| Yes | Yes | Working while also waiting for a result; for example, preparing a review while a pipeline runs. |
| No | Yes | No current execution; a result remains outstanding. Other useful work may already be queued. |
| No | No | No current execution or outstanding wait. Work may be queued, up to date, closed, or need attention; read those facts separately. |

An execution includes its tool calls and I/O; running does not mean the model
is continuously generating text or consuming CPU. A direct tool call can keep
that execution open while it awaits its response. Such a call does not require
a persisted Condition merely to describe that it is waiting.

The agent requests an outcome and handles a completed result, a pending result
or a failure. It need not choose between infrastructure categories such as a
helper call, delegated Task or provider operation. The selected capability must
make its promise clear: does this call return the result, or has work been
accepted with a reference and a supported later return path? Code owns that
bookkeeping and cleanup. These are common meanings, not a new universal tool
schema. See the [capability boundary](system-boundary.md#core-external-capabilities-and-composition).

Task closure remains separate: an open Task is a responsibility, not proof of
running execution or waiting. Existing attempts/claims and Condition/input
links provide the durable facts. The scheduling phase describes eligibility;
do not add combined phases, duplicate running/waiting flags or an agent-wide
availability registry. A child relationship or an FYI event alone is not an
outstanding result obligation.

A Task can execute useful work while retaining outstanding dependencies. New
relevant input can start a pass without satisfying an older wait. The agent
chooses what can progress within scope and budget; code preserves the other
waits and delivers their results. Answering that new input does not fulfill an
older ask whose required result is still pending.

When a result is still needed and no useful independent work remains, end the
attempt with a durable wait.
Release its execution capacity while the Task stays open. A matching result,
other relevant input or a declared review checkpoint can wake it later. Ending
an attempt is neither closing the Task nor abandoning the Request.

| Current facts | Human-facing explanation |
| --- | --- |
| An attempt is running; results remain outstanding | Working on the review; also awaiting pipeline 42. |
| No attempt is running; an external result is needed | Waiting for pipeline 42; no parent execution is running. |
| No attempt is running; useful work is ready | Queued to continue the review. |
| Current inputs are handled; no results remain outstanding | Up to date; available for later input. |
| Progress needs an owner's decision | Needs attention: explain the decision and what can still proceed. |

Idle is only an execution observation. It cannot establish that work is complete
or that a wait is sensible. Likewise, waiting for a worker's answer does not
prove that worker is currently running. Read its current status when making
that claim, and keep a missing/unknown result distinguishable from completion.

The same agent profile can serve several Tasks. One Task waiting does not make
that agent globally unavailable. Within one Task, preserve one current attempt;
outstanding dependencies do not authorize a second competing parent attempt.

[Task attempts](task-attempts.md) owns the supported live changes and final
result contract. The worker can act many times before returning; infra derives
current Task state from admitted input, results, Conditions and owner controls.
[Working on a Task](../2b-manual/task-execution-guide/SKILL.md) shows the current
`state`/`continue` choices without relying on a future schema.

## Resource authority

[Storage](storage.md#record-ownership) owns the full record/authority table.
Current Task runtimes require canonical SQLite resources. A new App atomically
bootstraps them from `tasks/seed.json` or an empty seed. An empty seed establishes
storage only: Task execution still requires a root group, and every intent's
`parentId` must already name a live Task or structural group. New Task-based Apps
should seed that root as in the [quickstart](../2b-manual/sdk-quickstart.md).
There is no intermediate mutable `state.json` or automatic import of an old
installation.

Retained `state.json` is historical evidence after cutover; `tree.json` is a
legacy presentation projection and can never restore Task authority.
`project.json` is authored configuration, not a Task-state writer. The removed
cutover procedure is preserved in the
[historical migration record](../archive/implementation/retired-task-resource-cutover.md).

A foreground read loads the exact Task, its parent chain, direct children and
dependencies, linked Conditions/receipts, and a bounded attempt window. It does
not deserialize unrelated state. The shared reader powers SDK, agent, control
and HTTP views. Any remaining path-based UI migration must preserve that same
read contract rather than introduce another Task model.

An exact SDK Task read also exposes `currentObligations`, the common read-only
projection of current timing and retained input work. `{ available: false }`
means Runtime cannot authoritatively provide this projection; it never proves
that no obligations exist. When available, `reviewAt` is the Task's authoritative
absolute reconsideration deadline. `inputWaits.items` is bounded exact input
obligation evidence, including its admission key, input/admission correlation,
per-input review deadline and Condition count. Callers must honor `maxItems` and
`truncated`: absence from a truncated page is not fulfillment. App-specific
review policy may interpret this common evidence but does not redefine it.

## Task identity and state

The stable execution key is `(appId, taskId)`. A task contains:

- `metadata.id`, `generation`, and `resourceVersion`;
- `spec` describing outcome, execution, inputs, dependencies, parent, priority,
  and acceptance; older specs may retain compatibility-only mode data; and
- `status` describing observed generation, phase, summary, evidence, current
  attempt, and linked Conditions.

`generation` advances only when execution-relevant desired state changes.
`resourceVersion` advances on any task-resource mutation. Results are admitted
only when the task ID, generation, resource version/claim, and attempt still
match. A superseded generation or attempt applies no mutation. New events on
the same executing generation are pending input, not proof that its output is
invalid.

There is no manager-transfer lifecycle or ownership encoded in ID prefixes.
Creator identity is immutable metadata `{appId, taskId?}`: App-created work has
an App-only creator, while delegated work names its exact creator Task. Creation
supports both legitimate owner kinds. Task-bound revision uses its existing
fenced attempt capability. An App-only revision is an optional
`expectedGeneration` on the installed App task mapper's desired attachment: the
mapper deliberately selects the existing Task ID from typed App input, while the
Host derives App-only authority from the saved non-delegated inbox row. The
common admission transaction rereads exact creator `{appId}` and current
generation before applying the mapped intent. A worker cannot gain authority by
omitting `taskId`, naming an owner, targeting itself, or acting across Apps.
Parent links, references and executor names confer no authority. Historical Tasks without creator metadata remain provenance-incomplete; normal admission must not infer creator authority from other fields, and any correction must follow the reviewed [offline safety procedure](../2b-manual/app-operations-recovery.md#historical-tasks-missing-creator-metadata).

App policy maps the complete revised input; the generic engine preserves the
stable Task identity, parent, accepted results and unrelated obligations while
advancing generation only for changed requirements. The responsible owner may
change methods within the accepted outcome and constraints without revising the
goal. Changing the outcome or a constraint requires creator-authorized revision
of that same Task. Method choice, a Condition, an execution failure, a dependency,
a valid wait, an independent obligation, and other useful work can coexist; none
implicitly transfers ownership or discharges the owner's delivery responsibility.
Stale generation, foreign creator, self-revision and concurrent-change controls
reject the whole update. There is no generic write API, manager-transfer
lifecycle, or ownership encoded in ID prefixes.

**Revision boundary:** task-bound `tasks update` is unchanged. Ordinary
`targetTaskId` input remains attach-only and bypasses mapping, so it cannot
revise scope. A typed App policy may instead return desired intent for an exact
existing ID with the caller-observed `expectedGeneration`. Only a saved
non-delegated inbox input receives App-only revision authority; task-bound,
foreign, missing, closed, and stale targets terminate with readable correction
feedback rather than an unbounded recovery retry. Exact accepted admission
replay remains idempotent, but the same identity cannot authorize changed
requirements. This admission capability is implemented; each App mapping must
deliberately opt into creator-authorized revision. Deployment and behavior of a
particular mapping require separate evidence.

## Controller

Each App currently has one logical Task controller and a deduplicating
in-memory ready set. The controller schedules keys, obtains capacity and invokes
bounded reconciliation. The Task reconciler and State operations derive
eligibility, claim an attempt, validate and apply a result, reject stale effects
and preserve the evidence needed by recovery. These are distinct responsibilities
within the same runtime; scheduling does not own a second Task state machine.

The [one-lifecycle baseline](#one-lifecycle-baseline) makes Conversation use this
Task execution authority as well. Accepted results and owner closure remain
separate; shared scheduling does not merge their meanings.
A common engine requires no Task dependency on conversational policy or merged
product-record schema.

The controller must not interpret task prose, choose project strategy, infer
external truth from time, contain App-specific policy, or use `tree.json` as
a scheduler.

Global and per-App capacity limits allow unrelated keys to run concurrently
while serializing each key. Durable excess work stays pending. Trusted human
and normal lanes order work inside the Task queue. Pending human Conversation
input can use foreground Host capacity; automated work uses background capacity.
Inside one lane, Runtime uses
the effective priority derived from the persisted Task and FIFO for peers.
A fresh exact wake may move ahead of passive
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

A delegated result returns through the same pattern at every level: commit the
answer to the exact admitted input, record/wake its linked caller, and let that
caller reconcile current evidence. A parent relation, an explicit `dependsOn`
prerequisite and a Conversation follow-up link retain their different meanings.
Parent placement alone supplies no return route. Child completion
does not itself fulfill a parent Task or a human Request. The
[comparison](../archive/reviews/conversation-input-unification.md#which-differences-are-real)
explains how the target separates accepted outcomes, availability and closure.

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
`owner` uses `human` or a canonical `kind:identity` such as `app:<id>` or
`human:<role>`. The kind starts with a lowercase letter and contains only
lowercase letters, digits or hyphens; the identity contains no whitespace or
colon. Surrounding whitespace is trimmed. A display name or sentence is not
an identity. This field names who can supply the fact; it neither sends a human
message nor establishes permission to repair the resource. Legacy Conditions
that omit either field remain readable but are not a model for new waits and
need correction when reviewed. `reviewAfterMs` must be
an integer of at least 60,000. Returning an unchanged wait preserves its future
review deadline; accepted reevaluation may renew a due deadline if the fact is
still pending. A normal wake neither resets nor removes unrelated waits.

A watcher reads an external source and publishes a fact. It does not know task
storage or invoke an agent. The generic Condition tracker atomically updates
the Condition, stores the triggering event, and returns the affected task IDs
to enqueue.

A Task may sleep only when something outside the current attempt can produce the
named observation: an existing Task or submitted operation, an external fact
source, or a human decision. “Deploy this change” is unfinished work, not a
`deployment.completed` Condition. The owning App must perform or durably submit
that work first. A self-owned requested action is rejected by the App boundary;
without a real external wait, the same Task may instead request another bounded
pass for useful authorized work.

Every admitted sleeping wait must identify:

- the exact fact or Task result being awaited;
- the accountable external owner;
- a durable event or dependency route that wakes this same Task; and
- a next review time that protects against missed wakes or a disappeared
  producer.

Outstanding waits are independent of wake admission. Legitimate new input
routed to a Task requests reevaluation even if it matches none of its current
Conditions. Receiving that input neither removes the other waits nor resets
their deadlines. Accepted reconciliation preserves still-valid waits and may
retire only those established as satisfied, obsolete, or explicitly cancelled.
Any relevant change can wake a pass; all acceptance requirements must still
hold before completion. This includes unexpected event types, not only a
pre-enumerated set of known domain changes. See
[workflow wait semantics and implementation status](execution-contributions.md#a-wait-reason-is-not-an-exclusive-event-filter).

Condition declarations are identity-scoped deltas, not snapshots. A distinct ID
adds an obligation; the same ID may update its complete specification while
preserving unrelated Conditions, dependency links, failed-operation facts,
selected reports and pending input. A generated or persisted dependency Condition protects identity, while a compatible explicit same-ID declaration controls the complete specification, including `reviewAfterMs`; conflicts reject. Omission means no change.
Satisfaction or generation-fenced retirement names the exact Condition; retry,
failure, unblock, dependency repair, wake or ordinary reconsideration never
clears peers. Retained legacy rows remain readable without being revalidated as
newly authored declarations. A changed specification starts
a new generation and cannot inherit an older approval. Condition `reviewAfterMs`
checkpoints renew after an accepted waiting or converged settlement while the
fact remains pending. Stale or otherwise unaccepted proposals, including those
superseded by pending input, do not renew checkpoints.
Public `observation.reviewAt` uses the scheduler's `observedAt + reviewAfterMs`
calculation (epoch milliseconds), omitted for satisfied or unusable observations.
Use this checkpoint, not creation time; passing it warrants review, not failure.
Task-level `reviewAt` is a recovery checkpoint: a future omitted deadline is
preserved, a due checkpoint is consumed, and sleeping again must return a new
explicit deadline or Condition. Immediate `continue: true` work requires neither.
Accepted completion consumes that checkpoint unless an independently correlated
input deadline still exists. Whole-Task
cancellation remains the only broad termination operation. Callers that once
used a replacement list must now explicitly retire removed identities; arbitrary
JSON, observations, and history are not deep-merged.

Exact Task reads keep current status, summary, and result current-first. They
advertise whether immutable accepted-attempt evidence exists without loading its
bodies. A caller may explicitly request bounded newest-first pages from the same
read surface. Each record carries App, Task, generation, attempt and
`app_task_attempts.acceptedResult` provenance; an opaque cursor can reach older
records after arbitrarily many later waits. Per-record serialized output and
page size are bounded, with explicit omitted-field and continuation metadata.
History never automatically replaces current result, certifies recovery, discharges unrelated obligations, or creates another evidence lifecycle.
An owner may use an exact scoped receipt when reconciling the obligation it proves.

Omitting the wake route or review deadline does not turn an incomplete state
into a valid indefinite wait. Code validates shape and exact routes it knows;
App validation/guidance must establish whether its source can actually produce
the fact. A syntactically valid owner is not proof that a wait is meaningful.

## Event input and checkpoints

Each task retains ordered links to actionable events until an accepted
reconciliation has observed them. Claiming a task moves only a bounded prefix
into the attempt; it does not acknowledge that prefix. Result admission records
the attempt result and advances the task event checkpoint atomically. Events
linked during the attempt remain pending. A useful waiting result can retain
its output and exact Conditions alongside that input. A no-action completion
proposal or diagnosis retains its bounded output as progress, with the existing
waits intact, without issuing a completion receipt or parking the Task. The
next pass reads that result and the pending input. Results proposing Task actions
remain fenced as an atomic batch: saving a result that reports admission while
withholding its actions would falsely record work as admitted. Rejected batches
remain execution evidence, not accepted Task result or a replay queue.
Failure findings remain failed-attempt evidence, not stale-result interruptions.
A new cross-App request remains effect-fenced separately.

Delivery identity survives claim, settlement and late relay; receipt is not outcome acceptance.
See [duplicate handling](execution-feedback.md#duplicate-delivery-and-safe-reconsideration) for Host/App duties and Host #175.

Facts retain their source/content scope; Apps judge whether they establish readiness.
A changed head neither erases useful evidence nor makes old-head proof current validation.
No universal invalidation table or new workflow state machine is needed.

A storage compare-and-swap collision is not a domain failure. Result and
workspace-metadata persistence may reread current resources and retry the
fenced transaction once. This repeats neither the handler nor provider effects;
all generation, action, and pending-input checks run again. Another collision
or a now-invalid claim uses normal recovery. Never retry an old write set or
treat semantic staleness as a transient database collision.

Current source tests cover fact-preserving settlement. Dated pilot results
belong to the [verification record](../archive/reviews/authority-boundary-pilot-20260906.md),
not a separate result contract or a claim of fleet deployment.

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
true and never the primary execution loop. Recovery replays available exact
dependency outcomes and external facts. A due checkpoint can admit one bounded
attempt with the original input and due Condition IDs. That attempt judges
whether the wait remains useful and can renew its deadline. The Host does not
generically establish that every external producer or accountable owner exists.

The review deadline is never silently removed merely because several checks
found no change. The owning App may revise the interval with evidence or
report why it can no longer progress. Human waits remain visible to `/todo`
between reviews. Checkpoints can invoke the selected executor, including an LLM;
choose intervals appropriate to that cost rather than claiming all waits are free.
Provider observation time and monotonic source revision, when
available, prevent known older facts from replacing newer Condition state.

Human approval or action uses a human-owned Condition on the exact source Task,
or a typed May conversational request when mediation is required.
The reply satisfies or updates exact evidence for the next attempt; it does not
itself prove the Task outcome.

## Phases and historical mode data
Phases are:

- `pending`: desired state needs another attempt;
- `running`: one current attempt owns the generation;
- `waiting`: exact Conditions or typed input dependencies remain;
- `attention`: retained diagnostics or an explicit handoff/Turn Stop; eligibility
  depends on its reason and input, not this label alone; and
- `converged`: an accepted outcome with no currently eligible input.

Older persisted resources may retain `achieve` or `maintain` mode data. The
current intent contract does not accept either label, and retained data does not
select Task lifetime. Exact accepted attempt/input references remain readable
after later input. Owner closure is separate from phase, so `converged` alone
does not tell whether new work can be admitted. An observation during an attempt
stays pending for a later bounded pass unless explicitly consumed by its admitted
result.

## Parents and dependencies

An executable caller may own an aggregate outcome. Parent links organize work
and scope reads/actions; they do not subscribe to results or block acceptance.
Structural groups provide display containment. All executable Tasks use the
same App controller.

```text
caller returns waiting + typed dependencies
  -> Host admits exact App inputs and retains their return Conditions
  -> workers run within normal App capacity
  -> exact input report or answer wakes its linked caller
  -> caller judges the returned evidence for its own assignment
```

Parked callers use no attempt slot; independent work can use another bounded pass.
A worker's answer does not prove the caller's aggregate outcome. Missing parents,
self-parenting, and cycles remain invalid. `dependsOn` is a static execution
prerequisite, not a result return link: it can prevent execution until its gate
is satisfied, so it is not a substitute for a caller that must review failures.

Same-App and cross-App work use typed dependencies. The target App validates
the requested input and chooses its Task, specification and executor; callers
do not return raw `create-task` actions. Runtime correlates the exact input,
not the worker's latest unrelated result. The target App owns and reconciles
its Task; the requesting App owns its caller Task and final
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
An unfinished waiting Task retains its clean worktree while releasing execution
capacity. Accepted completion, not an external wait, is the ordinary cleanup
boundary; dependencies and local evidence should survive the same-generation
reconciliation loop.

For a Git App workspace, remote `origin` is source authority. Preparation fetches
its advertised base and optional Task branch into private, generation-specific refs
without changing shared refs, tags, or `FETCH_HEAD`. The base is `origin/<base>`;
an advertised Task branch may supply the new head. Only when neither that remote nor
a cached `refs/remotes/origin/<base>` exists does preparation use the local base.
`git remote rename origin backup` moves its tracking refs; deleting only remote
config does not select local source. This choice never compares recency. Refreshes
preserve worktree, head, and original base; disabling refresh still prefers a cached ref.

## Follow-up events

Task state and the event store are separate authorities. Task transitions
commit canonical state first; transition events are persisted observational
projections and may be lost if the process stops between those writes. Recovery
does not depend on replaying such an event: persisted task state, triggers,
exact caller-return links, dependencies, and Conditions make runnable work discoverable
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

Recovery restores eligibility for ordinary reconciliation; it is not a second
execution or completion policy. Its response depends on current facts:

- repair demonstrably interrupted claims or lost queue hints and requeue the
  same persisted Task identity;
- retry unfinished failures with persisted backoff and bounded attempts;
- retain valid exact waits and accepted results; and
- expose retained diagnostics when a prerequisite or domain decision prevents
  progress, without silently withdrawing the assignment.

These are not stages every failure must climb. Apps judge a change of approach,
scope or continuation; delegation is needed only when the next action crosses
ownership. Attention must carry a concrete reason. Whether each failure reaches
an existing exact caller route remains an explicit proof obligation in the
[controller proposal](../archive/reviews/task-controller-pattern.md).

Retained legacy attention marked `previous-runtime-attempt-not-recoverable`
is repaired into eligibility for the same Task and generation. This known
mechanical repair does not require an App `owner-review` input or an LLM
instruction. Other attention reasons retain their existing handling. The
[core policy cleanup](../proposals/authority-boundary-simplification.md#core-policy-cleanup)
removes the obsolete fallback that followed this repair; old notification
metadata needs no migration.

The former fixed retry limit in #107 was superseded by #158. Persisted execution
failures back off from 250 ms to a maximum one-hour interval, without abandoning
the assignment after a count. Fresh human input permits one earlier attempt;
ordinary wakes do not waive backoff. Dispatch errors before failure persistence
use the controller's local 250 ms–30 second pacing instead. These are different
boundaries, not competing Task lifecycles. Backoff limits frequency, not total
spending; owners can revise, pause or close work under the [shared recovery rule](system-boundary.md#recovery-uses-evidence-before-repetition).

Metrics and watchdogs may reveal a stuck task, but they never create a
replacement lifecycle or change desired state.

## Execution isolation

The [Runtime isolation contract](runtime.md#task-execution-isolation) owns worker
processes, bounded parent-side readiness, interface responsiveness and parent-loss
cleanup. Workers use this Task engine's authority and fences; process isolation
creates no second Task or recovery lifecycle.

## Required invariants

Tests and audits must prove:

1. Each App has exactly one mutable task authority; activated resource-backed
   Apps do not read or recreate `state.json`.
2. Queue entries contain IDs and stale readers claim current canonical state.
3. At most one current attempt exists per `(appId, taskId)`.
4. Condition update and trigger persistence are atomic.
5. Result/task-change admission is atomic. Superseded claims apply nothing;
   new input preserves same-attempt output without authorizing unseen effects
   or terminal judgments.
6. Completion has an explicit acceptance basis.
7. Typed dependencies retain exact input-return links; recovery can rediscover
   reports/answers without treating structural parents as subscribers.
8. Pause/restart/pressure retain work without inventing another attempt; an
   indexed safety query can rebuild a lost ready-set entry.
9. Direct agent and workflow-nested sessions remain correlated to the current
   task generation and obsolete sessions cannot complete it. Workflow and
   session storage project the exact `(appId, taskId, generation, attemptId)`
   binding supplied by Runtime; readers never recover ownership from prompts.
10. A task-owned emitted event is visible only after durable acceptance, and a
    retry with the same local key cannot duplicate it.
11. Every durable App Task, including Conversation, uses this engine.
    Direct non-App CLI experiments remain bounded caller-owned execution.
12. Resource-backed Task contention never uses a synchronous filesystem wait,
    and slow Task I/O cannot delay event admission or resource reads.

## Task and task view

A Task's stable identity and canonical state drive scheduling. A tree of parent
and dependency links is only a view. Task reads expose progress and evidence;
input handling remains distinct from [Request fulfillment](message-lifecycle.md#requests-acceptance-and-closure).

## Resource read interface

[Task resource read interface](task-resource-read-interface.md) defines
`tasks.list/get/outcomes`, scoping, pagination, human actions and write boundaries.
Reads derive from canonical Task state.
