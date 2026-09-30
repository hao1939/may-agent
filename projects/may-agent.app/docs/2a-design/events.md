# Events And Task Admission

**Design status:** Accepted.
**Implementation status:** Event persistence, frozen admission journaling,
direct input-to-Task attachment with paced recovery, exact wakes, Condition wakes, and
ordered per-attempt Event batches are implemented. App admission uses that
single path; request dispositions have been removed. May's Conversation Task
handles linked Task facts through the same input path as human discussion;
there is no separate current supervision Task or proxy for destination work.
Unresolved App translation is retained before invocation and retried through
admission recovery. Condition freshness still partly depends on event names.
The [boundary review](../archive/reviews/resource-event-boundary-20260927.md)
records the original reproductions and links the September 30 source recheck.

## Purpose

An event records input or change that crossed the Host boundary. It may carry
actionable App input or report a fact for zero or more consumers.

Request and fact are semantic roles of this same Event interface, not separate
transport or storage APIs. A caller request additionally creates a correlation
record because a later result is owed; a fact does not create another resource.

```text
publish(event) -> validate -> persist event + exact admission -> receipt
                                      |
                                      +-> async Task execution / result projection
```

The event ID is the root causal identity. An event does not replace mutable work
state: an App task owns the work, a request correlates a caller and result, and
exact controls link to their owning session or operation.

## Resource responsibility and reconciliation

Record responsibility before doing owed work. An event brings information to
an accountable resource; its owner records relevant input or observations, and
reconciliation decides what work follows from current state. Routing answers
"where does this belong?" Reconciliation answers "what should happen now?"

```text
event -> validate and resolve owner -> record input / observation
                                          |
                                     eligible Task
                                          |
                                 reconcile current state
                                          |
                              commit result and remaining work
```

Resource means the existing authoritative record, not a new base class or a
controller for every database row. Tasks own durable work. Conversation
Requests, messages, metrics and execution receipts keep their existing owners
without acquiring independent execution loops. A bounded helper can execute
under an existing Task or caller; it needs no Task of its own.

| Boundary | Responsibility | Completion means |
| --- | --- | --- |
| Admission | Validate authority and shape; resolve an exact destination or declared App route; retain input and correlation | Responsibility is recorded, or rejection/failure is explicit |
| Resource update | Use the owning typed writer to save input, evidence, observations or an authorized state change | That update committed; an incoming claim is not automatically an accepted conclusion |
| Reconciliation | Read current state and pending input; judge relevance, validity and remaining work; use code or agents as appropriate | A proposed result is ready for fenced acceptance |
| Notification | Announce a committed change so consumers can reread | A hint was sent; it creates no new obligation by itself |

For example, a PR-merged observation can satisfy an exactly declared PR wait.
It does not finish the enclosing Task: deployment, verification or a reply may
remain. A human correction becomes input; only an authorized accepted decision
changes scope or approval. Task conclusions, other waits and pending work remain
independent. Pure App mapping may select or declare desired work, but cannot
execute it or declare its success from an event label.

An exact address selects the existing resource. Without one, the declared App
mapping selects it. Interpretation that needs investigation belongs in that
App's work, not the router. One fact may serve several accountable resources;
handling is tracked for each obligation, not by a global "event handled" flag.
Delivery acceptance and a Task's accepted input are different checkpoints.

Once relevant work is identified, admission failure must leave its exact event,
intended route and failure discoverable for retry or accountable review, even
if translation failed before a Task could be created. Recover through existing
admission state; unrelated routes must remain usable. Invalid input can be
rejected explicitly. An intentional no-work decision is different from a broken
translator or an absent owner. A durable event alone does not prove that its
work reached an owner. App translation now follows a saved unresolved admission
command; failure before any accountable route can be recorded still requires
explicit diagnostic handling.

### Immediate reactions

Immediate handling is compatible with this boundary. The owner can finish a
small deterministic update directly through its existing writer. Duration
alone does not decide safety: even a fast network effect may need recovery.

| Case | Appropriate path |
| --- | --- |
| Audit fact or metric sample | Persist through its owning store; no agent or Task is required |
| Exact authorized Stop or Task control | Apply the existing identity/version checks and control promptly; no semantic reconciliation is needed first |
| Task/UI change notification | Reread committed state and render through a passive listener |
| New ask, correction, child result or finding | Retain input for the responsible Task; reconcile before deciding its domain consequence |
| Simple deterministic Task procedure | Use a code executor through normal Task settlement; a model is optional |

