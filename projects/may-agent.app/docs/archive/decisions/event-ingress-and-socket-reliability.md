# Event Ingress And Socket Reliability

**Historical context:** [Events And Task Admission](../../2a-design/events.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Socket/receipt mechanics implemented; App ownership sections
superseded by `canonical-agent-app-migration.md` (2026-08-15)
**Scope:** App/agent event ingress, durable receipts, Unix socket behavior,
retry safety, and the bounded EventBus subscriber contract

> Retain the socket, receipt, retry, and bounded-subscriber decisions. Do not
> implement this document's event-pair/owner-inbox work model: addressed work
> now belongs to App Inbox and durable desired work belongs to App tasks.

## Decision

Keep the existing EventBus model and make the socket contract precise. Public
interfaces choose the semantic boundary before entering the socket:

```text
app request      -> app intent event
agent message    -> chat/session intent event
typed app action -> bounded action RPC -> one semantic app event
```

Every semantic event then follows one ingress path:

```text
socket frame
  -> validate and normalize
  -> EventBus.emit(event)
       -> persist event and trace first
       -> offer it to bounded routing subscribers
       -> record responsible delivery acceptance
       -> return the persisted event
  -> reply ok { eventId }
```

Do not add `EventBus.accept()`, a second event service, a dispatcher/outbox, a
generic handled state, or automatic replay of the event log.

The socket is a local transport adapter. The EventBus remains the single event
entry point inside the daemon. The event store remains durable evidence and
coordination metadata, not a general job queue. App and agent interfaces share
this plumbing without becoming the same semantic interface.

## Why

The current design already has the necessary lifecycle boundaries:

- persistence answers whether the signal was durably recorded;
- event delivery answers whether a responsible consumer accepted it;
- an event pair answers whether a promised typed response arrived;
- a trace answers what caused and fulfilled the work;
- project, task, alert, session, and workflow records answer domain-specific
  state questions.

Adding another acceptance or dispatch lifecycle would duplicate these
questions and make recovery ambiguous. It would also conflict with the design
rule that the in-process bus is not a durable exactly-once queue.

The actual reliability requirement is smaller:

> Never acknowledge an event that was not persisted, never interpret a receipt
> as completion, and make an ambiguous client retry safe.

## Terms

Use distinct words for distinct facts:

| Term | Meaning |
| --- | --- |
| Event receipt | The canonical event and trace were durably persisted; identified by `eventId`. |
| Delivery acceptance | A target, durable owner inbox, or explicitly classified evidence projection took responsibility. |
| Typed response | A later event fulfilled an opening event commitment. |
| Domain completion | The owning task, project, alert, escalation, or other domain entity reached its own accepted outcome. |

Avoid the phrase "accepted into the transport." It is weaker than the actual
contract and is easily confused with delivery acceptance. Socket `ok` for an
event means **durably persisted**.

## App And Agent Interface Alignment

Use one shared infrastructure model with two distinct public promises:

> An app request addresses an outcome and lets the app choose the handler. An
> agent message addresses a capability or conversation and fixes the handler.

| Concern | App request | Agent message |
| --- | --- | --- |
| Address | App/domain outcome | Named agent or existing conversation |
| Opening event | `project.comment.created` or typed app event | `chat.start.requested` or `session.steer.requested` |
| Handler choice | App owner chooses direct judgment, workflow, task change, or no-op | Caller has selected the agent/session |
| Semantic closure | `project.owner.reviewed` with task references | `session.idle` / `session.end` plus channel delivery |
| Durable continuation | Project task and exact Conditions | Persistent chat/session transcript |
| Coalescing | Stable task may combine wakes while retaining each intent reference | Conversation turns remain ordered and distinct |

Both use the same event envelope, persistence, receipt, delivery metadata,
trace, retry rules, and agent runtime. A project request may create an agent
session internally, but that session is execution evidence rather than the
app's completion identity.

Do not collapse the public surfaces into an ambiguous generic
`send(target, message)`. Keep explicit operations such as:

```text
apps.sendIntent(appId, message)       -> event receipt
agents.sendMessage(agentId, message)  -> event receipt
events.get(eventId)                   -> trace and typed result
```

If an agent conversation determines that durable project work is needed, it
emits a linked app-intent event. It does not silently turn the chat session into
project task state.

## EventBus Contract

`EventBus.emit(event)` remains the only internal emission operation.

Its ordered contract is:

1. inherit or establish trace context;
2. persist the event, body reference, correlation columns, and trace atomically;
3. fail closed if persistence fails;
4. offer the persisted event to `first` and then normal subscribers;
5. isolate subscriber failures and emit durable failure evidence;
6. record the first valid responsible delivery result or owner fallback; and
7. return the emitted event with its persisted row ID.

There is no second public `persist`, `accept`, `publish`, or `dispatch` method.
Persistence-first behavior is an EventBus invariant, even though `DbWriter`
owns the storage implementation.

### Bounded subscriber rule

A subscriber runs synchronously only long enough to:

- match and reject/accept the event;
- perform a small deterministic projection;
- persist a task trigger or other durable continuation; or
- schedule bounded asynchronous work.

A subscriber must not synchronously run an agent, workflow, network request,
large filesystem scan, or unbounded database maintenance pass. Work that must
survive restart is accepted only after its task, inbox item, or other durable
continuation is recorded.

An explicit evidence projection counts as delivery only for event types that
the accepted event contract classifies as observation or terminal evidence. A
generic projection, pair tracker, log writer, or default owner label must not
hide a missing domain consumer. A domain no-op is a responsible consumer's
typed decision, not a fallback invented by the bus.

When acceptance creates an owner-inbox continuation, the inbox record and
delivery metadata are committed atomically. A failure leaves the source event
pending and produces an infrastructure health signal; it must not leave an
accepted event with no queryable continuation.

Subscriber duration and event-loop backlog should be measured. A slow
subscriber is a daemon health problem even if the socket writes an earlier
receipt, so early acknowledgement is not a substitute for this rule.

### Subscriber failure

After persistence, one subscriber failure does not invalidate the event
receipt and does not stop unrelated subscribers. The bus emits
`subscriber.failed`, continues routing, and applies the normal owner fallback
when no domain consumer accepts responsibility.

Failure to record delivery metadata leaves the event visibly pending and emits
an infrastructure signal. If the database cannot persist that signal, a guarded
log/metric fallback reports it without recursively emitting another failing
delivery update. It must not silently manufacture an accepted state.

## Socket Contract

The control socket has three bounded roles:

- canonical event ingress;
- explicit event-stream subscription and small status reads; and
- generic control RPC for live daemon-owned registries that cannot be evaluated
  correctly in an external adapter.

A declared app action is the important example of the third role. The external
adapter cannot validate or execute its event factory without duplicating the
daemon's loaded app registry. Keep one generic discovery RPC and one generic
invocation RPC, currently `project.actions.describe` and
`project.action.invoke`. Invocation validates through the app action service,
emits one semantic event, and returns that event ID.

These RPC frames are not durable product commands and do not create an action
lifecycle. Do not add one socket command per declared action, task mutation,
workflow selection, or app-specific status machines.

### Event response

For every admitted canonical event frame:

```json
{ "type": "ok", "command": "project.comment.created", "eventId": 3644962 }
```

The server returns `ok` only when a positive persisted `eventId` exists. A
durable event path that produces no ID is an infrastructure error, not a weaker
success.

An invalid frame or persistence failure returns:

```json
{ "type": "error", "command": "project.comment.created", "message": "..." }
```

No semantic event exists when validation fails before persistence.

Socket receipt does not claim that:

- a target accepted delivery;
- an owner reviewed the event;
- an agent or workflow ran;
- a task was created or completed; or
- a result reached a human channel.

Those facts remain queryable through delivery metadata, traces, typed response
events, and domain state.

### Command clients and subscribers

A newly connected client receives the welcome frame but no live event stream.
It receives events only after an explicit `subscribe` command. This prevents
event broadcasts from interleaving unexpectedly with one-shot command replies.
`waitForSocketEvent` and other stream clients must subscribe after the welcome
frame rather than relying on implicit broadcasts.

A one-shot client:

- allows one in-flight frame per connection;
- ignores the welcome frame and unrelated event frames;
- accepts only the expected `ok`, `error`, or `status` response;
- validates the response command where applicable;
- resolves only after an explicit successful response; and
- rejects if the socket closes or times out first.

Socket close after a successful write but before a receipt has an **unknown
outcome**. It is never treated as success.

### Resource and access limits

Use fixed conservative defaults in the server for:

- a maximum frame size before JSON parsing;
- a maximum incomplete read buffer per connection;
- bounded outbound buffering and slow-client eviction;
- bounded error previews;
- a connection limit appropriate for a local control plane; and
- socket mode `0600`.

Do not add configuration for every transport limit. Add `0660` group sharing or
limit overrides only when a concrete deployment requires them.

An oversized or malformed frame is rejected locally and does not become a
semantic event.

## Retry And Idempotency

Idempotency is part of ingress retry safety, not a new request entity.

An external producer that may retry supplies an `idempotencyKey`. The adapter,
not an untrusted request body, supplies the ingress identity used for its scope:

```text
semantic event type + trusted ingress source + project/domain scope + key
```

HTTP, Telegram, and other authenticated adapters derive the ingress source from
their authenticated channel. Raw Unix-socket event ingress is privileged local
control-plane access; it is not made authenticated merely because the event
payload contains a `source` string.

Rules:

- first use persists the event and returns its ID;
- reuse with the same canonical input and `accepted` delivery returns the
  original event ID without routing again;
- reuse with the same canonical input and `pending` or `unhandled` delivery may
  reoffer the original persisted event for responsible routing;
- reuse with different canonical input is rejected;
- redelivery preserves the original event ID, trace, source, and body; and
- subscribers and continuations that can see redelivery are idempotent by event
  ID or reconcile current durable state.

The guarantee is one persisted event plus at-least-once responsible routing,
not exactly-once effects. An accepted event is not rerouted merely because the
caller lost its receipt. A pending event may be rerouted because the daemon may
have crashed after persistence but before recording responsibility.

There is still an ambiguity if a subscriber performed an effect and crashed
before delivery metadata was recorded. Therefore a responsible subscriber must
record an idempotent task trigger, inbox item, or other durable continuation
before performing non-idempotent work. Enabling pending-event redelivery
requires an audit of every subscriber that will see the event; broad fan-out
cannot be assumed replay-safe.

Store `idempotency_key`, `idempotency_scope`, and a canonical input hash in
indexed event columns. Enforce uniqueness across event type, trusted ingress
source, scope, and key. Do not query a possibly truncated JSON body to establish
uniqueness. The canonical hash excludes volatile transport timestamps and
compares the semantic envelope/body used for the original event.

## Restart And Recovery

Do not replay every pending event at daemon startup. `delivery_status=pending`
means that responsible delivery has not yet been recorded; it is not an outbox
queue state.

Recovery uses the existing mechanisms:

- an ambiguous external caller retries with the same idempotency key;
- durable task and workflow/session mechanics recover their own attempts;
- owner inbox state remains queryable;
- overdue pending/unhandled delivery is surfaced by event health; and
- a reconciler re-emits a wake from current domain state when continuation is
  mechanically safe.

Automatic event-log replay would duplicate effects, create new ordering rules,
and compete with domain reconcilers for authority.

## Failure Semantics

| Situation | Result |
| --- | --- |
| Invalid or oversized frame | `error`; no semantic event. |
| Event persistence fails | `error`; no subscribers or domain effects run. |
| Event persists and a subscriber throws | `ok {eventId}`; failure evidence and remaining routing continue. |
| Delivery metadata update fails | Event remains pending; emit/log infrastructure failure. |
| Socket closes before explicit response | Client reports unknown outcome; retry with the same key. |
| Same key/input and accepted event | Return the original ID without rerouting. |
| Same key/input and pending or unhandled event | Return the original ID and reoffer responsible routing only after subscriber idempotency is proven. |
| Same key and different input | Reject as an idempotency conflict. |
| Slow synchronous subscriber | Receipt may be delayed; measure and move the work behind a bounded durable handoff. |
| Daemon restarts after persistence | Event remains auditable; retry/reconciliation handles continuation without global replay. |

## Implementation Notes

- One-shot clients require a matching explicit response. Close or timeout
  before that response is an unknown outcome, never synthetic success.
- Stream clients subscribe explicitly; ordinary command connections do not
  receive event broadcasts.
- Semantic event success requires a positive persisted `eventId`.
- Indexed idempotency metadata uses trusted adapter ingress identity, domain
  scope, key, and canonical input hash rather than event-body JSON queries.
- Accepted duplicates return the original receipt. Pending or unhandled
  duplicates recover through the built-in idempotent pair, evidence, or owner
  route. They do not replay ordinary fan-out subscribers whose effects may
  already have happened.
- Owner-inbox continuation creation and delivery acceptance are one
  transaction; failure leaves the event pending and emits an infrastructure
  warning through the independent log channel.
- Frame, buffer, connection, outbound-backpressure, error-preview, and socket
  permission limits use fixed conservative defaults.
- Persistence and ordinary synchronous subscriber duration are measured; slow
  callbacks produce a warning without recursively emitting another event.

## Implementation Sequence

### 1. Correct the receipt

- reject socket close before an explicit response;
- match the expected response and command;
- require `eventId` for successful canonical event ingress;
- document `ok {eventId}` as persisted receipt; and
- keep ordinary command clients unsubscribed while stream clients explicitly
  subscribe after the welcome frame.

### 2. Make retry honest

- add indexed source/scope/key/hash storage and scoped uniqueness;
- reject key reuse with a different canonical input;
- return accepted duplicates without routing;
- reoffer only pending/unhandled persisted events after auditing subscriber
  idempotency;
- test the lost-receipt and crash-after-persist windows.

### 3. Make acceptance atomic

- classify which event types may be accepted by evidence projection;
- reject generic bookkeeping as domain delivery;
- commit owner-inbox creation and delivery metadata together; and
- surface delivery-recording failure without recursive failure emission.

### 4. Bound the transport and subscribers

- add frame, buffer, connection, and outbound backpressure limits;
- set restrictive socket permissions explicitly;
- measure subscriber duration and event-loop backlog;
- move any observed long synchronous subscriber work behind an existing
  task/inbox/queue handoff.

### 5. Preserve the generic action boundary

- keep one generic action-discovery RPC and one generic invocation RPC;
- let the app action service validate input and emit the semantic event;
- require invocation success to return that semantic event ID; and
- reject per-action commands or an action-specific durable lifecycle.

## Verification

Add focused tests for:

- persistence failure produces `error` and no subscriber side effect;
- socket close before response rejects even when the frame was written;
- a successful event response always contains the persisted ID;
- broadcasts cannot satisfy or corrupt a one-shot command response;
- clients receive no broadcasts before subscribing and stream clients subscribe
  explicitly;
- an accepted same-input retry returns the original row without rerouting;
- a pending same-input retry reuses the original event and reaches an
  idempotent responsible consumer;
- duplicate different-input retry is rejected;
- retry after simulated persist-before-route failure can reach a consumer;
- caller-supplied source cannot spoof the trusted ingress identity used for
  idempotency scope;
- owner-inbox acceptance and creation of its continuation are atomic;
- subscriber failure does not block other subscribers and emits failure
  evidence;
- generic action discovery/invocation returns the semantic event receipt and
  creates no action lifecycle event;
- oversized frames and slow outbound clients are bounded;
- socket filesystem permissions are restrictive; and
- event, delivery, pair, trace, and domain completion remain distinct in API
  readouts.

## Non-Goals

- exactly-once effects;
- a durable generic message broker;
- global startup replay;
- another request, command, or job entity;
- a second task scheduler or reconciler;
- asynchronous EventBus subscriber semantics;
- one socket command per app action or an action-specific command lifecycle; or
- changing project, task, workflow, or owner authority.

## Review Criteria

Accept this proposal if it preserves these properties:

- one canonical event and one persisted receipt;
- one EventBus emission operation;
- persistence before routing side effects;
- clear separation of receipt, delivery, typed response, and completion;
- retry safety without an exactly-once claim;
- bounded synchronous subscribers;
- explicit app-outcome versus agent-conversation semantics on shared ingress;
- generic action translation without a durable command lifecycle;
- no durable queue hidden inside the event store; and
- no per-product growth of the control socket.
