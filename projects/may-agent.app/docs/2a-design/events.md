# Events, Delivery, And App Inboxes

**Design status:** Accepted.
**Implementation status:** Implemented. `publish`, `get`, and `subscribe` share
the persistence-first event path; App input links to its durable request, and
owner-event-pair work lifecycles are retired.

## Purpose

An event records input or change that crossed the Host boundary. It may ask one
route to accept responsibility or report a fact for zero or more consumers.

```text
publish(event) -> validate -> persist -> route -> persist linked responsibility -> receipt
```

The event ID is the root correlation identity. An event does not replace mutable
work state: addressed work lives in an App request, durable desired work lives
in a task, and exact controls link to their owning session or operation.

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

App code still uses typed SDK events, dispositions, and capabilities. It never
receives this Host interface or the raw EventBus.

## Delivery contracts

Each admitted event type has one delivery contract:

- `record`: persistence is sufficient; zero or more declared routes may react.
- `required`: exactly one semantic route must durably accept responsibility.

Required types are explicitly defined and validated before persistence. Trusted
internal producers may publish an unregistered record-only fact. External
adapters admit only explicit type/schema allowlists. Logging, metrics, tracing,
and stream observers never count as the one required accepter.

`app.input.requested`, direct-agent `chat.start.requested`, exact session
controls, and Host lifecycle controls are required. Ordinary reported facts
are record-only. A required event may remain `recorded` after persistence when
its route temporarily fails; recovery retries the same event and identity.

## Routing outcomes

The host matches only declared routes:

```text
App subscription  -> pure toInput(event) -> correlated App inbox request
task subscription -> pure resolve(event) -> persisted TaskIntent and trigger
exact task target -> wake that task identity
no actionable route -> retain a valid record-only fact
```

An App subscription has a stable subscription ID and creates a request only
when its translator returns a valid input. The idempotency key derives from App,
subscription, and event identity.

A task subscription declares or revises desired state. The host persists the
latest intent and exact trigger before coalescing the stable task ID in its
queue. A targeted task wake does not run broad resolution.

The same fact may reach several Apps, but one App never derives both an inbox
item and a new or refreshed TaskIntent from it. If an independently correlated
request also needs convergence, its inbox disposition may attach a task after
admission. Exact stored Condition wakes remain additive because they wake work
that already has durable ownership.

There is no target-first owner fallback, `inbox.accepts`, arbitrary `onEvent`
execution, or generic rule that turns an unhandled fact into owner work.

## Addressed requests

Addressed input uses one standard required event:

```text
app.input.requested target.appId=<app>
  -> validate App input
  -> create or find one durable App request
  -> return the request link
```

- human input publishes this event for the `may` App;
- App delegation creates a child App inbox item;
- an App action translates validated parameters to App input;
- an input schedule creates a time-correlated App input; and
- an App subscription translates a fact into an independent request only when
  that fact genuinely requires its own disposition.

An unknown App address is rejected before a receipt exists. It does not fall
back to a generic owner inbox or May.

The inbox item persists `pending -> handling -> done`, with claims, lease
fencing, dependency links, restart recovery, and delivery correlation owned by
the host. The App sees only its typed request and dependency observation. It
returns `complete`, `delegate`, or `task`.

## Delivery acceptance

Event delivery metadata answers whether the event type's contract is satisfied,
not whether resulting work finished. The durable acknowledgement point is:

| Route                       | Accepted after                                                 |
| --------------------------- | -------------------------------------------------------------- |
| App subscription            | translated input is validated and inbox admission is durable   |
| Task subscription           | resolved intent and exact trigger are durable                  |
| Exact task target           | task wake/trigger is durably correlated                        |
| Human/channel adapter       | adapter accepts the outbound delivery operation                |
| Observation-only projection | projection explicitly accepts responsibility for that evidence |
| Record-only event           | persistence; no semantic accepter is required                  |

Logging, UI tailing, passive metrics, database writing, and unrelated broad
subscribers do not count as semantic acceptance.

For asynchronous work, accepted means “the correct durable owner now has it,”
not “finished.” Completion remains in the App inbox item, task resource,
delivery operation, or other owning domain record.

Record-only facts with no consumer remain valid observations. A required event
without durable acceptance remains visible for recovery. Invalid or unknown
external input and nonexistent required targets create no event receipt.

## Results and correlation

Requests and delivery operations carry their own durable correlation instead of
opening event pairs:

```text
May request -> child App request -> optional task -> child result
            -> May review -> delivery operation -> receipt -> May completion
```

An App parent waits on the exact child App, task, or session identity. A task
waits on exact Conditions. A human response waits on its channel delivery
operation. Events provide causal evidence and wakes along those relationships;
they do not recreate the relationships as opener/closer pairs.

Escalation is an explicit cross-owner request linked to its source App request
or task. Its resolution wakes that source obligation. Metric alert state remains
a metric projection; a breach event may wake work but does not own its result.

Trace closure answers which evidence fulfilled an earlier cause. It is useful
for audit but cannot replace inbox/task/delivery completion.

## Human-rooted flow

```text
app.input.requested target.appId=may
  -> linked May inbox request
  -> direct result or child App dependency
  -> May result review
  -> channel delivery operation
  -> delivery receipt
  -> May request done
```

A persistent chat is a conversation container, not the request authority or a
permanent trace. Each admitted human turn has its own request identity. Reply
anchors and traces help recover context; they do not decide which unfinished
request owns the response.

Direct typed runtime controls may bypass owner judgment, but their result and
delivery remain linked to the originating May request.

## Core event vocabulary

The executable schemas remain authoritative. Cross-boundary vocabulary stays
small. Event types may ask for responsibility or report facts; neither turns
the event stream into a work queue.

### Human and execution

- normalized human ingress and channel delivery facts;
- `session.start`, `session.idle`, and `session.end`;
- workflow/execution result and failure facts;
- targeted cancellation, approval, and runtime-control requests where a shared
  controller owns deterministic handling.

Ordinary human language is admitted to May rather than routed through a generic
event-owner fallback.

### App and project

- `project.comment.created` and `project.owner.requested` may be explicit App
  subscriptions when the App owes a distinct result;
- domain/provider observations feed task subscriptions or projections;
- task reconciliation lifecycle events are evidence, not scheduling commands;
- an event with `target.taskId` is an exact wake; and
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

An event schedule publishes a typed fact through the shared scheduler. An input
schedule publishes a time-correlated `app.input.requested` event. The schedule
applies its declared catch-up policy before publication; the standard route
then admits the linked App request.

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
- human roots/results whose delivery evidence is still required; and
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
- App subscriptions create correlated requests; task subscriptions persist
  desired intent; exact task targets wake only the named task.
- Passive observers never satisfy semantic delivery.
- Event acceptance never implies request/task/domain completion.
- No unhandled fact falls back to a generic owner inbox.
- No request or task lifecycle is represented by an event pair.
- Continuation and reconciliation are safe to repeat.
- Retention protects causal evidence referenced by unfinished work.
- Compatibility normalization is isolated at ingress and cannot create a
  second actionable route.
