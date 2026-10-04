# One Task lifecycle

> Historical record. Status, revisions and deployment observations below belong
> to the recorded review or trial, not the current installation. Follow the
> linked owning contracts for current behavior. Open limitations remain evidence;
> archiving this record does not establish that they were resolved.


**Supports:** [System Model](../../2a-design/system-model.md). Explains and tests one durable lifecycle for conversation, ordinary work and maintenance.

**Choice basis:** [Applicable philosophy and convention](../../1-principles/core-principles.md#review-rule); [compare competing choices](../../1-principles/core-principles.md#resolve-conflicting-designs).

**Status:** Accepted design baseline, refined September 12, 2026 and implemented
in Host source through #158 and its follow-up cleanup. Use one Task model,
controller and lifecycle: explicit outcomes, rest between inputs, and
owner-controlled closure. Human conversation, delegated work and maintenance
describe roles and inputs within that model. Full local CI, live nested
delegation and an isolated old-to-new daemon cutover passed for the source
candidate. The [critical-path acceptance audit](controller-poc-recovery-review.md#critical-path-acceptance-audit)
records retained compatibility costs and deferred usage checks. Dated migration
inventories below are historical; installed release adoption remains separate.
The [deeper review](controller-poc-deeper-review.md) tests natural delegation,
owner withdrawal and changed acceptance during execution. It also simplifies
additive delegation and examines the recurring cost of retries.
This supersedes the earlier recommendation to
share only scheduling while keeping two execution lifecycles.

May should discuss and work with the human while delegated work progresses,
then return useful outcomes without repeated reminders. The same loop should
serve a Task that delegates smaller Tasks. The goal is fewer execution,
settlement and recovery paths, with understandable controls and acceptable cost.
[Message Lifecycle](../../2a-design/message-lifecycle.md) owns the user experience;
[Task Resource Engine](../../2a-design/task-resource-engine.md#one-lifecycle-baseline)
owns the target lifecycle and distinguishes it from the implemented protocol.

## Recommendation and value

**The goal is a simpler mental model realized through one execution and return
path.** Review each change by the concepts, decisions and parallel paths it
removes. Human messages, delegated results, relevant facts and timer signals
enter the same loop: durable input → reconcile → record outcome → return as
input to the interested owner. Their origin changes context and App judgment;
it does not introduce another lifecycle or coordination protocol.

Convergence requires migrating consumers and retiring their replaced paths.
Shared names or wrappers alone leave that work unfinished. For every remaining
split, identify the user scenario that needs it and compare its value with the
cost of keeping another mechanism. Breaking contracts and dropping low-value
behavior are acceptable when the remaining scenarios stay correct and useful.
Keep App-specific judgment and presentation at the edges; code owns correlation,
scheduling, persistence and return. The next priority is the remaining return
paths, with line-count reduction serving as supporting evidence.

Evaluate capability as part of that comparison. For the same user scenario,
record what remains possible, what becomes harder or unavailable, and who pays
the difference in execution, delay or human effort. Apply the
[value/cost and time-horizon rules](../../1-principles/design-philosophy.md#value-and-cost):
compare gained value and avoided costs with lost useful capability, migration,
ongoing costs and failure risk. Simplicity and convergence earn their value by
helping the project deliver useful results at acceptable total cost. A shared
path that repeatedly needs manual workarounds may be a worse tradeoff.

**Persist input, wake its Task, reconcile current state, commit an outcome, and
release execution. Run again for relevant pending input or justified recovery.
An authorized owner decides when to close the Task.**

Use **Task** as the execution model throughout the design, code and review.
Any Task can receive relevant input, delegate work, judge returned evidence and
respond. For example, Task A handles human input and delegates work to Task B;
B may delegate again. Their handlers receive the context and capabilities needed
for their assignments. Conversation names human interaction with a Task:
messages, Topics and Requests preserve that context within the same execution
loop. These capabilities do not select a Task category or lifetime.

```text
Human input / child result / relevant fact / optional timer
                            |
                   durable input + exact Task
                            |
                            v
                   one Task controller
                  claim a bounded attempt
                            |
                            v
                  App-selected handler
                 (agent, workflow, etc.)
                            |
                            v
             validate and commit outcome + evidence
                            |
                +-----------+------------+
                |                        |
          notify interested owner     release execution
                |                        |
          same input loop          rest or handle pending input

App / parent agent / human -> explicit close -> fence execution and future wakes
```

A retains the human interaction's messages, Topics and accepted Requests.
A Turn names its bounded attempt in the interface. Do not create a Task per
message or per Request. Independent delegated work gets its own Task, so B can
progress while A handles more input. A and B each have one claim and retry
authority in the same controller.

Use A → B → C → B → A to review composition. A can receive human input; B can
delegate again and judge C's evidence. Each is a Task using the same controller.
An App boundary chooses ownership and capabilities, not a different delegation
protocol: typed input may create another Task in the same App or another App.
Code owns admission, return links and wakes. The worker states the needed
outcome and acceptance, then judges the returned evidence.

Automatically return an answer, honest failure report or owner closure.
A saved wait is progress that remains available to read; it does not itself
start another caller attempt. This is the same rule for every Task. It avoids
model work to supervise an already recorded wait or recheck routine admission.

The source candidate now enforces the quiet-wait rule for typed App dependencies
as well as Topic-linked follow-up. Task outcome and closure events refresh both;
there is no separate automatic dependency-progress relay. Typed inputs still
await an answer or owner closure while failed work retries, with failure evidence
available to readers and scheduled review. Topic-linked observers also receive
accepted failure reports. That remaining return-contract difference is recorded
in the [cleanup review](controller-poc-deeper-review.md#one-task-notification-no-automatic-retry-relay);
one lifecycle does not yet mean one saved caller-link implementation.

An App, parent agent or human already managing work can be its closing owner.
"External" means outside the assigned worker's authority over this assignment,
not another service or process. The worker chooses **how to do the work**; the
owner chooses **whether to keep assigning it**, change its scope or close it.
An App may supply both worker guidance and owner policy, but a worker's failure
report does not grant it closure authority. No new role registry is needed.
The worker can recommend revising or dropping the work and explain why. That
recommendation is evidence for the owner, not an applied decision. Changing
approach stays within the assignment; rewriting its outcome or acceptance
criteria changes the assignment and belongs to the owner. The same agent can
be a worker for its own assignment and an assigning owner for delegated work.
Do not ask the worker to reapprove its assignment on every wake. Give it the
assignment, constraints and current evidence so it can concentrate on how to
make progress. Reporting a blocker or recommending a scope change is useful
judgment; deciding to abandon the assignment remains the owner's decision.

## Agent judges; controller carries it through

The controller exists to remove procedural work from the agent. Give the agent
the current ask, relevant evidence and unresolved decisions. It judges what is
useful next; code carries out that decision and brings back the next relevant
input. A short prompt is not enough if the agent still has to remember the
follow-through procedure.

| Agent/App judgment | Code-owned process |
| --- | --- |
| Is the evidence sufficient for this ask? | Validate and retain the outcome against the exact input and attempt |
| What independent work is needed, and what would count as success? | Admit the child, save its return link, schedule it and return its outcome |
| Does this new fact change the answer or remaining work? | Route durable input and construct the next context, even after restart |
| What approach should the worker try next, and what help does it need? | Retain unfinished work and evidence; schedule another bounded attempt with backoff or an exact wait |
| Should the owner keep the assignment, revise its scope or close it? | Validate and apply the owner's explicit control; a worker report cannot exercise that authority |
| Has the accepted human ask been resolved, and how should we explain it? | Commit the explanation and Request closure together; deliver through the interface |

For example, the agent asks for a measurement and states the acceptance rule.
Code records and runs that work, then returns its accepted evidence to the
caller. The caller judges whether the measurement answers the ask. It never
has to poll the child, register a subscription, copy a lease/version, or remember
to revisit the work later. If the assigning App has a convention to close a
child after consuming its result, code can apply that owner decision without
an extra model turn.

Do not call the model to implement a known state transition or repeatedly ask
whether an unchanged Task should keep waiting. Do not make the controller
invent a scope change, judge uncertain evidence or declare a human ask satisfied.
If a model trial needs procedural coaching to complete the loop, simplify the
contract/context or fix the missing controller behavior before adding prompts.

A valid "I could not do it" report is an attempt outcome, not a provider error
or permission to abandon the assignment. Preserve it and return it to the
owner, while retaining the unfinished work for later reconciliation. On its
next eligible wake, the worker reads that evidence and continues trying within
the assignment. It need not wait for an owner to explicitly unblock each failure.
Only the owner can accept abandonment or change the assignment. Agents should
not have to use a false success label to make code retain an honest report.

Choosing **which ask an answer resolves** is also judgment. Reading an input,
handling an event or finishing a Turn does not establish that every outstanding
ask is answered. Conversation already has typed Request decisions for this;
reuse them instead of inventing another generic obligation lifecycle. The
controller preserves the links among the accepted ask, delegated work and
returned evidence. It must carry those links across attempts and intervening
input, without asking the agent to repeat an admission ID or rebuild a wait.

Prioritize this critical path: human input wakes A; A delegates to B; B delegates
to C; A remains available for discussion; C's evidence returns through B to A;
A replies and resolves the accepted ask. A, B and C all use the same Task loop.
A quiet Task holds no running agent. After an outcome, fresh relevant input can
wake that same Task again; only its authorized owner closes the assignment.

The [live nested trials](controller-poc-recovery-review.md#nested-delegation-uses-the-same-task-loop)
pass this path with the actual May App declaration and role instructions, real
model judgment, and a reduced tool catalog. Both an above-threshold measurement
and an unchanged below-threshold variant return the correct assessment, preserve
the evidence caveat, fulfill the original Request and leave all three Tasks open.
Fresh input also executes after runtime/storage reopen. Independent collection
and review were explicitly requested; unprompted decomposition was not tested.

The [evidence record](controller-poc-recovery-review.md) owns source revisions,
failed trials, focused checks, full-suite results and migration details. It also
tracks removal of the old execution owners, the passing isolated
[daemon cutover](controller-poc-recovery-review.md#real-daemon-cutover), and the
completed [critical-path acceptance audit](controller-poc-recovery-review.md#critical-path-acceptance-audit).
Human review should now assess the unified lifecycle, retained compatibility
costs and adoption order. Broader usage and installation rollout remain outside
this proof. Message and reply boundaries have their own checks within the same
claim, retry and closure authority.

### Recovery keeps the same Task

Neither an execution error nor an accepted failure report ends the Task's
responsibility. Retain the assignment, unresolved input and evidence. Release
the attempt and arrange its next reconciliation through the same controller.
An event can report a changed prerequisite; a due timer provides another chance
to make progress if no such event arrives. The worker should not manage polling,
retry counts or routine unblock lists.

**Use backoff, not a fixed failure-count stop.** Repeated failure increases the
delay to a practical maximum interval; it does not make the Task ineligible
forever. Persist that deadline and check it before claiming, so duplicate wakes
and restart cannot shorten it. Reuse existing due queries and the recovery timer.
Counters inform pacing and diagnostics, not the controller's decision to give up.
Ordinary failure must not end in "four attempts, now require manual unblock."

The refined candidate starts at 250 ms and doubles to a **15-minute ceiling**
for Task attempt failures. The earlier 30-second ceiling could sustain 120
attempts per hour for one quickly failing Task. Dispatch/storage failures before
an attempt has been durably settled keep their separate local 250 ms–30 second
pacing. Neither path has a failure-count stop. This accepts slower unattended
recovery after a long outage in exchange for lower recurring cost; an owner
retry or fresh human input can act sooner. See the [cost calculation](controller-poc-deeper-review.md#retry-cost).

**New human input permits a fresh attempt.** A newly admitted human message
waives the current cooldown. If it arrives during execution, the next claim
still gets that opportunity after failure. Persist the opportunity with input
admission and consume it at the next claim, including a failed capability check.
Keep the consecutive failure count: another failure increases the next delay.
Duplicate admissions, automatic facts, timers and an App's `humanRequested`
annotation cannot manufacture a fresh human message. Capacity and owner controls
still apply.

This is one Task-wide retry policy with a human-input exception, not independent
retry deadlines for every ask. The fresh attempt receives pending context and
may reconsider earlier failed work sooner. That affordable redo keeps discussion
responsive without per-input retry bookkeeping. It does not discard the old ask,
fulfill its Request or authorize repeating uncertain effects. See the
[responsiveness checks](controller-poc-recovery-review.md#fresh-human-input-during-retry).

Bound each attempt and concurrency. A spending or pause instruction explicitly
set by the owner remains enforceable; it is different from an arbitrary core
retry-count policy. Backoff reduces spending rate, not total spending over an
unlimited lifetime. Accept that tradeoff explicitly: existing failure events,
attempt history, last progress and next retry time let the owner notice and
intervene. No new recovery App, escalation ladder or metric service is required.

Retry means **reconcile current state again**, not blindly replay the failed
commands. Cheap safe work may be redone. Inspect durable evidence or receipts
before repeating an effect whose duplication matters. When a missing permission
or prerequisite prevents assigned work, report the unsuccessful attempt and the
help needed from its owner; neither a timer nor persistence grants new authority.
An invalid model result is failure evidence for correction, not a reason to
invent a domain blocker or discard the assignment.

A **wait** is for existing work or a fact with a known return route. Recording a
Condition, including its `requestedAction`, does not send a human a question or
perform that action. Its review timer only asks the worker to reconsider. May's
App guidance uses `stopped` for a missing prerequisite that prevents progress;
this preserves an honest failure report and paced continuation, not closure.
The [first caller-feedback slice](#first-caller-feedback-slice) returns accepted
blocker evidence through nested typed input as well as Topic-linked work. Its
App guidance must distinguish an unavailable prerequisite from a finished
one-shot diagnostic; a passive wait still does not notify a human.

Code retains unchanged waits when an agent omits them. An accepted review must
renew an overdue checkpoint identically whether the wait was supplied again or
retained, without changing the awaited fact or postponing a future deadline.
The [capability probes](controller-poc-deeper-review.md#capability-and-owner-help-probes)
found and reproduced both the hidden help request and an immediate-repeat bug
in retained wait scheduling.

The acceptance boundary is the Task settlement transaction. A finished agent
session without a committed Task result is retained evidence; after ownership
and process cleanup checks, retry the same input through normal execution and
validation. Do not reconstruct a second result-acceptance path from the session
artifact. Already accepted Task results survive restart without another attempt.
This deliberately accepts possible extra execution cost in the gap before
settlement; the [source simplification review](controller-poc-deeper-review.md#first-removal-retry-uncommitted-execution)
records the deletion and tests.

Core owns claims, timing, fencing, retained evidence and notifications. The App
supplies worker judgment about diagnosis and the next useful approach. Its
assigning owner judges continued value, scope and closure. Put those instructions
in the existing App task/role context; do not add a configurable recovery-prompt
framework or require an owner model turn for every retry.

A shared executor may explain that an attempt was interrupted, what evidence
was retained and what execution allowance remains. It must not demand an
immediate final answer or select a domain repair plan. Keep the existing bounded
continuation mechanism small rather than nesting another model recovery loop.
A saved failure report is accepted evidence, but it does not mark the original
assignment fulfilled or erase its future retry eligibility.

The [review of PRs #153–#155](controller-poc-recovery-review.md) applies these
rules to their actual changes and records the durable-retry source checks,
live worker trials and remaining gaps.

## One lifecycle, explicit outcomes

| Fact | Meaning |
| --- | --- |
| Attempt ended | Bounded execution returned or stopped; this alone establishes no success |
| Accepted outcome | A validated report for the exact work considered: progress, an answer, completion, a wait or failure; accepting failure does not resolve the assignment |
| Task is quiet | No eligible work is pending; the Task remains available for later input |
| Task is closed | An authorized owner ended further execution; history and accepted outcomes remain readable |
| Request is closed | May resolved the accepted human ask and recorded its explanation; this does not close the conversation Task |

These are meanings, not a proposed five-state enum or new public result schema.
Keep bounded execution, exact waits and visible failure evidence. Remove the
core's need to infer whether being caught up means the responsibility has ended.
A result never silently closes its Task, and closure never manufactures success.

Ordinary work uses a simple owner/App convention: accept evidence that satisfies
the assignment, make it available to its caller, then request closure when no
further input needs handling. Do not apply this convention to every accepted
report: failure leaves the work unfinished. A declared acceptance rule needs
no extra human approval or model call. The Host checks the current version and
pending input before applying that request, so
an old result cannot close over a newer correction. Maintenance and Conversation
usually stay open; their owners close them when appropriate. Timers are optional
for any Task and do not define a separate mode.

Parent readiness follows the accepted outcome of the exact delegated work,
not whether the child's resource is closed. Reuse current admission IDs,
generations and result references: an old successful result must not satisfy a
new assignment to the same open Task. A useful child result can wake its parent
while the child remains open for follow-up. Progress may prompt review but cannot
satisfy a request for completed work. The parent judges its own outcome.

Closure durably prevents new claims and fences late output before attempting
to abort active execution. It retains unresolved work with a visible non-success
disposition and makes that disposition discoverable to existing linked callers.
It does not delete evidence, declare Requests fulfilled, undo external effects,
or recursively cancel independent children. Owners explicitly decide which
children to close; their results remain readable if the parent is already closed.
A duplicate close is harmless. Old events and timer ticks cannot reopen a closed
Task. Start with a new linked Task for genuinely new work after closure; omit a
general reopen protocol.

An open but quiet Task consumes stored state, not a worker or recurring model
call. Being caught up permits rest; an unfinished failed assignment remains
pending behind its retry deadline or prerequisite wait. A failure report cannot
silently make it permanently quiet. Safety queries select pending work, due
waits/retries and interrupted claims; open status alone is not eligibility.
Forgotten quiet Tasks can remain stored initially. Optional retention policy may later close or archive them,
with unresolved asks accounted for; it is not required for execution correctness.

## Which differences are real?

| Capability | What it contributes to a Task |
| --- | --- |
| Human interaction | Message context, discussion, replies and tracking accepted asks |
| Delegation | Child assignments and returned evidence for the assigning Task to judge |
| Scheduled observation | Relevant timer input and facts to reconsider |

These capabilities can be combined in the same Task. They are not mutually
exclusive work types. Every Task remains available until its assigning owner
closes it; the App may supply the owner's closure convention.

**Review rule:** a capability may change the context a Task reads or the typed
effects it proposes. Claims, bounded attempts, input continuation, backoff,
result return and owner-controlled closure use the same lifecycle. Explain
special handling through a concrete input or effect requirement. Do not use
"conversation versus task" as the architectural boundary or add a lifecycle
branch merely because a Task talks to a human.

Long lifetime, delegation, waiting, several asks and timer input do not require
separate controllers or an `achieve`/`maintain` switch. The remaining differences
belong to input, outcome and control semantics within the same engine:

| Needed distinction | Smallest sufficient treatment |
| --- | --- |
| Input handling and human fulfillment | Retain input correlation and Request revisions; closing an ask needs its explanation, not just an ended attempt |
| Stop one execution and close its Task | Esc/Stop fences the exact Turn/input; later human input remains possible. Explicit Task closure ends future execution |
| Background pause and interactive work | Keep pause scoped to background work; a shared Task engine must not disable human discussion when background attempts are paused |
| Required result and subscribed update | Check prerequisites for the action/result they constrain; a follow-up link must not block unrelated input or the next human Turn |
| Ordered input and coalesced wake | Retain input identities and all unhandled outcomes; a queue key is only a hint |
| Failure of work and availability of its owner | Pace attempts for failing work; fresh authorized input remains actionable without erasing failure evidence or blindly repeating the failed operation |
| Human execution and automated review | Select existing capacity lanes from trusted input origin and execution purpose; Task identity, App name and priority do not grant the human reserve |

Messages, Topics and Requests remain product records. They need no private
scheduler, lease or retry loop. One Task result envelope can reference typed
conversation decisions without flattening every record into a universal schema.
Code validates revisions, identity, acceptance and closure authority; the
worker judges the approach and evidence; the assigning owner judges whether
to retain, revise or close the assignment.

## Historical migration inventory

The table below records the boundaries reviewed before the source candidate
landed. It is retained to explain the migration and is not current implementation
status. The [evidence record](controller-poc-recovery-review.md) tracks what the
candidate implemented and verified.

| Source boundary | Historical change to prove |
| --- | --- |
| [`core/tasks/controller.ts`](../../../../may-agent/src/app/core/tasks/controller.ts) and [`queue.ts`](../../../../may-agent/src/app/core/tasks/queue.ts) | Reuse queue, capacity wait, wake-during-run and drain; extend execution controls without a parallel Conversation controller |
| [`composition/app-inbox-runtime.ts`](../../../../may-agent/src/app/composition/app-inbox-runtime.ts) | Direct input admission, events and bounded admission/result recovery; the inbox execution pump and its capacity lane are removed in the source candidate |
| [`core/state/app-inbox-store.ts`](../../../../may-agent/src/app/core/state/app-inbox-store.ts) and [`core/inbox/app-inbox-host.ts`](../../../../may-agent/src/app/core/inbox/app-inbox-host.ts) | Retain input identity, caller correlation and readable historical evidence. Task admission owns execution; no inbox claims or lease renewal remain in production |
| [`core/tasks/app-task-reconciler.ts`](../../../../may-agent/src/app/core/tasks/app-task-reconciler.ts) | Remove mode-dependent completion/reopening/stop rules after explicit outcome and closure behavior works. At the time of this inventory, `achieve` could not converge with live children, generic cancellation rejected `maintain`, and handler `stopped` was restricted to finite leaf Tasks |
| Former `core/state/conversation-outcomes.ts` boundary | Reuse Request revision and explanation checks inside fenced Task settlement; retire the supervisor's separate projection/response path |
| SDK types, readers, cleanup and App removal | Audit consumers of `done`, `converged`, receipts and mode. Accepted result, pending work and closed resource must stay distinguishable; an idle owner must not pin capacity or an execution workspace forever |

Current `dependsOn` blocks attempts while unsatisfied. The target needs result
waiting that leaves the owner available for other eligible input. Existing child
and Topic/Task links provide the starting point; do not preserve a whole-owner
execution block merely to reuse its current code. Account for the action whose
prerequisite is missing and reject unsupported success claims.

Keep Task-wide durable backoff and exact input/attempt identities. New human
admission permits the fresh attempt described above; Stop applies only to the
observed Turn/input. Separate retry counters for every ask are unnecessary for
this contract. Do not rename `maintain` or add a hidden conversation mode to
retain the same lifecycle branches.

## Options and their cost

| Choice | Assessment under the accepted baseline |
| --- | --- |
| One Task execution lifecycle, explicit outcomes and owner closure | Accepted and implemented: duplicate execution authority and mode-specific lifetime rules were removed; retained-state compatibility remains historical evidence |
| Share only scheduling | Rejected as the destination because it retained duplicate execution authority |
| Unify only Conversation's human/Task/timer inputs | Rejected as incomplete because it retained duplicate claims/recovery and mode-dependent Task lifetimes |

For this frequently used foundation, reduced long-term maintenance and fewer
failure paths can justify a coordinated migration. The accepted tradeoffs are
quiet retained Tasks, bounded response delay, affordable safe redo, and fewer
unsolicited progress or drift investigations. We do not need automatic lifetime
judgment, automatic reopen, precise resumption or a preemption engine.

A large code or reliability improvement is a hypothesis until a source slice
removes old paths and passes the checks below. If the implementation grows mode
switches or callbacks at every phase, reconsider the expensive contract and
narrow the slice. Do not add a universal controller framework for symmetry.
Apply the [value/cost rules](../../1-principles/design-philosophy.md#how-to-decide-a-tradeoff).

## Delegation uses the same return loop

```text
Human input wakes Task A
  -> A delegates to B; A remains available for discussion
  -> B delegates to C
  -> C commits an outcome -> event wakes B
  -> B judges C's evidence and commits its outcome -> event wakes A
  -> A explains the result and resolves the appropriate Request
  -> A, B and C rest, available for relevant input

An authorized assigning owner may close its delegated Task independently.
```

Conversation is the human interaction with A. It adds messages, Topics and
Requests to A's context, with no separate controller or work category. B and C
use the same input, attempt, outcome, retry and closure rules.

A child result is evidence, not automatic parent success. Failure, closure
without success and a need for human input return through exact saved links too.
No owner keeps an execution slot merely to wait. A saved result subscription
is enough for follow-up; no per-Task watcher or generic dependency graph is added.

In the source candidate, new assignments use typed App input through
`TaskReconcileResult.dependencies`; workers no longer return `create-task`.
The destination App owns the Task specification and execution choice. Existing
Task revision and closure controls remain. The
[raw-creation retirement](controller-poc-deeper-review.md#retire-raw-worker-creation)
records the breaking SDK change, remaining App migration gates and scenario
coverage. Retained parent/child waits and Topic observations still have distinct
return behavior; the diagram describes the common mental model, not completed
storage convergence. The first caller-feedback slice below returns failure
evidence without answering unfinished input. Topic observation and typed input
correlation still have different storage and admission rules.

### First caller-feedback slice

Implemented in Host **`860f3a2e`**, with live trials and tradeoffs recorded in the
[deeper review](controller-poc-deeper-review.md#nested-caller-feedback-poc).

Return the first accepted unsuccessful attempt as feedback through the exact
input's saved caller link. Keep its input unfinished and its Task open; a later
answer or owner closure still returns through that link. Rename the existing
dependency event to `app.dependency.updated`: `blocked` asks the caller to judge
evidence, while `done` satisfies its wait. A failure is not an answer.

Persist the first report's attempt reference alongside the input's eventual
answer reference in the acceptance transaction. Reuse that evidence for live
delivery and recovery. The caller's saved Condition remembers the report, so
repeated retry outcomes or notification recovery do not cause repeated caller
attempts. The original input accompanies its returned evidence, including when
the caller itself has a caller. Existing Topic follow-up uses the same first
report selection for input-backed work. Seeded Tasks without input admissions
retain their existing per-attempt Topic observations; their notification volume
has not been changed by this slice.

This is deliberately one initial failure report per input, followed by its
answer or closure. Later diagnoses remain in attempt history; a review or new
input is needed to reconsider them. Do not add progress polling, semantic text
comparison or a configurable notification policy. General progress updates and
changed-blocker reporting need a demonstrated use case beyond this first slice.

The live PoC proves C's failure reaches B, B explains the need to A, and the
human can repair the source without replacement work. Repeated C failures do
not add new input to B; B may still retry its own unfinished work under normal
backoff. Eventual success returns C → B → A. A second trial covers a completed
diagnostic: the same collector accepts fresh input after repair, while its old
answer remains intact. Neither an input's answer nor a failure report closes the
Task or automatically fulfills the containing human Request. Deterministic tests
cover lost notification, restart and exact input correlation; existing owner
closure checks remain. Source, costs and limits are recorded in the deeper review. During offline
cutover, rename retained typed Conditions from `app.dependency.completed` to
`app.dependency.updated`, preserve their identities, and restore a first report
only when an accepted attempt proves its exact input. Historical journal entries
remain unchanged; saved-state recovery supplies missed feedback.

New delegation **adds work**. Omitted saved waits remain attached, so adding
another request to the same App does not require the worker to repeat earlier
requests. Exact reuse, duplicate checks and stale-effect fences remain. A new
request does not implicitly replace or cancel an old one; the worker must reuse
an existing assignment when that is what it means. Different wording alone is
not enough for the Host to infer replacement.

## Proposed controller boundary and code layout

Keep existing homes and move authority, then delete replaced code:

| Home | Target responsibility |
| --- | --- |
| `core/tasks/` | One Task controller and bounded attempt lifecycle, readiness, result admission, scoped Stop, explicit close and recovery; no Conversation-specific queue |
| `core/scheduling/` | Existing capacity and timing mechanics; no new scheduling framework |
| `core/events/` and `core/inbox/` | Durable admission, input identities/order and caller correlation; inbox records no longer execute conversation work independently |
| `core/state/` | SQLite Task claims/results/closure and typed message/Request/Topic operations; compose related writes inside one fenced settlement transaction |
| `conversations/` | Replaceable context construction, conversation handler and presentation; returns typed decisions through the Task attempt contract |
| `adapters/` | Existing execution, producer and interface capabilities; none owns an extra work lifecycle |
| `composition/` | Wire capabilities, Task-link routes and bounded timer discovery; no domain judgment or duplicate execution pump |
| `packages/sdk/`, `projects/may.app/` and `agents/may/` | Minimal public contract changes and App conventions; remove the separate follow-up Task declaration and prompt |

Shared execution is not the end of simplification. The
[direct admission cleanup](controller-poc-deeper-review.md#direct-admission-cleanup)
removes ordinary inbox claims, pump, capacity and remapping from the candidate.
It retains input receipts, an exact result projection and bounded recovery of
failed admissions or missed result notifications. The
[saved-answer check](controller-poc-deeper-review.md#saved-answers-and-remaining-scaffolding)
also repairs the gap after a receipt commits but before its completion Event is
published: recovery returns the exact stored answer through the existing
Condition transition. Checkpoint reviews have no count-based final-review label;
closure remains the assigning owner's decision. Delegation still has several
return protocols; the [next deletion sequence](controller-poc-deeper-review.md#next-deletion-in-order)
now removes raw worker creation first, then targets one saved caller link for
those remaining routes.

One controller implementation can serve independent Task keys concurrently.
Do not serialize the Host globally or require generic Tasks to carry Conversation,
Topic or Request data. The conversation handler is optional; absent capability
leaves its retained work visible and unrelated Tasks executable.

## Whole-system fit and deliberate limits

The four core responsibilities remain App admission, Events, State/storage and
Work runtime. Closure is a typed authorized state operation; it needs no event
request/reply server. Events announce meaningful committed changes and wake
interested owners. SQLite transactions enforce local consistency.

Route human input and linked Task facts to the same conversation Task and
handler. Saved Topic/Task links select recipients. Reuse `conversation.task.changed`;
no universal `conversation.wake` wrapper is needed. System facts cannot create
human authority, new Requests or unsolicited scope. Read current Task evidence
and Request revisions; a quiet system outcome needs no chat message.

The optional timer first queries unhandled outcomes or decisions. Start from
the existing 15-minute / 100-link bounds, preserve progress across pages, and
measure actual query cost; these are not a response-latency guarantee. Handle
missed notifications, late links, multiple Tasks/Conversations and new Request
revisions. Preserve handled, stopped and failed-attempt evidence; a timer must
not bypass a persisted retry deadline, an explicit owner pause or closed work.
Required claim/restart recovery remains Host-owned and independent of the
optional timer.

Pending human input has priority over automated reviews; active reviews stay
bounded and stoppable. Background pause leaves conversation handling available.
Use one human Turn per App in addition to its declared background-attempt limit,
all within the Host capacity limit. Both use the same controller and Task claim.
Pending human input earns that allowance; an App name, Task priority or system
review does not. Multiple human Conversations in one App share that single
interactive slot. This conventional bound needs no additional App setting.
No new preemption engine is needed. Stop fences recorded output but cannot undo
an external action already performed; inspect evidence before safe redo.

Persist explanation and Request closure with the attempt outcome, independently
of adapter delivery. Accepted Task results must remain discoverable if the Host
stops before publishing a notification. Existing failure evidence and metrics
are sufficient to investigate latency, repeated errors and idle model calls.
No new metric service, transport or user acknowledgment protocol is required.

## Implementation order

The [critical-path audit](controller-poc-recovery-review.md#critical-path-acceptance-audit)
now maps evidence to these four source checkpoints. They describe the migration
sequence; installation-specific rollout remains separate.

1. **Prove the revised Task lifecycle.** Using supplied decisions and temporary
   SQLite, cover a result while the Task stays open, later input, exact-result
   correlation, owner closure during execution, and duplicate wakes after
   closure. Remove mode-based decisions in the exercised path. Inventory readers,
   receipts, workspaces and caller dependencies that currently equate completion
   with closure; settle their small replacement contracts before wider migration.
2. **Run A -> B -> C -> B -> A through that same lifecycle.** A handles human
   input; its attempt consumes retained ordered input and commits
   message/Request changes with the fenced outcome. Prove human input while
   children wait, exact Stop, bounded failures and source-aware capacity. Delete
   replaced conversation execution/claim/retry code; retain input correlation.
3. **Finish result routes, fallback discovery and App conventions.** Route Task
   facts and timer-selected reviews into the same handler, with quiet handling.
   Every Task remains available for input until its owner closes it. An assigning
   App may supply that closure convention; Task role does not choose a different
   lifetime. Remove the old follow-up declaration and response path.
4. **Migrate retained state and remove compatibility branches.** Link Host/SDK/App
   revisions and integration order in reviewed PRs. Map completed finite work to
   a closed Task with its original accepted result; map quiet maintained work to
   an open Task with its accepted cycle; preserve waits, failures and all accepted
   asks. Map each existing Conversation to one execution Task and fence obsolete
   claims before activating it. Update reads, controls, cleanup and removal checks
   together; do not keep both execution owners active.

These are checkpoints, not four mandatory PRs. The proof is a source experiment,
not production dual running. A schema/table merger is unnecessary; durable
execution authority must be singular regardless of record layout. Deployment is
separate. The candidate's normal owner-close operation can retire a maintained
supervisor; it needs no separate retirement lifecycle. The
[source retirement proof](controller-poc-recovery-review.md#retiring-the-old-supervisor)
drains its frozen admission command into storage before closing it, then proves
result return after storage reopen. The later
[real-daemon trial](controller-poc-recovery-review.md#real-daemon-cutover)
also proves old-process exit, offline conversion and candidate activation for
its temporary App. Installation rollout and rollback remain separate; any
rollback must preserve evidence and the same single-owner property.

For the first Conversation cutover, accept planned downtime: stop the old Host
and all workers, preserve prior execution evidence, and admit unfinished input
to the stable Task for redo. Keep answered and explicitly stopped inputs quiet.
Do not restore the old handler's internal process or replay a saved decision as
newly accepted work. Lease expiry alone cannot prove that an old process has
stopped; the upgrade procedure must establish that before activating the new
owner. The [source evidence](controller-poc-recovery-review.md#offline-conversation-cutover)
owns state-conversion guarantees; the real-daemon trial verifies the exercised
process shutdown and activation sequence.

The [historical receipt conversion](controller-poc-recovery-review.md#historical-completion-receipt-cutover)
now proves completed-work import against a database written by the old Host.
It preserves original results and matching caller links, retains human closure,
and does not close a newer Task generation. It requires the normal schema upgrade
before state conversion. App runtime preparation rejects unconverted completion
history before admission or execution. After conversion, retained Tasks and
accepted attempts own runtime decisions; old receipts remain available for
historical inspection. The [receipt-authority retirement](controller-poc-recovery-review.md#historical-receipts-no-longer-decide-execution)
removes automatic duplicate pruning and prevents an old success from satisfying
a newer assignment. The [open-state conversion](controller-poc-recovery-review.md#retained-open-task-state)
also preserves maintained outcomes, restores original input/wait links and
continues failures with backoff. Identified historical worker self-stops become
retained non-success evidence; human/owner closure and Turn Stop stay effective.
Missing acceptance methods remain absent, and missing or conflicting identity
aborts the conversion rather than assigning an unrelated answer. The
[mixed-input correction](controller-poc-recovery-review.md#mixed-ordinary-and-conversation-input)
uses the existing `requests.inputKinds` declaration to distinguish Conversation
input from ordinary Task input sharing its Conversation. Source tests now cover
their admission, execution, result return and storage reopen without mutual
blocking. Supervisor retirement also has a source proof using existing admission
and owner-close operations. The real-daemon trial now verifies stopping the
old processes and activating the new Host/App for its fixture. These helpers
and tests do not replace an installation-specific rollout procedure.

## Acceptance and cost evidence

Reuse [PR #149's follow-through fixtures](../../proposals/task-runtime-organization.md#request-follow-through-review)
and existing controller/dependency tests. Those prove current mechanics, not
this lifecycle. Verify the target at its actual boundaries:

**Agent usability is an acceptance gate.** In addition to supplied-decision
tests, run real agents against isolated synthetic work through the source PoC.
Use ordinary asks and the intended judgment context, with code owning the
process above. Include a held-back variant without case-specific coaching:
delegation and return, insufficient evidence, a changed ask, repeated failure
followed by useful progress, and an owner deciding to narrow or withdraw costly
work. The worker follows that decision without making it for its own assignment.
Record invalid decisions/calls, lost obligations, human interventions, model
turns, latency and usage. Distinguish provider failure from a bad judgment.
Compare the current and proposed boundaries on the same work; passing a new
schema alone does not prove controller usability or reduced complexity.

| Scenario | Required evidence |
| --- | --- |
| Real agent with ordinary context | Useful judgments and successful follow-through without polling, lifecycle bookkeeping or procedural coaching |
| Result accepted while child remains open | Caller proceeds using the exact result; a new assignment cannot consume an old success |
| Close while idle/running, repeated close, late event/result | No new execution or stale settlement; history remains and unresolved work is visibly non-success |
| A -> B -> C -> B -> A, success and failure | The same controller runs every Task; each worker judges evidence for its assignment and returns it through saved links |
| Human input to A while delegated work waits | A handles it through the same Task loop without waiting for a child or falsely accepting unfinished work |
| Stop, later input, pause and repeated failure | Scope is preserved; later input remains actionable, retries are paced and stopped work is not replayed |
| Duplicate/during-run wakes and multiple outcomes | One current attempt per Task, no lost message/outcome, another pass only when eligible |
| Transient failure, duplicate wake and restart during cooldown | Same Task/input, enforced backoff and no agent-generated retry batch; delay and failure evidence survive restart |
| New human input during failure or cooldown | One fresh claim with pending context, retained failure count and Requests; duplicate/system input cannot waive pacing; capacity and owner controls still apply |
| Empty initial response or interrupted final synthesis | Continue authorized work with retained evidence and budget; no forced premature blocker or duplicated committed effect |
| Accepted non-success report, then no owner intervention | Preserve and return the report; retain the original unfinished assignment and continue on a due wake without an unblock command |
| More than four failures, then repaired prerequisite | No failure-count stop; persisted backoff paces attempts, and the same Task resumes useful work without a batch action |
| Owner revises or closes after failure | Next attempt uses the new scope, or closure fences execution; the worker report alone cannot abandon work |
| Reopen storage before/after result or explanation commit | Retain accepted evidence, current Request scope and one durable explanation; discover missed notifications |
| Quiet Task, timer and removed timer | No model work just because a Task is open; removing optional discovery preserves ordinary execution correctness |
| Mixed human/system input and multiple Conversations | Correct claim and capacity origin, human reserve preserved, independent keys can run concurrently |
| Ordinary App input and cross-App callers | Input-to-Task admission, caller correlation and accepted-result readiness still work after pump removal |
| Migration, cleanup, capability removal and shutdown | One execution owner, retained asks/results, no capacity/workspace pinned solely by an idle Task, visible unavailable capability |

Report deleted paths and branches, added state/hooks, migration burden and any
behavior given up. Measure idle model calls, mixed-input delay and bounded scan
cost. Run full Host CI for implementation PRs and obtain human review; live
judgment and deployment require their own evidence. A smaller diagram alone
does not establish a smaller or more reliable system.

## Documentation verification

The [source PoC checkpoint](controller-poc-evidence.md) records exact-attempt
evidence retention, real model judgment trials and the remaining result-return
obstacle. No unified lifecycle or simplification is claimed from that first slice.
The later [common-runtime checkpoint](controller-poc-recovery-review.md#common-runtime-integration)
executes Conversation input through normal Task attempts. The
[ingress and Stop checks](controller-poc-recovery-review.md#normal-ingress-and-turn-stop)
also exercise normal human events, interface notifications and exact Turn
control. The [capacity and pause checks](controller-poc-recovery-review.md#conversation-capacity-and-background-pause)
preserve the human reserve and enforce pause at the claim transaction.
The [outcome-route checks](controller-poc-recovery-review.md#returning-linked-outcomes-through-conversation-input)
cover live delivery, missed notifications, failed admission, honest failure and
bounded discovery. The [current evidence record](controller-poc-recovery-review.md)
adds closure checks, retirement of the old execution owners, full passing CI
and an isolated daemon cutover. The [final source audit](controller-poc-recovery-review.md#critical-path-acceptance-audit)
supports the critical path: one execution owner replaces the old inbox and
supervisor paths. Historical readers remain deliberately, outside runtime
authority. Ongoing code size is roughly unchanged; lower long-term maintenance
cost and broad operational reliability remain judgments to test in usage.

Check documentation integrity, executable examples, local Markdown links/anchors
and whitespace. The linked source PoC implements the shared loop for review;
this document does not activate it or certify migration and deployment.


## Retained-state compatibility

The retired supervisor identity `may/conversation/follow-up` is historical
work, not a current response owner. Offline cutover preserves messages,
Topic/Task links, Requests, accepted results and audit Events while fencing old
execution. Current Task controls have no maintained-mode exception. Do not run
old and new response writers together or rerun historical cutovers as routine
maintenance. The [unification record](conversation-input-unification.md#implementation-order)
retains migration evidence; [Operations and Recovery](../../2b-manual/app-operations-recovery.md)
owns separately authorized operating procedures.

The retirement upgrade ends unfinished old child waits with
`handling.phase: failed` and a visible explanation. A separate `failure:<inputId>`
message keeps that explanation visible alongside an earlier `result:<inputId>`
acknowledgment.
The old input is no longer scheduled. Accepted Requests stay open, and already
admitted child inputs and Tasks continue independently with their history and
results intact. A new human turn can review that work and decide what remains.
This deliberately gives up automatic aggregation by the original turn; it does
not claim fulfillment or create replacement work. The accepted rule is tracked
with candidate evidence in the [simplification proposal](../../proposals/authority-boundary-simplification.md#1-one-durable-delegation-path).