Only bounded validation, routing and owner-controlled local writes belong on
the publication stack. Model calls, workflows, broad reads and external I/O run
outside it. An asynchronous action whose result is owed remains attached to its
existing Task, caller or operation. Preserve the evidence needed to distinguish
accepted, running, succeeded and failed; a returned event receipt is not success.
Session/Host controls have their own lifetime and recovery guarantees. A saved
control command is not a promise to replay Stop, restart or shutdown after reboot.

### Changes that already happened

The reverse path is also normal: resource commit -> change notification ->
reread. A notification must not automatically re-enter its source Task as new
work. Another Task may legitimately consume the committed change through an
exact link or declared subscription. Repeated notifications should not create
duplicate obligations or rewrite the source resource's accepted state.

Reconciliation uses current observations and still-pending input together;
it does not blindly replay event instructions. New input can request a later
pass or reach the active executor at a supported boundary. It does not launch
a competing attempt. A lost wake is repaired from retained work, and coalescing
wakes does not consume input. See [input during execution](workflows.md#input-during-execution).

Observation validity belongs to the source/consumer contract. Historical proof
of an immutable result and a report of a changing external state have different
freshness needs. Use exact identity, revision and declared expectations where
available; event spelling or arrival order alone cannot establish freshness.
Preserve conflicting evidence for the owner's judgment. Existing Condition
expectations support field comparisons; a new global event taxonomy is not
required by this rule.

Read [system-model.md](system-model.md) for the relationship among requests,
tasks, facts, and execution; [agent-app.md](agent-app.md) for authoring routes;
and [event-graph.md](event-graph.md) for causal graph details.

## Public interface

The implementation lives in [core/events](../../../may-agent/src/app/core/events/).
Async subscriber promises remain in the bus's
ordered, error-contained listener path. The observation boundary is:

- `PUBLIC_EVENT_TYPES` governs ingress only, never outbound observation.
- `app.task.updated` and `conversation.updated` identify resources to reread.
  A raw `project.task.reconciled` can describe a stale result and is not proof of
  accepted completion.
- Event-by-ID reads and explicit raw streams remain trusted operator diagnostics.
  Their transport shape does not promise a stable API for every internal payload.
- Passive listeners have independent bounded queues, preserve their own async
  ordering, and report failures without vetoing accepted state. Reconnect/overflow
  requires a canonical reread, not replaying observations as work.

The obsolete standalone heartbeat command and its HTTP/UI trigger are removed
from the current source; historical diagnostics remain readable. Public
observation does not create another event family or routing registry.

Every adapter uses the same three operations:

```text
publish(event)    durably enter an event
get(eventId)      inspect delivery and linked outcomes
subscribe(filter) observe events
```

The caller supplies semantic input only:

```ts
type EventInput<TData = Record<string, unknown>> = {
  type: string;
  data: TData;
  target?: {
    appId?: string;
    taskId?: string;
    sessionId?: string;
  };
  idempotencyKey?: string;
};
```

The Host assigns persistence identity, time, trusted source, owner, and trace.
External callers cannot assert those fields. `target` selects an exact object
inside the route chosen by `type`; it does not grant arbitrary control.

`publish` returns an event ID, `recorded` or `accepted`, and any linked request,
task, session, or operation identity. Neither state means domain work
is complete. `get` returns that bounded view again from durable state.

App code still uses typed SDK inputs, task results, facts, and capabilities. It
never receives this Host interface or the raw EventBus.

## Admission contracts

Each admitted event type has one admission contract:

- `record`: persistence is sufficient; zero or more declared routes may react.
- `required`: exactly one semantic route must durably accept responsibility.

Required types are explicitly defined and validated before persistence. Trusted
internal producers may publish an unregistered record-only fact. External
adapters admit only explicit type/schema allowlists. Logging, metrics, tracing,
and passive stream listeners never count as the one required accepter.

The operator-only `may-agent --emit` path is a bounded compatibility exception:
deployed App operations still use it for unregistered record-only facts and
explicit `trigger.*` controls. It accepts a canonical trusted envelope at the
socket boundary. It is not a human-input path and must not grow new routing
semantics. Console, Telegram, HTTP, Web UI, `--send`, runtime controls, and
session controls use `publish(EventInput)`; the retired flat `input`, `steer`,
`cancel`, `cancel_all`, `fork`, `reload`, `restart`, and `shutdown` socket
shortcuts are rejected.

Persistence and the exact durable admission authority finish inside `publish`.
That authority may be a caller request, frozen route-journal row, exact Task
wake, or control operation. The step may run pure App translators/resolvers
and attach input to a Task, but it cannot execute work. Model calls, workflows,
commands, network I/O, presentation, broad reads and other actual handling
begin asynchronously after `publish` returns. Failed attachment remains saved
for recovery through the same admission boundary.

The EventHub does not serialize semantic handling. It records event identity,
sequence, and causal links, but those facts do not control execution order.
Each consumer owns the ordering its resource requires. For example, May's
message handler serializes decisions within one Conversation, while handlers
for different Conversations and Task attempts may run concurrently within
bounded capacity. A busy message handler or Task can delay only that handler's
work; it cannot delay event publication, resource reads, or another independent
handler.

Task execution is also a process boundary. A Task worker persists the Events it
produces to the shared journal, then relays their durable IDs to the parent
Host. The parent fans out those already-persisted Events to its local routes and
interface listeners without appending them again. This is transport for the
same Event, not another queue or lifecycle. All Task workers share one bounded
parent relay: it fans out at most one worker Event, then leaves a small real
poll window before the next background item. Several active workers therefore
cannot combine independent callback chains into one long interface stall. A
zero-delay callback is not a fairness guarantee in the deployed Bun runtime.

Passive listeners run afterward for persisted, non-replayed events. Each
listener has its own filtered, bounded FIFO, so socket streams, Console
rendering, Conversation mirroring, and similar presentation cannot add latency
to semantic acceptance or block one another. When a listener falls behind,
stale notifications may be dropped with a warning; the durable event and
resource remain available for resynchronization. A listener handles at most one
notification per event-loop turn. A continuing backlog leaves a nonzero poll
window before the next item. A listener failure is observable but cannot undo
the accepted event.

Subscriber-failure diagnostics are passive Events too. They are emitted one
per later event-loop turn; a burst of failed consumers must not recursively
persist and route every diagnostic on the originating publication stack. Each
retains the failed event as its trace parent so the failure can be followed.

An `async` function is not by itself an asynchronous boundary: its synchronous
prefix runs immediately until the first `await`. A handler that opens stores,
discovers work, scans state, or constructs an execution must first schedule a
later event-loop turn. Only validation, event persistence, exact correlation,
and the exact durable wake may execute on the publication stack.

An exact durable wake reads and updates only the named Task and the Conditions
attached to it. It does not load child Tasks, attempt history, or re-resolve and
rewrite the Task goal. The Event is feedback for existing work; later Task
reconciliation reads whatever broader bounded context it actually needs in its
isolated worker.

Exact Task wakes use this bounded durable update even when broader admission
uses an isolated worker. A blocked admission worker must not prevent an
already-resolved Task from becoming runnable. The broader worker reports ready
only after installing its receiver; the Host bounds unanswered dispatches and
preserves the EventHub identity across its process boundary. Pending admission
links expose their recorded failure instead of hiding it behind `accepted`.

A required consumer records its exact input, Task link or operation before
starting work outside the publication stack. A bounded deterministic resource
update may complete directly through its authorized writer, as described under
[immediate reactions](#immediate-reactions). Ordering and recovery belong to
that resource's contract; unrelated consumers run independently.

Expiry repair for pending admission and lifecycle-pair records runs in the
separate maintenance process. Event persistence never performs that periodic
history sweep before inserting a new event. Retained schema fields named
`delivery_*` describe this historical admission state, not adapter display.

`conversation.message.created`, `app.input.requested`, direct-agent
`chat.start.requested`, exact session controls, and Host lifecycle controls are
required. For a Conversation message, acceptance means the Conversation route
accepted the message; only `author.kind=human` also creates a May request. The
durable message and request are the acceptance boundary. The derived
`conversation.updated` presentation wake is coalesced and emitted afterward;
it cannot delay or invalidate the publisher's receipt.
Ordinary reported facts are record-only. An event may remain `recorded` after
persistence when its route fails. Existing input/plan recovery retries retained
App admission with the same identity. A failure before those records exist is
currently diagnostic evidence without automatic admission recovery; control
commands also retain their own recovery contract. App subscription translation
now runs after unresolved routing responsibility is saved, so a thrown translator
uses the existing plan recovery; this is not a failure before plan creation.

## Routing outcomes

The host matches only declared routes:

```text
App subscription -> pure toInput(event) -> shared input-to-task resolution
exact task target -> wake that task identity
matching Condition -> wake the task that owns that Condition
no actionable route -> retain a valid record-only fact
```

An exact Task identity is always `{appId, taskId}`. Internal Task-dependency
events carry both fields, and inbox recovery reads and wakes that same scoped
identity. A retained legacy event without `appId` may use the compatibility
wake, but new producers must never address a Task by its App-local ID alone.

For `app.input.requested`, an explicit Task address continues that Task before
automatic Conversation routing or App task mapping. Its input still passes the
App schema. Channel and Conversation metadata describe the caller; they do not
override an explicit work destination. With no Task address, the App's normal
Conversation and task mapping rules apply.

The Host uses one address reader for admission and live delivery, including
the existing `data.targetTaskId` input form and envelope `target.taskId` form.
Conflicting addresses are rejected. Saved envelopes and idempotency identities
are not rewritten to deliver a hint. A running attempt and its nested agents
observe the same addressed fact; this neither consumes its durable input nor
starts a concurrent attempt. See [input during execution](workflows.md#input-during-execution).

An App subscription has a stable ID and produces input only when its pure
translator returns a valid value. App admission passes addressed input through
the App's pure `task(input)` mapping and atomically attaches its Task/input link. A direct Task
subscription may use pure `tasks.resolve(event)` during exact admission. The
Runtime persists the resulting intent and one ordered canonical task-event
link, then coalesces the stable task ID in its ready set. A targeted task or
Condition wake stores the same kind of link without broad resolution.

The task-event link is durable work input, not a scheduling hint. It stores one
canonical event envelope plus the EventHub identity, never both a flattened
payload and a duplicate attempt trigger. Every claim
receives a bounded ordered batch of linked events after the task's accepted
checkpoint. Result admission advances that checkpoint through the presented
batch atomically with task state. Events arriving during an attempt remain
pending. If more events are linked than fit one batch, `truncated` is explicit
and the remainder drives later attempts. The controller queue may contain only
one copy of the task ID without losing any linked event.

Scheduled `project.task.tick` events are reconciliation notifications, not
unique input. Pending ticks coalesce to the newest durable tick for that Task;
older ticks remain EventHub history, not a requirement for separate attempts.
Human feedback and other input-bearing events retain their ordered identities.
A tick arriving during a pass does not invalidate that pass's actions or effects:
passing time is not new evidence. Normal result settlement evaluates the pending
wake against the newly installed waits, or retains it for a subsequent pass.
New human feedback and provider facts still fence effects until incorporated.
When rejecting an attempt, recovery rereads current state and fences that
version while requiring the same generation and attempt identity. It must not
reuse the obsolete version that caused the rejection, overwrite a concurrent
update, or release a replacement attempt. Existing indexed Task recovery
reconstructs lost scheduling from durable state; there is no App-owned retry queue.

The same fact may reach several Apps, but within each App it takes exactly one
path: translate to one task, wake one exact task, or remain observation-only.
There is no separate request disposition or task-subscription work model.

There is no target-first owner fallback, `inbox.accepts`, arbitrary `onEvent`
execution, or generic rule that turns an unhandled fact into owner work.

## Addressed input and caller requests

Addressed input uses one standard required event:

```text
app.input.requested target.appId=<app>
  -> validate App input
  -> create or find caller correlation when a caller expects a result
  -> map and atomically attach input to its Task, or retain failed admission
  -> return the durable receipt and available exact links
  -> asynchronously execute/recover through the Task boundary
```

- non-conversation callers may publish this event for the `may` App;
- a typed cross-App dependency creates a child request and linked task;
- an App action translates validated parameters to App input;
- an input schedule creates a time-correlated App input; and
- an App subscription translates a fact into input only when that fact
  genuinely requires work.

An unknown App address is rejected before a receipt exists. It does not fall
back to a generic owner inbox or May.

Composition selects the conversational App. Its input must use durable App or
Conversation admission; `chat.start.requested` cannot bypass that boundary.
This rule follows the selected capability rather than a name hardcoded in core.
See the [boundary review](../proposals/authority-boundary-simplification.md#core-policy-cleanup).

The request persists caller correlation, dependency links, result, and restart
recovery. It does not execute App policy. The App sees the
typed task context and returns only reconciliation evidence and desired task
changes.

May human adapters use a more expressive required event:

```text
conversation.message.created target.appId=may
  + conversationId=may:primary
  + author.kind=human
  -> admit one bounded May frontend request
```

The human message is both shared Conversation context and the fenced ingress
for one request. Agent, tool, and command authors add context but no work;
`transient: true` adds neither durable context nor work. This special route
does not replace generic `app.input.requested` for schedules, App actions,
delegation, or non-conversation callers. A conversational App may name one
default Conversation for addressed event/API requests. A correlated agent
response carries `messageId=result:<requestId>`, so its explicit Event and
bounded compatibility projection remain one message across independent read
windows. Failed input handling is projected as `failure:<inputId>` so an earlier
acknowledgment remains history and cannot hide the failure. See
[Message Lifecycle](message-lifecycle.md#retained-state-compatibility).
Accepted responses to addressed event/API requests enter that
Conversation, but their inputs are not presented as human Turns.

## Admission state

Event admission metadata answers whether the event type's contract is
satisfied, not whether resulting work finished. For Task-based input, the
milestones are:

```text
admission recorded -> Task attached -> result accepted
```

These are commit points in existing records, not new status fields. An accepted
request or frozen routing plan can precede Task attachment. A client reads the
linked request/Task to follow coordination and completion.

The durable acknowledgement point depends on the route:

| Route                       | Durable admission boundary                                     |
| --------------------------- | -------------------------------------------------------------- |
| Addressed App input         | caller request is durable; Task attachment follows asynchronously |
| Broad App subscription      | frozen routing plan is durable; request/Task admission follows asynchronously |
| Exact task target           | task wake/trigger is durably correlated                        |
| Required observation/control | its declared durable evidence or operation accepts responsibility |
| Record-only event           | persistence is sufficient; public delivery remains `recorded`  |

Logging, UI tailing, passive metrics, database writing, and unrelated broad
subscribers do not count as semantic acceptance.

For required asynchronous work, `accepted` means its durable admission
authority now owns coordination. It does not promise an attached Task or an
accepted result. Pending admission links expose progress or failure separately.
Completion remains in the Task resource and its linked caller request. Adapter
presentation is a passive consequence, not another semantic route or operation.

Record-only facts with no consumer remain valid observations. A required event
without durable acceptance remains visible for recovery. Invalid or unknown
external input and nonexistent required targets create no event receipt.

## Results and correlation

In the current Host, a Task result completes linked Task-based caller records
through their exact stored identities. A bounded frontend's handling record
instead completes after its direct result or durable follow-up admission.
Topics retain the responsible Task links. The merged
[shared-input design](message-lifecycle.md#one-conversation-input-path) routes
qualifying Task facts and timer-discovered reviews into the conversation input
path. Under the [one-lifecycle baseline](task-resource-engine.md#one-lifecycle-baseline),
that input wakes the Conversation's execution Task, not a separate supervision
Task. These changes are implemented in Host #158; deployment is a separate check.
An accepted child outcome can wake a caller while the child remains open;
correlate the exact assignment/result, not resource closure or an old success.
Closure is an authorized state operation whose consequences may publish facts;
a late fact cannot reopen the closed Task. System origin, exact saved
links and change identity must survive admission. Reuse the meaningful Task
event rather than wrapping it in a generic wake event. These are input-handling
completion rules, not proof that the conversational Request's accepted ask has
been fulfilled.
[Message Lifecycle](message-lifecycle.md#requests-acceptance-and-closure) owns
Request recognition, refinement and closure, response identity, and the
remaining implementation gap. Transport admission stays deterministic and does
not wait for the model to recognize an ask.

Conversation and Task state remain the resources readers inspect. A
`conversation.updated` Event is a coalescible, record-only wake emitted after
new content is durably readable. It carries no content and cannot create work.
The publication stack never waits for an adapter read or render.

Task admission activity carries the exact responsible Task identity. Routine
executor events stay diagnostic; they do not manufacture human speech or
completion. Adapter delivery is observational and cannot reopen accepted work.

Typed Runtime controls use exact operation identities. For reload,
`runtime.reload.requested` produces one `runtime.reload.finished`; the initiating
adapter may append a command-view message after it actually displays the result.

Escalation uses exact Task/request dependencies, not event pairs. Metric alert
state remains a metric projection. Trace closure records causal evidence and
cannot replace Task or request completion.

## Core event vocabulary

The executable schemas remain authoritative. Cross-boundary vocabulary stays
small. Event types may ask for responsibility or report facts; neither turns
the event stream into a work queue.

### Human and execution

- `conversation.message.created` for shared May human context and admission;
- `conversation.updated` as a wake-only signal for Conversation readers;
- channel delivery facts;
- `session.start`, `session.idle`, and `session.end`;
- workflow/execution result and failure facts;
- targeted cancellation, approval, and runtime-control requests where a shared
  controller owns deterministic handling.

Ordinary human language is admitted to May rather than routed through a generic
event-owner fallback.

### App and project

- `project.comment.created` and `project.owner.requested` may be explicit App
  subscriptions when the App owes a distinct result;
- domain/provider observations feed App input translators, exact task wakes, or
  projections;
- task reconciliation lifecycle events are evidence, not scheduling commands;
- an event with `target.appId` and `target.taskId` is durably linked and wakes
  that exact Task;
- an event published by a fenced Task attempt carries Task provenance and is a
  progress/finding/fact, not a competing completion or an automatic self-wake;
- typed App actions create App input rather than publishing an actionable event
  shortcut.

A project comment is not classified merely by transport. A human-addressed
comment that needs acknowledgment becomes an App request; a provider-like
change fact that deterministically revises desired work belongs to a task
subscription. If one event type carries both meanings, its translators must
classify content explicitly or the producer should publish clearer types.

### Metrics and escalation

- metric breach, stall, and recovery events are measured facts;
- escalation creation and resolution represent an explicit ownership-boundary
  dependency; and
- alerts and escalations keep their current state in their owning projection or
  source obligation, not in event delivery rows.

### Runtime and diagnostics

Timer, observer, scheduler, session, workflow, guard, and skill facts are
normally diagnostic or wake evidence. They create work only through an explicit
subscription or exact target.

## Schedules and observers

An event schedule publishes a record-only typed fact through the shared
scheduler. An input schedule publishes a time-correlated
`app.input.requested` event. The schedule applies its declared catch-up policy
before publication; the standard route then admits the linked App request.

An observer reads current external state and returns facts for the host to
publish after a successful bounded run. It cannot mutate inbox/task state or
start model execution. The [App observer contract](agent-app.md#resource-ownership-by-convention)
owns provider discovery and resource-link conventions. Repeated level
observations must preserve stable work identity and avoid repeatedly creating
the same obligation; event recording alone does not deduplicate agent turns.

## Execution feedback and agent wakes

Code executes and maintains the feedback loop; the owning agent judges meaning
and the next action. These responsibilities reuse existing resources:

```text
agent chooses an authorized action
  -> executor runs it; observer follows external state when needed
  -> execution/resource evidence records progress, output and result
  -> relevant fact enters existing durable Task admission
  -> the same Task receives the evidence and judges what to do next
```

Task-owned execution inherits the Host's App, Task and attempt identity.
External resources use the adapter's documented ownership convention. A
resource ID, attempt ID or session ID is evidence linked to work, not another
work owner. Facts about shared resources can use existing Condition or App
routes instead of inventing a single Task owner.

A feedback fact identifies the source resource or operation, what was observed,
when it was observed, and the relevant source revision when available. It uses
the existing target and correlation fields and links to bounded evidence.
Large output, reports and debug details remain with the execution or resource
record; events and Task summaries reference them rather than duplicating logs.
Do not invent progress percentages, success or freshness when the source does
not establish them. A provider read failure is not proof its operation failed.

### Record progress; wake for reconsideration

| Observation | Normal handling |
| --- | --- |
| Log output or ordinary reported progress | Retain with the run and expose to readers; no agent turn for each line or heartbeat |
| An awaited operation finishes, fails or needs input | Record the result/evidence and route feedback to the responsible Task |
| A linked resource's configured relevant fields change | Publish the observed revision to its owning Task; the agent judges its significance |
| A wait reaches its review deadline | Use the existing Condition/recovery review; elapsed time alone proves neither success nor failure |
| New actionable input arrives while the Task is running | Preserve it through existing Task admission and pending-input handling; do not start a competing session |

An immediate tool result already available to the active attempt does not need
a second event to wake that same attempt. Likewise, progress emitted by an
attempt is not an automatic self-wake. Asynchronous feedback reuses exact Task,
dependency or Condition routes; it does not require a supervisor relay or an
adapter calling the model directly. Closed, cancelled and superseded work
remains subject to existing Task lifecycle rules, not provider metadata.

Scheduling hints may coalesce; accepted input and outcome evidence follow
their existing persistence and retention rules. Polling an unchanged provider
should not repeatedly invoke judgment merely to rediscover the same state.
Adapters declare which source fields matter, while the agent decides their
meaning; no central table of provider-specific repair strategies is needed.

The shared Task runtime applies this to typed delegation:
`project.task.reconciled` and `app.task.cancelled` refresh saved input feedback
and linked Conversation observations. `app.dependency.updated` carries the exact
input's first accepted failure (`blocked`) or its answer/owner closure (`done`).
A blocker wakes the caller with evidence but keeps its wait and input unfinished.
The saved report suppresses repeated retry notifications; routine waits do not
relay caller wakes. Recovery uses the same saved evidence and Condition path.
See the [first slice and limits](../proposals/conversation-input-unification.md#first-caller-feedback-slice).

When execution resumes, supply a bounded view of the objective, changed facts,
current work/waits and evidence references. The agent can read deeper using
existing Task and execution readers. Keep response guidance with its App or
agent, separate from untrusted external output. A wake is a request to
reconsider current evidence, never acceptance proof or new authority.

### Duplicate delivery and safe reconsideration

Duplicate delivery is expected, including worker relay retries, recovery after
restart, and delayed copies arriving after an attempt has accepted its result.
Producer restraint and receiver idempotency are complementary requirements.
Neither relies on exactly-once transport.

- **Producer:** reuse a stable publication identity for the same fact or result.
  A fact already available to the publishing attempt does not automatically
  require another attempt. Do not notify merely to acknowledge a duplicate and
  create a feedback loop. Keep observations distinct when their source revision
  or meaning actually changes.
- **Host receiver:** recognize the same durable event for the same Task across
  pending input, claim, settlement and restart. Receipt identity survives removal
  from the pending queue. A repeated delivery acknowledges that existing receipt;
  it does not append fresh input, resubmit old desired state or create another
  model turn. Active attempts also suppress repeated live hints for claimed,
  consumed or already-delivered input; each listener still receives new input.
  Receipt and Task changes share a durable boundary. One Task's receipt cannot
  consume another Task's input.
- **App receiver:** different event identities may describe the same business
  fact. Compare current source evidence with retained Task results and operation
  identity before acting. If nothing remains, return a bounded no-op without
  repeating effects, notifications or progress increments. Preserve unrelated
  input, outstanding waits and genuinely changed state. Delivery order alone
  does not establish source freshness.

Receiving input is not accepting an outcome. Claiming or remembering its
identity must not discard unfinished input: a failed, invalid or interrupted
attempt recovers from its retained batch and pending input. Accepted results
and incorporated input settle through the existing fenced transaction. A
worker's self-addressed publication is durable before relay; when its valid
result consumes that fact, a late first relay or repeat cannot revive it. A
retry that returns an existing publication receipt has the same handling rule.

Journal recovery preserves the stored event ID, so readback and delayed delivery
refer to the same input. A consumed event stays quiet unless it matches a current
open Condition under the existing freshness and report-revision rules. This lets
a newly declared wait use retained evidence without waking again for an already
satisfied wait. Condition and input changes use the same fenced transaction.
See [Task event input](task-resource-engine.md#event-input-and-checkpoints).

For an external action, use the destination's idempotency key where available,
or read back operation state before retrying an uncertain result. There is no
atomic exactly-once guarantee across arbitrary external systems and Task
settlement. Record unresolved ambiguity; never infer that a failed attempt
means its external action did not happen.

Correctness means no repeated effect or false progress from an already-handled
fact. Avoiding unnecessary attempts is a separate efficiency goal. A harmless
extra reconsideration can be correct; repeated self-wakes without new work are
still a defect worth removing. These rules apply to ordinary Tasks, including
periodic reviews; they do not require a special owner-review controller.

**Implementation status:** Host [PR #175](https://github.com/hao1939/may-agent/pull/175)
merged as `e38d2861` with receipt retention and self-publication handling.
It builds on merged Host #168: `attempt-execution.ts` owns publication receipt
capture and live-listener filtering; admission and storage retain exact delivery
identity across attempts. Admission, storage, publication tracking and worker
relay share target parsing, including the supported project alias and surrounding
whitespace. The existing fenced reconciler still owns settlement.
Its focused regressions cover duplicate admission during execution, after
acceptance/restart, delayed child-process relay, and journal readback for a newly
declared Condition. This is not a claim of
installed-container adoption or universal App-level semantic deduplication.
The [pilot record](../archive/reviews/may-project-review-pilot-20260912.md)
keeps validation and rollout evidence separate.

### Observation is not successful publication

An adapter must not mark a notification handled merely because it read the
provider. If persistence fails or a replaced observer's result is discarded,
the next eligible observation must still be able to report the current state.
After durable admission, existing Host recovery owns the accepted work.

Prefer safe re-observation and existing correlation over a second queue. If
change suppression needs a checkpoint, distinguish observed state from
successfully published feedback and advance the latter only at its durable
boundary. Periodic level facts can be simpler, provided consumers suppress
duplicate obligations and unnecessary execution. This is not an exactly-once
delivery promise or a requirement to retain every intermediate provider change.

**Implementation boundary:** May already has observer execution, exact Task
admission and durable Task input recovery. This refinement does not claim a
shared provider-discovery adapter exists. The Host now owns an observer's
`previousObservation`/`nextObservation` snapshot and advances it only after the
returned facts receive durable publication receipts; the reviewed Scout
credential observer uses that contract and no longer advances a module-local
publication checkpoint. Provider discovery still has to distinguish a successful
empty read from total read failure so the existing `app.observer.failed` path can
run, and an installed App subscription or exact Task route must own any semantic
consideration. Emitting or logging the failure alone is not evidence that an
owner considered it.

## Durability and retention

“Durable event” means the input/change and its causal metadata are persisted for
audit and reconciliation. The in-process bus is not a general work queue and
does not promise implicit exactly-once replay.

The event row retains bounded routing, causality, and correlation
metadata. Large immutable bodies may be stored content-addressably before the
row commits. Routing consumers use the bounded projection; audit/detail readers
resolve the full body only when required.

The declared envelope `target` is retained separately from indexed evidence
correlation. For example, Evaluation can publish a report about a May Task to
an App subscription: the producer Task, reviewed Task and destination have
different roles. Save/read/restart must preserve the declared destination,
including an event with no destination. Public reads and recovery use that
same retained target; neither payload identity nor a producer index supplies
missing routing authority.

The Host stores the envelope metadata as one `events.envelope_json` document.
It preserves `target`, `action`, and future envelope fields without adding a SQL
column for each field. The existing `data`/body artifact retains the payload;
the existing trace tables retain causal links and visibility. SQL type, source,
owner and correlation columns keep their query roles and existing indexes. Recovery reads the
document and verified payload and restores causal metadata from its existing
authority. It does not reconstruct the envelope from search indexes. This uses
SQLite's transactions and JSON support, not a separate document database.

The writer saves the document and its query fields in the same transaction.
Common filters use existing columns; occasional metadata filters can use
`json_extract(envelope_json, '$.target.appId')`. Add an expression index when a
real query needs one, rather than a column for every optional field. Producer
correlation comes from trusted publication context and cannot supply an address.
Event identity and delivery/acceptance state remain authoritative runtime records,
not disposable indexes or properties reconstructed from the envelope.

An omitted App-event urgency means `normal` in both initial translation and
recovery. A database reopen must preserve the complete supported App event,
including its action, and the trace inherited by subsequent publications.
Host-assigned time and other trusted metadata remain Host responsibilities.
Input schemas still validate meaning and authority; flexible storage does not
make arbitrary controls valid.

An idempotent publication retry checks the caller's input before restoring
Host-assigned time/source and causal links. It preserves authored fields;
inserting a presentation default into them must not change a later retry's hash.

Pre-existing rows retain SQL NULL for the envelope because it was not saved.
Readers expose known fields and omit unknown target/action information without
rewriting history. Already frozen admission commands and Task-event links retain
their own exact destinations and continue through normal recovery. An older
admission still awaiting translation remains pending with an explicit failure
when its original envelope is unavailable. Already translated commands continue
independently; this change cannot recover information never retained. The shared
reader checks supported field types and agreement with the indexed event type;
invalid metadata is an explicit read failure, not an untargeted event. Unknown
extensions survive; this is structural validation, not tamper detection.

### Subject and address matching

`EventSelector.target` constrains the explicit envelope address. Every supplied
field participates, including `appId`, `executionId`, `metricId` and `human:
false`; payload fields cannot satisfy or override those constraints. Target
owner matching retains the supported `agent:` alias. The existing top-level
`project` selector matches the subject's payload project aliases, with its
target-project fallback only when no payload alias is present. Use it for
subject facts; use `target` when the address itself is the constraint.

Public domain facts preserve independent payload subjects and envelope targets.
The Host does not inject an address into an otherwise absent subject field.
Controls and addressed inputs explicitly declare which payload fields are
aliases for their addressed resource; those aliases remain consistent and
conflicts are rejected. For example, a Task control's `data.taskId` cannot name
a different Task from `target.taskId`, while a report may describe one Task and
address another. Apps continue to own translation and acceptance.

Retention protects:

- events referenced by unfinished App requests, task triggers, or Conditions;
- retained trace parents and closure links;
- human roots/results still referenced by Conversation;
  and
- explicit audit holds.

After referential protection, old event detail may be pruned. Long-term truth
belongs in App requests, tasks, projects, metrics, knowledge, reports, or domain
artifacts.

## Operational audit

Operational checks distinguish:

- valid record-only observation from failed required admission;
- event admission from semantic completion;
- a persisted task trigger from queue pressure;
- a correlated App request from a callerless inbox item;
- an exact task wake from broad task resolution;
- missing trace evidence from missing work ownership; and
- canonical consumption from forbidden legacy dual consumption.

The App request health surface reports pending age, claim/handling latency,
lease reclaim, dependency waits, and result admission. Event health reports
required events awaiting admission. Adapter/provider failures are separate
presentation diagnostics; neither surface infers work from record-only facts.

Detailed procedures live in
[event-runtime-audit.md](../2b-manual/event-runtime-audit.md).

## Integrity checklist

- Every published event has a canonical typed envelope.
- Every fact-to-work transition is explicitly declared and idempotent.
- App subscriptions translate facts through the shared input-to-task resolver;
  exact task targets wake only the named task.
- Passive listeners never satisfy semantic admission or delay acceptance.
- Event acceptance never implies request/task/domain completion.
- No unhandled fact falls back to a generic owner inbox.
- No request or task lifecycle is represented by an event pair.
- Continuation and reconciliation are safe to repeat.
- Retention protects causal evidence referenced by unfinished work.
- Compatibility normalization is isolated at ingress and cannot create a
  second actionable route.
- Conversation projection is reconstructed from existing durable evidence and
  never becomes another work store.
