# Human Control Surfaces

**Design status:** Accepted.
**Implementation status:** Implemented through canonical May App admission,
explicit dependencies, and correlated channel delivery.

## Purpose

CLI, Web, Telegram, and May Console are transports over one human-request
contract. They may present different interaction styles, but they cannot create
different ownership, completion, or recovery semantics.

```text
app.input.requested -> linked May App request -> answer or delegation
                    -> May review -> channel delivery -> correlated completion
```

The opening event is the correlation/navigation identity. The linked May inbox
item—not a chat session, event pair, trace, reply ID, or inferred topic—is the
durable authority for one human request that requires a result.

## Layers

```text
transport
  -> normalize human/channel identity and reply anchor
  -> construct one typed EventInput
  -> Host publish(event)
     -> ordinary request: required May App route
     -> explicit control: required deterministic route
     -> project comment: record-only declared App route
     -> App action: validate schema, then required App input route
  -> canonical runtime ownership
  -> bounded read/progress/delivery projection
```

Transport adapters own encoding, channel IDs, reply anchors, and presentation.
They do not choose project tasks, run agents/workflows, mutate storage, or infer
completion.

## Ordinary human requests

Every ordinary turn publishes one `app.input.requested` event targeting the
`may` App. The event links to exactly one admitted May request with:

- stable request ID and idempotency key;
- human/channel source identity;
- normalized text or structured payload;
- optional conversation/thread and reply anchor;
- bounded referenced context; and
- delivery destination.

May performs one bounded owner pass. It may:

- answer directly;
- delegate a typed child request to one domain App; or
- use one bounded audited break-glass attempt when canonical delegation cannot
  safely fulfill the request.

When May delegates, its inbox item remains unfinished and waits on the exact
child App result. The domain App may complete directly or attach durable task
work. Child completion wakes May for final review. May's request completes only
after the final response reaches a terminal delivery state under the channel's
certainty policy.

May has no schedules, observers, or task attachment. It owns conversation and
closeout, not background project work.

## Conversation and sessions

A conversation is a bounded read model over related May requests, channel
messages, traces, and preferences. It helps prepare context but owns no work.

A session is a bounded model execution container. One conversation may use
many sessions, and one process restart may replace a session without changing
the owning May request. No promised result, caller identity, or delivery route
may depend on a mutable “current session.”

For every May owner pass, runtime prepares context from:

- the exact request and source;
- its current child/dependency observation;
- the resolved reply anchor/trace where available;
- a bounded nearby conversation projection;
- relevant durable preferences; and
- explicit domain evidence referenced by the request.

It never reconstructs ownership from text similarity or global transcript
search. If a reply cannot be resolved safely, May asks one focused clarification
rather than attaching it to guessed work.

## Concurrent request threads

One conversation can contain multiple unfinished requests. Each May inbox item
is an independent thread with its own child dependency and delivery operation.

Resolution order for a channel reply is:

1. exact reply/message anchor to May request or child result;
2. exact explicit request/project/task reference;
3. the only plausible unfinished request in that conversation; or
4. one focused clarification.

Never use “most recent session” or fuzzy text similarity as durable routing.
Concurrent May sessions capture immutable source context so tool results and
delivery cannot leak across requests.

## Long-running work

May must not promise a future result unless it has established durable
continuation before ending its current owner pass:

```text
May request
  -> child App request
  -> optional exact task identity / Conditions
  -> child terminal result
  -> May wake and review
  -> final delivery
```

A status update, spawned session, event, trace, or “I will follow up” statement
is not continuation. The child App/task must own the unfinished outcome and the
May request must wait on its exact identity.

Progress does not automatically notify the human. Domain Apps publish current
facts; May communicates when the user asked for progress, a decision is needed,
a declared checkpoint is missed, or terminal evidence is available.

## Direct deterministic controls

Some explicit commands do not need May judgment:

- steer or cancel a named active session;
- broad cancellation with explicit confirmation/scope;
- submit a typed approval/rejection for its owning task Condition;
- reload, restart, shutdown, or status where authorized; and
- invoke a declared App action after schema validation.

Each control is a required event with an exact target. The controller accepts
it mechanically only after its operation is durably correlated or the exact
idempotent state already holds. When the control originated inside an ordinary
human request, that result and any human response remain linked to the May
inbox item.

