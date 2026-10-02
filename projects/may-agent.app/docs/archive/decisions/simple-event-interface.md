# Simple Event Interface

**Historical context:** [Events And Task Admission](../../2a-design/events.md). Retained rationale and evidence; this record does not define the current contract.

> Historical record. Use the [current contract index](../../INDEX.md) for present behavior; dated claims below describe their original review.


**Status:** Accepted; current contract lives in Tier-2 design.  
**Scope:** One event boundary for Web, CLI, console, integrations, Host code,
and App-produced output

**Conversation refinement:** May Console and Telegram now use one human
`conversation.message.created` event on `Conversation may:primary`. That event
is the shared-context message and the required route that admits one fenced May
App request. Generic `app.input.requested` remains the addressed-input event for
App actions, schedules, delegation, and non-conversation callers. This is a
specialized event type on the same `publish/get/subscribe` interface, not a
second ingress mechanism.

## Decision

Use one event interface for every state-changing input:

```text
publish(event)    durably enter an event
get(eventId)      read the event, delivery, and linked outcomes
subscribe(filter) observe new events
```

An event can ask for something or report something:

```text
app.input.requested       asks one App to take responsibility
session.cancel.requested  asks one Host controller to act
validation.completed      reports a fact that zero or more routes may use
```

These are different promises carried by the same event mechanism. They do not
need separate transport APIs, queues, receipts, or lifecycle frameworks.

The compact rule is:

> Everything enters as an event. The event type determines what must become
> durable before the Host calls it accepted.

## Mental model

The architectural boundary stays unchanged:

```text
Host = persist, schedule, run, recover, deliver
App  = meaning, policy, desired outcomes, acceptance
```

Events are how input and change move through the Host. A request, task,
session, result, or delivery may be linked to an event, but those records still
hold the state needed to recover unfinished work.

```text
event
  -> recorded
  -> event-type route
  -> optional durable responsibility
  -> linked progress and outcome
```

The event ID is the caller's root correlation identity. Linked records are not
alternate ingress systems; they are how the Host keeps the promise made by
that event.

## Public contract

The caller supplies semantic input only:

```ts
type EventInput = {
  type: string;
  target?: {
    appId?: string;
    taskId?: string;
    sessionId?: string;
  };
  data: Record<string, unknown>;
  idempotencyKey?: string;
};
```

The Host supplies persistence identity, time, trusted provenance, routing
metadata, and causal trace.

```ts
type EventReceipt = {
  eventId: number;
  eventType: string;
  delivery: "recorded" | "accepted";
  links?: Array<{
    kind: "request" | "task" | "session" | "delivery" | "operation";
    id: string;
  }>;
};
```

`recorded` means the event is durable. That completes a record-only
publication; for a required event it means no route has durably accepted
responsibility yet. `accepted` means a required route accepted responsibility.
Neither means the requested domain outcome is complete.

Publication makes one bounded delivery attempt before returning. HTTP returns
`202` when a required event is durable but still only `recorded`; the caller
uses the same event ID to observe recovery. It never waits for domain work to
finish.

`get(eventId)` returns a bounded view:

```ts
type EventView = {
  event: StoredEvent;
  delivery: {
    state: "recorded" | "accepted" | "unhandled" | "failed";
    acceptedBy?: string;
    note?: string;
  };
  links: Array<{
    kind: "request" | "task" | "session" | "delivery" | "operation";
    id: string;
    state?: string;
    summary?: string;
  }>;
};
```

The view links to authoritative records; it does not copy their mutable state
into the event row.

## Event definitions

Every event uses either an explicit definition or the default record-only fact
contract:

```ts
type EventDefinition = {
  type: string;
  schema: Schema;
  delivery: "record" | "required";
};
```

- `record` means durable recording satisfies publication. Declared routes may
  still react.
- `required` means exactly one compatible route must durably accept
  responsibility. A successful receipt includes the linked responsibility.

