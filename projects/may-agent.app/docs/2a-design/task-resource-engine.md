# Task Resource Engine

**Design status:** Accepted.
**Implementation status:** SQLite resource authority, fenced reconciliation,
exact Conditions/dependencies, bounded execution, accepted results and indexed
recovery are implemented. New waits require canonical owners and review
intervals; historical fields remain readable. Task activation is independent
of `--cron`; that flag selects optional schedule producers.
The one-lifecycle change (#158) supersedes finite stop and failure-count
limits; explicit input returns (#164) supersede implicit parent waits/wakes.
These contracts were checked against Host `8026aff9`; #167 further shares
workflow failure handling without changing Task lifetime. This is source
status, not deployment evidence. App judgment needs separate live evidence.

This page owns the durable Task contract. Retained SDK names such as
`achieve`/`maintain`, `converged` and `stopped` do not select separate lifecycles.
The unmerged [caller-feedback candidate](../proposals/caller-feedback-and-waiting.md)
adds explicit updates while waiting or retrying and factual execution-error returns; those additions
are not part of the merged baseline described here.
[Message Lifecycle](message-lifecycle.md) owns conversational behavior;
[App Contract](agent-app.md) owns declaration and input mapping.

Read the lifecycle below first. Use [the executor contract](#one-attempt-interface)
and [resource reads](#resource-read-interface) as references when implementing an adapter.

## One lifecycle baseline

**Accepted and implemented in merged Host #158/#164.** One Task lifecycle serves
ordinary work, maintenance and Conversation. Deployment is a separate check.

A Task remains open after an outcome: the worker chooses how to proceed; its owner
decides whether to retain, revise or close the assignment. Unfinished failure keeps
reconciling with backoff, without a fixed failure-count stop. Attempts stay bounded.
The SDK retains `achieve`/`maintain` as intent labels, not lifetime rules.
Timers are optional input; quiet Tasks consume no worker or recurring model call.

A caller consumes its exact assignment's accepted outcome, not child closure.
Existing input/generation/result references distinguish it from an old success.
One stable Task executes a Conversation; its Turns use the common attempt fence.
Messages, Topics and Requests remain typed records, with no separate executor.
Request closure needs its current scope and explanation and leaves chat available.

Turn Stop fences one execution/input; a worker's `stopped` result instead
records failure evidence and preserves retry eligibility. Owner closure prevents
new claims and late settlement, retaining unresolved work visibly non-success.
It does not fulfill Requests or implicitly cancel children. Old events cannot
reopen it; new work after closure uses a new linked Task. A conventional close
after a result rechecks current version and pending input before applying.

The [proposal](../proposals/conversation-input-unification.md) owns prerequisite
handling, control scopes, code deletion and migration. Source verification does
not certify App judgment or an installed release.

## One App work path

For Task-based input, the Host stores a caller-correlation request. The App does not
reconcile that inbox record directly; it resolves the input to a task and
reconciles the task. The Host completes the correlated request from the
accepted task result. Conversation and presentation adapters observe that
result independently; transport delivery never gates Task completion.

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

An open Task remains available after an accepted outcome, regardless of mode.
SDK `status: done` describes that outcome, not owner closure; read `closed`
separately. A new ask waits for its own exact answer, while replaying the same
admission must not run another cycle. Closed Tasks and historical immutable
receipts are not reopened by this rule.

For a conversational handoff, the App names the accepted ask in
`followUp.requestId`. Omit `requestUpdates[].taskRefs` for that handoff: the
Host adds the actual Task link atomically during admission. Explicit Request
link additions refer only to Tasks already linked to the Conversation, not
merely focused or proposed work. Omitting links preserves earlier links.

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
Parent links, references and executor names confer no authority.

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

**Candidate boundary:** task-bound `tasks update` is unchanged. Ordinary
`targetTaskId` input remains attach-only and bypasses mapping, so it cannot
revise scope. A typed App policy may instead return desired intent for an exact
existing ID with the caller-observed `expectedGeneration`. Only a saved
non-delegated inbox input receives App-only revision authority; task-bound,
foreign, missing, closed, and stale targets terminate with readable correction
feedback rather than an unbounded recovery retry. Exact accepted admission
replay remains idempotent, but the same identity cannot authorize changed
requirements. This paired Host/App behavior remains a source candidate until
reviewed, integrated, deployed, and observed separately.

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
[comparison](../proposals/conversation-input-unification.md#which-differences-are-real)
explains how the target separates accepted outcomes, availability and closure.

## Selecting the attempt mechanism

Agent selection is:

```text
task.agent ?? nearest explicit ancestor agent ?? app.agent
```

If the Task names a workflow, that exact workflow is the selected handler.
An unavailable agent, workflow or executor preserves visible failure and retries
the same Task with backoff. It does not silently select another executor.
Rejected handler output, explicit workflow blockers, thrown errors and timeouts
also retain unfinished input and pace another attempt. A function or notification
still named `attention` does not imply a permanent stop: inspect stored phase
and retry eligibility. Only explicit workflow `needs-agent` requests a handoff.

Workspace preparation failure is a failed prerequisite, not a handler
execution failure. Preserve it as `WorkspacePreparationFailed` and do not invoke
the handler in that attempt. The same retry policy rechecks the prerequisite;
it does not prove an unchanged failure is transient. An owner can repair or
revise the assignment, pause it, or close it. Exact, generation-fenced retry can
recheck sooner without replacing the Task or erasing earlier attempt evidence.

These distinctions are implemented in current source. Deployment evidence must
identify its release separately. Retry policy does not establish that every
repeated provider failure is transient.

Human/control Task detail, list, and App counts must select the current Task
generation. A historical completion receipt is evidence about that generation,
not authority to hide a newer live generation or prevent its fenced retry.
Same-generation completion still supersedes a stale live row. Cancellation
keeps its own durable authority and fence.

A workflow may explicitly return `needs-agent` after exhausting its bounded,
safe moves. That creates at most one sequential agent attempt for the same
task. Work for another App is a typed Runtime-managed task dependency, not
`needs-agent`.

## Result contract

The source [Task types](../../../may-agent/packages/sdk/src/task.ts) and
[result admission](../../../may-agent/packages/sdk/src/task-contract.ts) define
the executable contract. A result supplies `state`, `summary`, `facts`, and
optional bounded `result`, caller `response`, Task `actions`, Conditions, and
`TaskAppDependency` entries. `actions` are Task changes, not App commands.
When a file materially supports a completion or recovery claim, the result should
retain a structured verified Artifact reference such as
`artifacts: [{ path, sha256 }]`. A prose path is not discoverable by bounded
public evidence read-back. Use the shared `EvidenceStore` when writing new
evidence, or ordinary hash tooling for an existing authoritative file; the hash
binds bytes, not source authority or semantic truth. See the
[checked wait example](../examples/app.ts).

| Outcome                                                                                 | Runtime disposition                                                                                                                                                                |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valid `converged` result                                                                | Accept the exact input's outcome when current-input fences, evidence, actions and verification permit; keep the Task open                                                          |
| Valid `waiting` result                                                                  | Retain exact external Conditions or typed input dependencies; release execution capacity; structural children alone do not establish a wait                                        |
| Valid `incomplete` result                                                               | Retain unsuccessful attempt facts, report the input's first accepted blocker to its linked caller, and retry unfinished work with backoff; no cancellation or implicit parent wake |
| Workflow `needs-agent`                                                                  | At most one sequential selected-agent judgment for the same Task; no ownership transfer                                                                                            |
| Unavailable agent/workflow/executor or failed workspace prerequisite                    | Visible failure and same-Task paced retry; no silent executor substitution                                                                                                         |
| Invalid/rejected handler result (including self-unblock) or explicitly blocked workflow | Preserve diagnostic evidence and unfinished input, reject proposed effects and retry with pacing; not an accepted answer                                                           |
| Thrown execution error or timeout                                                       | Same-Task execution-failure recovery, subject to its retry policy                                                                                                                  |
| Stale generation, resource version or unseen-input fence                                | Reject stale effects; reread current state without replacing accepted state or releasing another attempt                                                                           |
| Durable cancellation                                                                    | Retain cancellation, interrupt the exact attempt and reject its later stale result                                                                                                 |

Unknown result fields are rejected. `needs-agent` is workflow-only. A waiting
result may retain a bounded typed judgment in `result`; later attempts read it
without reconstructing state from prose. A result may explicitly
`retire-condition` only for one Condition currently linked to its own Task and
must cite that Condition's observed generation plus non-empty result facts. This
removes the Task's obsolete link; it does not assert that the external event
occurred, mutate a shared Condition for another Task, or clear unrelated waits.
Omission preserves waits, and stale generation or newer-input fences reject the
whole result. A waiting result may instead carry one absolute `reviewAt` when
reconsideration itself is due but no external fact is awaited. Runtime persists
that deadline with the accepted result and exact outstanding input, schedules it
through the ordinary recovery index across restart, and permits an earlier event
to wake the Task without consuming the deadline. Reaching `reviewAt` only makes
a new attempt eligible; it never satisfies a Condition, bypasses normal failure
backoff, or answers the caller. An early sleeping re-wait that omits `reviewAt` retains a
future deadline; after it is due, sleeping again requires another Condition or a
new future deadline. `continue: true` instead requests immediate bounded work and
requires no invented wait. A failed verifier cannot establish completion. Result settlement,
including newer input, uses the fences described below; this table does not override them. The [wait-recovery candidate](../proposals/task-wait-recovery-20260918.md) returns inputs with obsolete waits for reconsideration without satisfying replacement or unrelated waits.

`incomplete` requires a summary and non-empty facts; it cannot include actions, Conditions
or child App requests. The Host checks eligibility inside the fenced transaction.
It ends only the attempt, without fulfilling the input or a linked Request.
The same Task remains pending. Turn Stop and owner closure are different
controls: closure fences future work; work after closure needs a new linked identity.

Creating follow-up work does not complete the current task. Required
decomposition uses typed dependencies and returns `waiting`; independent later
work may be a successor only after the current outcome is actually accepted.

**Candidate contract:** `waiting` with `continue: true` requests one more bounded
pass on the same Task while retaining unanswered input and every independent
wait. It requires non-empty progress facts, but not a newly submitted dependency:
continuation is an immediate scheduling request, not a claim that an external
fact is outstanding. It may coexist with `report: true`, which selects a new
caller-relevant update without changing scheduling or wait state. Omitting
`continue` means the attempt sleeps, so a saved Condition, typed dependency, or
future `reviewAt` must provide a real return route. Facts make the request
auditable; they do not prove progress or replace the existing attempt/resource
bounds and owner review.

The SDK's `admitTaskReconcileResult` is the single pure semantic validator for
agent and workflow results. Executor finish paths call it before terminating so
an invalid proposal returns correctable feedback; fenced settlement calls it
again before applying effects. The pure validator knows only the proposed result.
Settlement remains the authority for current generation, attempt, pending-input,
creator, Condition and persistence checks. A schema, executor adapter, or recovery
path must not define a narrower competing interpretation.

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

Ordinary checks and repairs can run inside the workflow before it returns.
The Host's final verifier runs after that invocation has ended; rejection records
a failed attempt rather than re-entering that invocation. Unfinished input retries
on the same Task with current evidence and backoff; verification failure cannot
be used as an accepted answer.

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
[workflow wait semantics and implementation status](workflows.md#a-wait-reason-is-not-an-exclusive-event-filter).

Condition declarations are identity-scoped deltas, not snapshots. A distinct ID
adds an obligation; the same ID may update its complete specification while
preserving unrelated Conditions, dependency links, failed-operation facts,
selected reports and pending input. Omission and an empty declaration list mean
no change. Satisfaction or generation-fenced retirement names the exact
Condition; retry, failure, unblock, dependency repair, wake or ordinary
reconsideration never clears peers. Retained legacy rows remain readable without
being revalidated as newly authored declarations. A changed specification starts
a new generation and cannot inherit an older approval. Condition `reviewAfterMs`
checkpoints renew after an accepted review while the fact remains pending.
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
Historical records remain evidence only: they never replace the current result,
certify recovery, satisfy an obligation, or create a second evidence lifecycle.

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
See [duplicate handling](events.md#duplicate-delivery-and-safe-reconsideration) for Host/App duties and Host #175.

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

## Modes and phases

Phases are:

- `pending`: desired state needs another attempt;
- `running`: one current attempt owns the generation;
- `waiting`: exact Conditions or typed input dependencies remain;
- `attention`: retained diagnostics or an explicit handoff/Turn Stop; eligibility
  depends on its reason and input, not this label alone; and
- `converged`: an accepted outcome with no currently eligible input.

`achieve` and `maintain` are retained intent labels. Both leave the Task open
after acceptance; neither automatically removes it from the live graph. Exact
accepted attempt/input references remain readable after later input. Owner
closure is separate from phase, so `converged` alone does not tell whether new
work can be admitted. An observation during an attempt stays pending for a
later bounded pass unless explicitly consumed by its admitted result.

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

Remote workspace preparation fetches the base and optional published Task
branch into Task-generation-specific Git refs, without updating shared
`origin/*`, tags, or `FETCH_HEAD`. Worker subprocesses do not share the Host's
in-process repository lock, so sharing their mutable fetch destinations is not
safe synchronization. Each preparation reads its own base snapshot; refreshing
that snapshot must preserve the existing worktree, head and recorded original
base commit. These refs are Git preparation metadata, not another Task store
or a claim that retained work is integrated.

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
[controller proposal](../proposals/task-controller-pattern.md).

Retained legacy attention marked `previous-runtime-attempt-not-recoverable`
is repaired into eligibility for the same Task and generation. This known
mechanical repair does not require an App `owner-review` input or an LLM
instruction. Other attention reasons retain their existing handling. The
[core policy cleanup](../proposals/authority-boundary-simplification.md#core-policy-cleanup)
removes the obsolete fallback that followed this repair; old notification
metadata needs no migration.

The former fixed retry limit in #107 was superseded by #158. Persisted execution
failures back off from 250 ms to a maximum 15-minute interval, without abandoning
the assignment after a count. Fresh human input permits one earlier attempt;
ordinary wakes do not waive backoff. Dispatch errors before failure persistence
use the controller's local 250 ms–30 second pacing instead. These are different
boundaries, not competing Task lifecycles. Backoff limits frequency, not total
spending; the owner can revise, pause or close work that is no longer worthwhile.

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

The parent relay and App message pump yield through I/O-capable timer turns.
A continuing background backlog leaves a small nonzero poll window before its
next item. Neither `setImmediate` nor a permanent zero-delay timer chain is a
fairness boundary in the deployed Bun runtime; both can starve the Unix control
socket even though every callback is nominally asynchronous.

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

The worker is owned by that Runtime process. A private IPC channel closes
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
work. The old JSON importer is retired.

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
    Direct non-App execution such as CLI experiments and Gym stays independent.
12. Resource-backed Task contention never uses a synchronous filesystem wait,
    and slow Task I/O cannot delay event admission or resource reads.

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
progress or findings, and returns a proposed result, an exact external wait or
a truthful blocker. The Host admits the returned result. Internal model turns
and bounded work/check/repair iterations are not new Task attempts. `onEvent` is
an optional low-latency view of new durable Task input such as feedback,
approval, steering, or cancellation.
The listener's attempt-local `accept` consumes the exact input only with an
admitted result; the next attempt still receives it if the executor cannot
incorporate it live. New input does not invalidate facts or completed work.
The Runtime retains no-action output and open waits, but defers terminal
judgments until the newer input has been considered. Results proposing Task
actions remain atomic with those actions; unseen input still fences the batch.
It preserves the clean workspace for that next pass. Cross-App dependency
publication still requires current accepted input. The Runtime owns fencing,
leases, event persistence, result admission, and recovery, so an executor
implements no scheduler, queue, retry loop across Task attempts, or Task storage.
Bounded repair inside one execution follows the
[workflow repair convention](workflows.md#repair-within-an-attempt).

`signal` stops current execution resources, including on fenced Turn Stop or
owner closure. Adapters translate it into managed-session cancellation,
workflow-step cancellation, Codex interruption or CLI process-tree termination.
The signal does not replace durable controls or result-admission fences, and
aborting an attempt alone does not close its Task.

Every adapter receives the same bounded Task detail and ordered event batch,
may publish a fact through the current generation/attempt fence, and returns
one `TaskReconcileResult`. An event addressed to `{ appId, taskId }` is durable
feedback, approval, or steering for that Task. Live forwarding is optional:
managed sessions support it, while a headless CLI that cannot accept a live
message receives the event on the next attempt.

Runtime creates one fenced attempt and gives it to the selected adapter.
Omitted or `agent` selects the managed-agent adapter. For another name, a Host
registration takes precedence over the built-in `codex` and `claude` adapters.
A missing name records visible failure and paced retry. Selection never creates
another scheduler or recovery system.

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
The Task view supplies progress and diagnostic detail. Input handling and
conversational Request fulfillment remain distinct; see
[Message Lifecycle](message-lifecycle.md#requests-acceptance-and-closure).

## Resource read interface

The transport-neutral `tasks.list`, `tasks.get`, and opt-in `tasks.outcomes`
contract, scope bindings, pagination, human-action projection, and write
boundary are specified in [Task resource read interface](task-resource-read-interface.md).
Exact reads remain backed by canonical Task state; adapters do not create a
second model or mutation authority.