Bare or ambiguous cancellation never expands to cancel-all. An approval applies
only to the exact task/Condition generation named by the prompt.

## Project comments and App actions

Project steering has two distinct ingress forms.

### Free-form project comment

```text
project.comment.created fact
  -> declared Agent App subscription
  -> pure toInput translation
  -> correlated Agent App inbox request
```

The HTTP/transport receipt distinguishes the event being `recorded` from a
required route being `accepted` and includes linked identities. The project
App's result and any attached task remain separate. A
project comment that is merely a deterministic changed fact may instead be
handled by a task subscription, but this classification must be explicit and
tested.

### Declared App action

```text
discover action schema -> validate parameters -> action.toInput
  -> app.input.requested -> linked App request
```

An action does not emit an actionable semantic event as a shortcut. Its App
request result may complete directly, delegate, or attach a task.

## Delivery contract

Human delivery is a Host operation linked to the originating May
request:

```text
May result -> outbox operation -> channel adapter -> delivered / failed / uncertain
```

The runtime distinguishes semantic completion from channel delivery. A May
request requiring a response is not fully closed until the delivery policy has
terminal evidence.

Uncertain delivery is never retried blindly because duplicate human responses
may be harmful. Runtime first observes provider/channel state or asks for
operator judgment while preserving the same request identity.

Outbound notifications that are not replies still carry stable source App/task
and trace references so a later human reply can become a new correctly
addressed May request.

## Surface contracts

### CLI

CLI supports:

- ordinary May input;
- explicit `/steer <session>`, `/cancel <session>`, scoped cancel-all;
- App/action discovery and invocation;
- status/read commands; and
- authorized reload/restart/shutdown controls.

Compatibility shortcut frames normalize at ingress and cannot create a second
request or event lifecycle.

### Telegram

Telegram normalizes chat/topic/message/reply identity, admits ordinary messages
to May, and maintains a durable channel-message index for reply correlation.
Slash controls remain explicit. The adapter does not select domain tasks or
send project results independently of May delivery.

### Web

The Web UI uses bounded GET projections and typed POST controls. It shows the
target and accepted identity before claiming work is queued. Project actions
are discovered from loaded App schemas. Opening a page or websocket never
counts as semantic delivery or creates work.

### May Console

May Console uses the same event publication and read operations. It
may display richer execution context but has no privileged ownership path.

## Honest receipts and status

Surfaces distinguish:

- received/validated transport input;
- App request admitted;
- child request/task attached;
- owner/session attempt running;
- waiting on exact dependency;
- semantic result ready;
- delivery pending/delivered/failed/uncertain; and
- request done.

Never show “done” because an HTTP POST succeeded, an event was accepted, a
session returned success, or a task was merely queued.

## Recovery

On restart:

- App inbox recovery reclaims interrupted May/domain owner attempts;
- parent/child and task dependencies remain durable;
- delivery operations resume under their certainty policy;
- finished idle chat sessions are not replayed as work; and
- a new owner session may be created from the same request/context projection.

Recovery never replays the last human prompt merely because a session marker is
stale. It reconciles the authoritative May request.

## Test contract

All transports prove the same behaviors:

- identical ordinary input admits exactly one May request;
- duplicate transport delivery is idempotent;
- direct answer closes only after required channel delivery;
- delegation records the child before it is woken and later wakes May;
- restart during May or child handling preserves the request/dependency;
- original session loss does not lose work or closeout;
- concurrent requests cannot steal context, tool results, replies, or delivery;
- ambiguous replies ask for clarification rather than guessing;
- project comments/actions reach exactly one declared App route;
- explicit controls target exact session/task/runtime identity;
- uncertain delivery does not duplicate blindly; and
- compatibility ingress produces no parallel lifecycle.

## Integrity checklist

- One human request requiring a result has one May inbox item.
- Conversation, session, event, trace, and reply anchors are context—not work
  authority.
- Domain work crosses through typed App delegation or an explicitly declared
  Agent App subscription/action.
- May retains final human closeout while domain Apps retain project meaning.
- Every future-result promise has a durable child/task dependency before May's
  current pass ends.
- All surfaces share admission, control, recovery, and delivery semantics.
- Transport receipts never imply semantic completion.
- Legacy chat/event-pair follow-through cannot coexist with canonical May App
  ownership.