“Exactly one” means one semantic responsibility route. Logging, metrics,
tracing, and live-stream observers may still observe the same event without
becoming accepters.

Required event types always have an explicit definition. A trusted internal
producer may publish an unregistered fact using the common envelope; it gets
the default `record` contract and remains a valid recorded observation. External
adapters admit only explicitly allowlisted types and schemas.

This is a Host ingress registry, not an application handler catalog inside the
EventBus. App subscriptions, task subscriptions, and observation selectors
remain part of the loaded App generation.

The definition, not the suffix or target shape alone, controls delivery.
`*.requested` is a naming convention that communicates intent; it is not a
hidden router.

Before persistence the Host verifies:

- the event type is explicitly admitted by that producer or adapter;
- `data` satisfies its schema;
- required target fields are present and valid;
- a required route exists; and
- the caller cannot supply Host-owned envelope fields.

A known required event whose route is temporarily unable to finish admission
may remain `recorded`. Recovery retries the same event until it is `accepted`
or visibly failed. An unknown type, invalid body, or nonexistent required
target creates no receipt.

Declared durable routes for record-only events are recoverable too. The
difference is that their publication does not promise that any consumer will
take responsibility.

## Routing

Routing is explicit in the event definition and loaded App declarations:

```text
app.input.requested
  target.appId -> exactly one durable App request

session.cancel.requested
  target.sessionId -> exactly one session controller operation

validation.completed
  -> zero or more declared App/task subscriptions
  -> observation is still valid when none match
```

`target` selects an instance within the type's route. It does not grant an
arbitrary event permission to enter an App inbox, control a session, or wake a
task.

An event that asks for responsibility must have one accepter. An event that
reports a fact may have zero or more consumers. If a fact creates a request,
task intent, or exact wake through a declared route, that linked record is
persisted idempotently and appears in the event view.

There is no fallback that sends an unknown or unhandled event to a generic
owner or agent.

## App input and delegation

Use one standard event when a caller asks an App to handle input:

```ts
{
  type: "app.input.requested",
  target: { appId: "evaluation" },
  data: {
    input: {
      kind: "evaluate-run",
      data: { projectId: "aks-rp-e2e", runId: "run-123" }
    }
  },
  idempotencyKey: "evaluate-run-123"
}
```

Acceptance means the target App input was validated and exactly one durable
App request was created or found by idempotency key. The receipt links that
request. Completion remains the App request's result, not a mutation of the
opening event.

Ordinary May Conversation input therefore still needs only one semantic ingress
event, refined after this decision was accepted:

```text
conversation.message.created target.appId=may
  conversationId=may:primary
  author.kind=human
  -> May App request
  -> optional child App request or direct result
  -> channel delivery
```

The adapter attaches human/channel provenance to that message. It does not
first publish a second transport-receipt event or separately publish
`app.input.requested`. Historical `human.input.received` and direct human
`app.input.requested` events remain traceable compatibility evidence.

App-to-App delegation uses the same event semantics without exposing Host
mechanics to App code:

```text
App A returns delegate(App B, input)
  -> Host stores the parent dependency
  -> Host publishes the child app.input.requested event
  -> child event and App B request become durable
  -> Host wakes App B
  -> App B result wakes App A
```

The App still returns the typed `delegate` disposition. It does not call the
EventBus or another App's implementation. The Host turns the accepted decision
into the canonical event and linked records in the safe commit order.

## App-produced events

Apps may report facts, but App policy does not receive a raw Host event bus:

- an observer returns events for the Host to publish after the observer
  succeeds;
- a workflow uses its bounded `ctx.events.emit` capability;
- a request or task result returns pending event intents for Host admission;
  and
- delegation returns a typed disposition that the Host converts to a child
  event.

These typed boundaries preserve result admission, retry safety, and testability.
They all end at the same event persistence and routing path.

## Controls

Session, task, approval, and Host controls are event types with required
delivery:

```ts
{
  type: "session.cancel.requested",
  target: { sessionId: "s_123" },
  data: { reason: "user requested cancellation" }
}
```

