# Events, Delivery, And Task Admission

**Design status:** Accepted.
**Implementation status:** Event persistence, frozen admission journaling,
deferred request-to-Task coordination, exact wakes, Condition wakes, and
ordered per-attempt Event batches are implemented. All current Apps use that
single path; request dispositions have been removed.

## Purpose

An event records input or change that crossed the Host boundary. It may carry
actionable App input or report a fact for zero or more consumers.

Request and fact are semantic roles of this same Event interface, not separate
transport or storage APIs. A caller request additionally creates a correlation
record because a later result is owed; a fact does not create another resource.

```text
publish(event) -> validate -> persist event + exact admission -> receipt
                                      |
                                      +-> async request coordination / Task handling
```

The event ID is the root causal identity. An event does not replace mutable work
state: an App task owns the work, a request correlates a caller and delivery,
and exact controls link to their owning session or operation.

Read [system-model.md](system-model.md) for the relationship among requests,
tasks, facts, and execution; [agent-app.md](agent-app.md) for authoring routes;
and [event-graph.md](event-graph.md) for causal graph details.

## Public interface

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
task, session, delivery, or operation identity. Neither state means domain work
is complete. `get` returns that bounded view again from durable state.

App code still uses typed SDK inputs, task results, facts, and capabilities. It
never receives this Host interface or the raw EventBus.

## Delivery contracts

Each admitted event type has one delivery contract:

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
wake, or control operation. The step may run pure App translators/resolvers,
but it cannot execute work. Request-to-Task coordination, model calls,
workflows, commands, network I/O, presentation, broad reads, and other actual
handling begin asynchronously after `publish` returns.

Passive listeners run afterward for persisted, non-replayed events. Each
listener has its own filtered, bounded FIFO, so socket streams, Console
rendering, Conversation mirroring, and similar presentation cannot add latency
to semantic acceptance or block one another. When a listener falls behind,
stale notifications may be dropped with a warning; the durable event and
resource remain available for resynchronization. A listener failure is
observable but cannot undo the accepted event.

An `async` function is not by itself an asynchronous boundary: its synchronous
prefix runs immediately until the first `await`. A handler that opens stores,
discovers work, scans state, or constructs an execution must first schedule a
later event-loop turn. Only validation, event persistence, exact correlation,
and the exact durable wake may execute on the publication stack.

A required consumer does not gain a special synchronous handler. It first
persists the exact request, Task link, or operation that makes the work
recoverable, then handles that resource asynchronously. Ordering is local to
one Task or operation; unrelated consumers run independently.

Expiry repair for pending delivery and lifecycle-pair records runs in the
separate maintenance process. Event persistence never performs that periodic
history sweep before inserting a new event.

`conversation.message.created`, `app.input.requested`, direct-agent
`chat.start.requested`, exact session controls, and Host lifecycle controls are
required. For a Conversation message, acceptance means the Conversation route
accepted the message; only `author.kind=human` also creates a May request.
Ordinary reported facts are record-only. A required event may remain `recorded`
after persistence when its route temporarily fails; recovery retries the same
event and identity.

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

An App subscription has a stable ID and produces input only when its pure
translator returns a valid value. The deferred request coordinator passes
addressed input through the App's pure `task(input)` mapping. A direct Task
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
  -> return the accepted request link
  -> asynchronously map it to and persist one App task link
```

- non-conversation callers may publish this event for the `may` App;
- a typed cross-App dependency creates a child request and linked task;
- an App action translates validated parameters to App input;
- an input schedule creates a time-correlated App input; and
- an App subscription translates a fact into input only when that fact
  genuinely requires work.

An unknown App address is rejected before a receipt exists. It does not fall
back to a generic owner inbox or May.

The request persists caller correlation, dependency links, result, restart
recovery, and delivery state. It does not execute App policy. The App sees the
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
default Conversation for addressed event/API requests. Their accepted responses
enter that Conversation, but their inputs are not presented as human Turns.

## Delivery acceptance

Event delivery metadata answers whether the event type's contract is satisfied,
not whether resulting work finished. The durable acknowledgement point is:

| Route                       | Accepted after                                                 |
| --------------------------- | -------------------------------------------------------------- |
| App subscription            | translated input, task intent, and exact trigger are durable   |
| Exact task target           | task wake/trigger is durably correlated                        |
| Human/channel adapter       | adapter accepts the outbound delivery operation                |
| Observation-only projection | projection explicitly accepts responsibility for that evidence |
| Record-only event           | persistence; no semantic accepter is required                  |

Logging, UI tailing, passive metrics, database writing, and unrelated broad
subscribers do not count as semantic acceptance.

For asynchronous work, accepted means “the correct durable owner now has it,”
not "finished." Completion remains in the task resource and its linked caller
request or delivery operation.

Record-only facts with no consumer remain valid observations. A required event
without durable acceptance remains visible for recovery. Invalid or unknown
external input and nonexistent required targets create no event receipt.

## Results and correlation

Requests and Tasks carry durable correlation instead of opening event pairs:

```text
May frontend request -> answer, or durable follow-up event -> request complete
follow-up event -> standing May Task -> responsible App Task
Task event/result -> standing May Task -> Conversation update
                                      -> adapters render independently
