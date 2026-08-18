# Human Control Surfaces

**Design status:** Accepted.
**Implementation status:** Implemented for May Console and Telegram; legacy
socket shortcuts remain compatibility ingress.

**Aligned with:** [message-lifecycle.md](message-lifecycle.md),
[may-console.md](may-console.md), [events.md](events.md), and
[sessions.md](sessions.md).

## Purpose

Human surfaces are adapters over system resources. They own interaction and
presentation, not work state or meaning.

For May conversation:

```text
Console ──┐
          ├─> Conversation may:primary ─> May App request/reconciliation
Telegram ─┘
```

Console and Telegram may look and behave differently. Console may parse slash
commands and render aligned terminal text. Telegram may use native commands,
buttons, reply anchors, Markdown, or compact messages. Both publish and read the
same semantic Conversation contract.

They also watch the same resource. After a message becomes durably visible,
the Host emits a wake-only `conversation.updated` observation. Adapters re-read
the Conversation and render unseen stable message IDs using their own
presentation. The wake is not a delivery guarantee, and adapters never forward
adapter events directly to one another.

## Shared boundary

Ordinary human text publishes:

```text
conversation.message.created
```

Required data is:

- `conversationId: "may:primary"`;
- `author: { kind: "human", id: <stable channel message identity> }`;
- the raw human `text`;
- optional `replyTo` and channel delivery metadata.

The Host durably admits one fenced May App inbox request from the human message.
Retrying the same adapter message returns the original receipt. Opening a
surface, reconnecting, reading status, or rendering a view creates no human
work.

State-changing controls use their existing typed events, such as
`session.steer.requested`, `session.cancel.requested`, project App actions, and
runtime operations. Read-only controls may remain local reads.

## Adapter responsibilities

An adapter may:

- parse channel-native controls;
- attach provider reply and delivery coordinates;
- watch Conversation changes and render unseen messages;
- choose layout, markup, buttons, pagination, and notification style;
- query the bounded Conversation projection;
- append a durable semantic command/tool view when the human may refer to it;
- emit transient progress or reconnect presentation.

An adapter must not:

- invent a different Conversation identity for its channel;
- infer work from the latest session;
- own a request queue, work archive, or selected-context protocol;
- turn provider delivery state into Conversation or work state;
- make transient presentation part of May's durable context.

## Resource synchronization

Conversation synchronization follows the ordinary resource-watch pattern:

```text
durable human/command message or persisted May result
  -> conversation.updated(appId, conversationId)
  -> adapter reads Conversation
  -> adapter skips message IDs already rendered on that surface
  -> adapter renders the remaining messages in its native style
```

`conversation.updated` is only a wake signal. It carries no message content and
does not own state. Several updates may coalesce into one read without losing a
message because the append-only Conversation projection is authoritative.
Mirroring one existing message to another surface does not append another
Conversation message and creates no May work.

Startup presentation is adapter-specific. Console restores bounded history for
a new terminal. Telegram seeds its rendered-ID set from current Conversation
truth without replaying old messages into a chat whose provider already keeps
history. New cross-surface messages are then presented live.

Adapter instances deduplicate by exact stable message ID, not merely by channel
name. This lets two Console processes share the same Conversation while each
suppresses only content it already rendered itself.

## Conversation and work reads

The public read is one May-owned Conversation resource. It contains bounded
durable messages and a derived work projection. It does not mutate state.

```text
app.conversation.get(appId, conversationId, options)
```

Work views are projections, not objects with another lifecycle:

- active work shows unfinished human App requests;
- all work shows active and finished requests, newest first;
- completed work includes its bounded result;
- one exact work read includes that request's full result.

Console exposes `/work`, `/work all`, and `/work N`. Telegram may expose the
same meanings through native commands or controls and may render each item
differently. The shared contract is the selected work identity and semantic
content, not byte-identical output.

When a human explicitly requests a view, the adapter records a concise
`author.kind: "command"` Conversation message after delivery succeeds. A later
turn on either channel can then understand references such as “the first one”
or “show me that result.” Automatic startup/reconnect views use
`transient: true`.

## Console contract

- Bare text is a human `conversation.message.created` message for
  `may:primary`.
- `/work` commands are cheap Conversation reads, not May work.
- `/status`, `/sessions`, and debug rendering remain local read/control
  behavior.
- `/steer <sessionId> <message>` and `/cancel <sessionId>` explicitly target an
  execution session; bare text never silently steers the watched session.
- Closing the Console closes only the adapter.

See [may-console.md](may-console.md) for terminal presentation details.

## Telegram contract

- Ordinary text is a human `conversation.message.created` message for
  `may:primary`.
- Chat/topic/message IDs are retained as delivery and reply coordinates only.
- `channelTargetId`, `channelThreadId`, and `channelMessageId` are opaque Host
  delivery mechanics; they are not App meaning or Conversation identity.
- Reply metadata is attached as context so May can interpret the human's
  intention; it does not replace Conversation or work identity.
- Native commands may answer through direct Conversation reads.
- Immediate replies target the incoming message. Conversation synchronization
  renders new shared messages using the adapter's current presentation context;
  provider coordinates remain adapter-local.
- Unknown native commands show help or fail locally.

Telegram owns its presentation. A work list may use buttons, Markdown, or one
message per item without requiring Console to do the same.

## Web and other adapters

A future Web chat should use the same May Conversation boundary. Session and
project pages may still expose explicit controls for those resources. HTTP or
socket route names may be ergonomic, but state-changing actions normalize into
typed events or validated App input before runtime logic.

Direct and Gym agent runs are portable execution surfaces, not May human
conversation adapters, and do not require this Conversation contract.

## Presentation and restart

- Inbound human acceptance requires durable App admission.
- Persisting May's result completes work and makes the result a shared
  Conversation message immediately.
- Console and Telegram listen for `conversation.updated`, reread the resource,
  and render unseen messages independently. Their acknowledgements do not feed
  back into work state.
- Provider delivery failures may be inspected operationally, but are not shown
  as May's answer and do not change `/work` status.
- Restart reconstructs the Conversation from durable events, App inbox items,
  dependencies, and results.
- Correctness never depends on a mutable persistent May chat session or an
  adapter receipt.

## Test contract

Every May human adapter must prove:

1. ordinary text maps to `Conversation may:primary`;
2. retry admits one human App request;
3. opening or reconnecting creates no work;
4. command/tool messages add context without work;
5. transient presentation adds neither context nor work;
6. explicit session controls do not change bare-text routing;
7. a persisted result is readable from another adapter without delivery state;
8. failed or uncertain adapter delivery does not change work or result content;
9. requested command views are visible to a later May turn;
10. restart reconstructs the same Conversation resource.
11. a new message from one adapter is rendered by the other without creating a
    duplicate Conversation message or May request.

The goal is semantic consistency with channel-appropriate interaction—not
identical UI.

## Compatibility

Older socket shortcut frames may remain temporarily, but they normalize at the
socket boundary. They are not an alternate lifecycle and new adapters should
use event publication, validated App admission/action invocation, and the
bounded Conversation read directly.