The definition validates the exact target and selects the deterministic Host
controller. Acceptance means the control operation is durably correlated or
the requested idempotent state is already true. It does not mean a long-running
session has already reached terminal state.

Ambiguous controls are rejected. A missing session target never expands to
cancel-all, and an App target never acts as authority for a Host lifecycle
control.

## Reads and subscriptions

Events are the write and notification boundary. Reads remain bounded direct
queries:

```ts
getEvent(eventId);
getRequest(requestId);
getTask(taskId);
getSession(sessionId);
listApps();
```

`getEvent` is the convenient root view and includes links. The dedicated reads
remain authoritative for detailed current state.

`subscribe` observes public events. Receiving a stream frame is never delivery
acceptance or completion. Adapters expose bounded filters and public
projections rather than the private EventBus or raw storage.

## Headless Host and optional interfaces

The Host does not depend on HTTP, a socket, Web, CLI, console, or Telegram.
With all interfaces disabled, loaded Apps, schedules, observations, tasks,
persistence, and recovery continue to work.

Each optional adapter receives a narrow interface:

```ts
type InterfaceContext = {
  publish(input: EventInput): Promise<EventReceipt>;
  getEvent(eventId: number): Promise<EventView | undefined>;
  subscribe(filter: EventFilter, listener: EventListener): Unsubscribe;
  reads: PublicReadModels;
};
```

```text
internal producers -------------------+
                                      v
                                Host event boundary
                               publish/get/subscribe
                                      ^
                                      |
            HTTP / socket / Telegram / console adapters
                                      ^
                                      |
                          Web / CLI / integrations
```

Host code calls the function directly. App code continues to use typed SDK
helpers and returned dispositions; the Host funnels their accepted output into
the same function. External code sends the same `EventInput` through an
adapter. The difference ends after validation and trusted ingress context are
attached.

Adding an adapter does not require a plugin system, service framework, or
dynamic discovery. An explicitly enabled adapter that cannot start must be
treated as a startup failure. Headless operation is selected explicitly by
enabling no adapters.

## Provenance, identity, and permissions

This proposal adds no general authentication or authorization model.

`source` remains useful provenance, but it is assigned by trusted Host context
or the ingress adapter. It is not accepted as a self-asserted identity field in
`EventInput`. `owner` is derived from the event definition, target, and loaded
App declaration.

```text
external request
  -> optional authentication and authorization
  -> adapter assigns trusted provenance
  -> publish(EventInput)
```

Until such an outer layer exists, writable network adapters are trusted-
environment interfaces. A local socket may rely on operating-system access
and restrictive permissions; that is isolation, not application identity.

Causal parents are also Host-owned. In-process child publication inherits the
current event context. External reply anchors are resolved by the adapter and
attached as trusted ingress context rather than allowing arbitrary callers to
rewrite trace ancestry.

## Reliability

The shared path guarantees:

1. Validate the known type, body, target, and route before persistence.
2. Persist before returning a receipt.
3. Recover every declared durable route idempotently; required delivery cannot
   become `accepted` until its linked responsibility is durable.
4. Scope idempotency by event type and canonical target.
5. Return the same event ID for the same key and payload.
6. Reject reuse of the same key with a different canonical payload.
7. Keep subscribers bounded; they create durable continuation rather than
   performing long work synchronously.
8. Preserve the event and visible delivery failure if post-persistence routing
   fails.
9. Derive child trace links inside the Host.
10. Protect events referenced by unfinished linked work from retention cleanup.

The in-process bus is not itself the work queue. App requests, tasks, session
operations, and deliveries remain the recoverable records linked from events.

## Alignment with the accepted design

This proposal changes the public interface vocabulary, not Host/App ownership.