```

After the follow-up event is durably admitted, Runtime records one structured
tool-authored Conversation activity containing the admitted Task identity. It
is the human-visible admission receipt and lets an adapter watch canonical Task
state immediately. It does not claim completion, replace Task state, or turn
low-level Runtime events into Conversation messages. Meaningful progress is
read from the Task after identity-only wakes; routine execution events remain
outside ordinary conversation.

An App Task waits on exact child work or Conditions. A May frontend request
does not wait on destination work. May's conversation Task preserves that
obligation, and a persisted May response enters Conversation independently of
channel rendering.
Events provide causal evidence and wakes along those relationships; they do
not recreate the relationships as opener/closer pairs.

Escalation is an explicit cross-owner request linked to its source App request
or task. Its resolution wakes that source obligation. Metric alert state remains
a metric projection; a breach event may wake work but does not own its result.

Trace closure answers which evidence fulfilled an earlier cause. It is useful
for audit but cannot replace inbox/task/delivery completion.

## Human-rooted flow

```text
conversation.message.created target.appId=may
  conversationId=may:primary
  author.kind=human
  -> bounded May frontend request
  -> answer/clarification, or typed follow-up event
  -> frontend request done
  -> May conversation Task links and follows exact Tasks
  -> useful result persisted in Conversation
  -> Console and Telegram independently observe and render
```

The Conversation is a bounded read model reconstructed from messages, admitted
requests, dependencies, and persisted results. It is not another database or
work owner. Each admitted human turn has its own request identity; when durable
work is needed, its Topic links the real destination Tasks. Reply anchors and channel coordinates add context;
they do not decide which unfinished task owns the response. Adapter delivery
attempts and receipts are operational evidence only and never gate Conversation
content or May work.

`conversation.updated` is an internal record-only resource notification emitted
after the Conversation projection can durably expose a new message. Adapters
watch it and re-read the resource. It carries no content, cannot create work,
and may be coalesced.

Direct typed runtime controls may bypass owner judgment. If their rendered
result should inform later conversation, the Runtime emits one correlated
terminal fact and the initiating adapter appends it as a command message only
after the human actually saw it. For reload these are
`runtime.reload.requested` and `runtime.reload.finished`.

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
start model execution. Replaying a level observation is safe because request
admission and task intent use stable idempotency/correlation.

## Durability and retention

“Durable event” means the input/change and its causal metadata are persisted for
audit and reconciliation. The in-process bus is not a general work queue and
does not promise implicit exactly-once replay.

The event row retains bounded routing, delivery, causality, and correlation
metadata. Large immutable bodies may be stored content-addressably before the
row commits. Routing consumers use the bounded projection; audit/detail readers
resolve the full body only when required.

Retention protects:

- events referenced by unfinished App requests, task triggers, Conditions, or
  delivery operations;
- retained trace parents and closure links;
- human roots/results still referenced by Conversation or adapter operations;
  and
- explicit audit holds.

After referential protection, old event detail may be pruned. Long-term truth
belongs in App requests, tasks, projects, metrics, knowledge, reports, or domain
artifacts.

## Operational audit

Operational checks distinguish:

- valid record-only observation from failed required admission;
- delivery acceptance from semantic completion;
- a persisted task trigger from queue pressure;
- a correlated App request from a callerless inbox item;
- an exact task wake from broad task resolution;
- missing trace evidence from missing work ownership; and
- canonical consumption from forbidden legacy dual consumption.

The App inbox health surface reports pending age, claim/handling latency, lease
reclaim, dependency waits, result admission, and delivery waits. Event health
reports required events awaiting acceptance and delivery failures; it does not
infer owner work from record-only facts.

Detailed procedures live in
[event-runtime-audit.md](../2b-manual/event-runtime-audit.md).

## Integrity checklist

- Every published event has a canonical typed envelope.
- Every fact-to-work transition is explicitly declared and idempotent.
- App subscriptions translate facts through the shared input-to-task resolver;
  exact task targets wake only the named task.
- Passive listeners never satisfy semantic delivery or delay acceptance.
- Event acceptance never implies request/task/domain completion.
- No unhandled fact falls back to a generic owner inbox.
- No request or task lifecycle is represented by an event pair.
- Continuation and reconciliation are safe to repeat.
- Retention protects causal evidence referenced by unfinished work.
- Compatibility normalization is isolated at ingress and cannot create a
  second actionable route.
- Conversation projection is reconstructed from existing durable evidence and
  never becomes another work store.