| Accepted design | Kept invariant | Refinement if accepted |
| --- | --- | --- |
| [System model](../../2a-design/system-model.md) | Host owns mechanics; App owns meaning and acceptance | Inputs and facts are both represented by events at ingress |
| [Host/App boundary](../../2a-design/system-boundary.md) | Interfaces cannot call owners or execution directly | Its four write meanings become event definitions behind one `publish` operation |
| [Events](../../2a-design/events.md) | Persist first, explicit routes, no owner fallback, delivery is not completion | “Event” includes requests and controls as well as reported facts |
| [Agent App](../../2a-design/agent-app.md) | Typed App definitions, dispositions, subscriptions, and tasks remain authoritative | Host publishes canonical events for admitted App decisions |
| [SDK](../../2a-design/sdk.md) | Apps receive bounded typed capabilities, never Host internals | SDK helpers construct or return events without exposing the EventBus |
| [Runtime](../../2a-design/runtime.md) | One Host owns admission, recovery, concurrency, and delivery | Existing admission/control functions become handlers behind event definitions |
| [HTTP](../../2a-design/http-boundary.md) | HTTP is an adapter; reads are bounded; receipts are honest | Selected request/control types may use the same event endpoint as facts |
| [Human control](../../2a-design/human-control-surfaces.md) | May owns human closeout; exact controls stay deterministic | One root input event replaces a transport fact followed by a duplicate semantic intent |
| [Sessions](../../2a-design/sessions.md) | Session is bounded execution evidence, not work authority | Session event types use required delivery where they ask a controller to act |
| [Event graph](../../2a-design/event-graph.md) | Event IDs and trace links provide causal navigation | Root events link to authoritative request/task/session/delivery state |

The terms `request`, `task`, `fact`, and `attempt` remain useful descriptions
of meaning and stored state. They are not separate public ingress mechanisms.

## Adoption

The Tier-2 design now uses this model throughout. The implementation follows
the same small shape:

- `event-interface.ts` owns `publish`, `get`, `subscribe`, the external
  allowlist, validation, and the explicit `record`/`required` table;
- socket and HTTP adapters pass semantic `EventInput` and cannot author the
  trusted source or owner envelope;
- App input, direct chat, exact session controls, and Host lifecycle controls
  use retry-safe durable routes;
- App input links the root event to its durable App request, while direct chat
  links to its deterministic session;
- ordinary new May input publishes one `app.input.requested` root; and
- Apps receive typed SDK capabilities, never the Host event interface or raw
  `EventBus`.

Console, Telegram, HTTP, Web UI, direct chat, runtime controls, and session
controls now construct semantic `EventInput` and use `publish`. The old human
socket shortcuts have been removed after repository and retained-event audits
showed no live caller. Canonical operator events and `trigger.*` remain a narrow
compatibility boundary for `may-agent --emit`; retained evidence shows that
deployed App operations still publish unregistered facts through it. That path
does not define another human or task lifecycle.

Do not replace the App inbox, task engine, session manager, delivery outbox, or
read models. Do not add a broker, command framework, plugin loader, identity
framework, or second event service.

## Conformance proof

The accepted contract requires these checks:

- the Host operates with no interfaces enabled;
- one `EventInput` with the same idempotency key produces the same event ID and
  semantics through direct, HTTP, and socket ingress;
- invalid types, bodies, targets, and required routes create no receipt;
- idempotent retries return the original event ID and linked responsibility;
- a record-only event can remain valid with no consumer;
- a required event cannot report `accepted` before its linked responsibility is
  durable;
- routing recovery completes a recorded-but-unaccepted required event;
- `app.input.requested` reaches exactly one App request and exposes its link;
- App delegation creates the parent dependency before waking the child;
- exact controls cannot broaden their target;
- an App cannot access the raw EventBus through the SDK;
- stream observation never counts as acceptance or completion;
- all adapters use only bounded interface capabilities; and
- existing App inbox, task, session, HTTP, socket, and event tests retain their
  semantics.

## Non-goals

- Replacing Host work records with an event log.
- Making event delivery equal domain completion.
- Giving Apps raw runtime or EventBus access.
- Adding exactly-once execution.
- Inferring a target or owner for unknown events.
- Designing authentication, roles, or permissions.
- Exposing every internal event through every adapter.
- Turning reads into request events.
- Dynamically discovering interfaces or event handlers.

## Review questions

1. Is there a proven delivery contract that cannot be expressed as `record` or
   `required`?
2. Which small set of event types should the first HTTP and socket allowlists
   expose?

## Review Comments

### Round 1 (2026-08-16)

**Verdict: accept.** This is the natural completion of the runtime
simplification — the inbox migration removed overlapping work-tracking
mechanisms, and this removes overlapping ingress mechanisms. The system goes
from five ways to put input in (HTTP endpoints, socket frames, Telegram
parsing, internal EventBus, compatibility adapters) to one way
(`publish(EventInput)`) with two delivery contracts. That is a genuine
simplification.

**Answer to review question 1:** No. The only candidate is "fire and forget,
don't retry" — but that is just `record` with no declared route, which
already works. Every other delivery pattern maps cleanly: "one accepter must
take responsibility" is `required`; "zero or more may observe" is `record`;
"at-least-once durable route" is a declared route on a `record` event with
recovery. Two contracts are sufficient.

**Answer to review question 2:** Start with 5–8 types and grow per measured
usage:

- `app.input.requested` (human messages and cross-app delegation)
- `session.cancel.requested`
- `task.approval.submitted`
- `host.reload.requested`
- `metric.snapshot` (record-only, dashboard observation)
- `app.health.observed` (record-only, dashboard observation)

The allowlist should be explicitly enumerated in the adapter config and
expanded only when a real consumer demonstrates the need. Do not expose all
internal event types by default.

**Three suggestions for the doc:**

**1. State the inbox routing boundary explicitly.** The inbox scope reduction
proposal says "signals that wake existing work go directly to the task
resolver, not the inbox." This proposal says `app.input.requested` creates a
durable App request. Those are compatible but the connection is implicit. Add
one sentence: "Record-only events that match a task subscription wake the
task resolver directly without creating an App request. Only
`app.input.requested` and direct-agent session events create durable inbox
items or session requests."

**2. State how child idempotency keys are derived during delegation.** The
doc says "Scope idempotency by event type and canonical target" and "Return
the same event ID for the same key and payload." When App A delegates to
App B, the Host publishes a child `app.input.requested` event. If the
child's idempotency key is random, a retry of the parent's admit creates a
duplicate child. State that the Host derives child idempotency keys
deterministically from the parent request ID and disposition content, so that
retried admission is safe.

**3. The `EventDefinition` registry needs an ownership rule.** The doc says
"This is a Host ingress registry, not an application handler catalog inside
the EventBus." But it does not say who may add a definition. Can an App
declare new event types in its `defineApp`? Or are all definitions
Host-owned? If Apps can contribute types (e.g. gym declares
`gym.regression.requested`), the registry grows with App generations and
must be validated atomically with the App snapshot. If only the Host owns
definitions, Apps must use generic `app.input.requested` with their
domain-specific `input.kind` for everything. The current implementation
appears to use the latter (Apps route through `app.input.requested` or task
subscriptions), but the doc should state this explicitly so no one attempts
to register custom required-delivery types from App code.

### Resolution after the Conversation refinement

The review predates the shared Conversation implementation. Its general
conclusion still stands: one `publish/get/subscribe` interface and the
`record`/`required` contracts are sufficient. Three details are now explicit:

1. May Console and Telegram publish required `conversation.message.created`,
   not generic `app.input.requested`; only a human author derives a fenced May
   request. Other authors are accepted as context without creating work.
2. Generic `app.input.requested` remains the route for App actions, schedules,
   delegation, and non-conversation callers; task subscriptions still wake task
   resolution without creating an unrelated inbox item.
3. Required event definitions remain Host-owned. Apps contribute typed inputs,
   actions, and declared subscriptions, not EventBus handler registries.

Child delegation idempotency remains derived from the durable parent request
and disposition identity, so retrying a parent cannot create a duplicate child.
