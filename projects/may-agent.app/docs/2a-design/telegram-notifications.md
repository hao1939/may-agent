# Telegram Channel

**Design status:** Accepted.
**Implementation status:** Shared Conversation admission, stable reply identity,
correlated outbound delivery, restart-safe lookup, native work reads, and
bounded concurrent turns are implemented. Additional presentation/noise tuning
does not change the ownership contract.

## Purpose

Telegram is a mobile adapter over the same May-owned Conversation used by May
Console. It may use Telegram-native commands, replies, buttons, and formatting,
but it must not create a Telegram-specific owner, queue, context store,
escalation lifecycle, or completion rule.

```text
human Telegram message
  -> normalize chat/topic/message/reply identity
  -> Conversation may:primary
  -> one fenced May App request
  -> direct answer or typed child App delegation
  -> May review
  -> correlated delivery operation
  -> delivered / failed / uncertain
```

The May App inbox item owns the human request. The Conversation provides shared
durable context across Telegram and Console. Telegram chat/topic/message IDs,
traces, sessions, notification rows, and reply anchors are delivery or context
evidence only.

## Responsibilities

Telegram transport owns:

- bot API encoding and credentials;
- chat, topic, message, and reply identifiers;
- inbound deduplication;
- durable channel-message indexing;
- send attempts and provider receipts; and
- presentation constraints such as length and formatting.

It also watches `Conversation may:primary`. On `conversation.updated`, it reads
the resource and presents unseen non-Telegram messages using Telegram-native
layout. It marks Telegram-origin messages as already rendered, so the adapter
does not echo its own input or May reply. A mirrored Console message remains the
same Conversation message; Telegram does not append a copy.

It does not:

- choose a project App, task, workflow, or owner;
- start a model session directly for ordinary input;
- infer completion from an event or session;
- mutate App/task state;
- retry uncertain sends blindly; or
- turn a notification into durable work.

May owns conversation, clarification, delegation, human preferences, and final
reply wording. Domain Apps own project meaning and durable desired outcomes.

## Inbound Admission

Each ordinary Telegram turn carries:

```ts
type TelegramIngress = {
  chatId: string;
  topicId?: string;
  messageId: string;
  replyToMessageId?: string;
  senderId: string;
  text: string;
  receivedAt: string;
};
```

The adapter derives a stable message identity from the provider coordinates and
publishes one human `conversation.message.created` event for
`Conversation may:primary`. The Host persists it and admits one request to the
`may` App. Provider redelivery returns the same event/request receipt and cannot
create another May item.

The admission receipt means only “validated and durably admitted.” Telegram
must not display or record semantic completion until the May request and
required delivery operation reach their terminal states.

## Reply Context

Every ordinary inbound Telegram message creates its own fenced May request. A
Telegram reply anchor does not reopen, steer, or replace another request. It is
attached as bounded context so May can understand references and decide whether
to answer, clarify, or delegate.

May reads the same bounded Conversation and active-work projection available to
Console. Never choose the most recent session, latest event, or fuzzy text match
as durable routing. If the human's meaning remains ambiguous, May asks one
focused clarification inside the new request.

The channel-message index records at least:

```ts
type ChannelMessageLink = {
  channel: "telegram";
  chatId: string;
  topicId?: string;
  messageId: string;
  conversationId: "may:primary";
  mayRequestId: string;
  deliveryId?: string;
  traceId?: string;
};
```

Legacy context fields may be projected for history, but new admission uses the
shared Conversation and canonical May request/delivery identities.

## May Execution And Session Loss

May performs one bounded owner pass from the exact request, source identity,
dependency observation, reply anchor, bounded conversation projection, and
relevant preferences.

A session is replaceable execution context. If its original session is gone:

```text
unfinished May request
  -> recover exact request/dependency/delivery state
  -> prepare a fresh bounded May session
  -> continue the same request
```

Do not replay the last prompt or steer an unrelated current session. Session
loss cannot lose, duplicate, or complete the May request.

## Direct Answers And Delegation

May may answer directly or delegate one typed child request to the accountable
App. When delegating:

- the child request is persisted before it is woken;
- the parent May item waits on that exact child ID;
- the child App may complete directly or attach its own task;
- the child result wakes the parent through the canonical dependency path; and
- May reviews the result before producing the human-facing response.

An agent message, owner label, `escalation.created` event, or source-session
resume marker is not a substitute for this dependency.

## Proactive Human Attention

When a domain App/task genuinely requires human judgment, it establishes a
typed child request to the `may` App containing:

- the exact decision/action requested;
- source App request or task identity;
- compact evidence and safe choices;
- severity/urgency;
- stable semantic correlation key; and
- the source resume condition.

May may deduplicate, clarify, reject, defer under explicit policy, or deliver.
Only a delivered May response creates a human-facing Telegram notification.
The source App/task waits on the exact May child result or an exact human
Condition; it never waits on a notification event.

Historical `escalation.*` and `message.created` event pairs remain traceable as
read-only evidence. They do not own new attention work or resume sessions.

## Outbound Delivery

The host stages one delivery operation linked to the originating May request:

```text
May response
  -> durable delivery operation
  -> Telegram send attempt
  -> delivered / failed / uncertain
```

Keep semantic result and transport certainty separate:

| State | Meaning |
| --- | --- |
| May result ready | The response content is terminal |
| Delivery pending | No provider attempt has reached a terminal policy state |
| Delivered | Provider evidence confirms the message |
| Failed | Retry policy may safely continue or the failure is terminal |
| Uncertain | The send may have succeeded; blind retry could duplicate it |

A response-required May request closes only after its delivery policy is
terminal. For an uncertain send, inspect provider/channel state or request
operator judgment while preserving the same operation ID.

## Reply Target

For an immediate answer, reply to the incoming Telegram message. For a later
dependency result, use the persisted channel link of the May request that owns
the response. If the exact reply anchor is unavailable, send visibly as a
standalone message in the same chat/topic and retain the May request link.

The durable return address is the request's opaque `channelTargetId`
(Telegram chat), optional `channelThreadId` (topic), and `channelMessageId`
(reply anchor). These fields remain Host/transport mechanics and are not shown
to the App owner. With several allowed chats, a response always uses the exact
originating target rather than the first configured chat.

Never fall forward to a newer human message merely because it is on the same
trace or conversation.

## Controls

Explicit Telegram commands may map to deterministic typed controls such as:

- read `/work`, `/work all`, or an exact work item from the shared Conversation;
- steer/cancel an exact session;
- invoke a declared App action;
- submit an exact approval/Condition response;
- status; and
- authorized reload/restart.

The adapter validates the exact target and records the control result. A
human-requested read result that may shape the next turn is appended as a
command-authored Conversation message after Telegram confirms delivery; it
creates no work. Bare cancel never expands to cancel-all. Ordinary language
still enters Conversation admission rather than a command-specific ownership
path.

## Secrets And Presentation

- Keep bot tokens and channel credentials out of prompts, facts, logs, traces,
  and App inputs.
- Redact secrets before delivery and retain only safe compact evidence.
- Split or summarize oversized messages without losing the requested action,
  result, blocker, or evidence reference.
- Keep Markdown/escaping failures visible; presentation fallback must not alter
  request ownership or resend a semantically different answer.

## Noise Control

Notify when:

- the human asked for a reply;
- a real decision/action is required;
- an explicitly promised checkpoint was missed; or
- terminal evidence materially changes the user's decision.

Do not notify for unchanged red metrics, every retry, internal lifecycle
events, queue movement, or duplicated progress. Metrics and traces remain
available for observation without becoming Telegram work.

## Failure Honesty

No silent drops:

- invalid ingress records a rejected receipt with safe diagnostics;
- failed May admission remains visibly pending/failed;
- missing reply correlation asks for clarification;
- lost sessions recreate from the same request;
- failed delivery remains linked to its operation; and
- uncertain delivery is not blindly duplicated.

Transport success never masks a failed App admission, unresolved dependency, or
missing human closeout.

## Test Contract

Telegram integration tests prove:

- provider redelivery admits exactly one May request;
- ordinary input and Console input use `Conversation may:primary`;
- native command output becomes cross-channel context without creating work;
- transient presentation creates neither context nor work;
- reply anchors add context while each inbound message keeps its own request;
- ambiguous references clarify instead of guessing;
- direct answers close only after terminal delivery evidence;
- delegated child completion wakes and resumes the exact May parent;
- restart during May handling or delivery preserves identity;
- original session loss creates a fresh session for the same request;
- proactive attention is one May child request, not an event-pair lifecycle;
- uncertain sends do not duplicate blindly;
- explicit controls target exact identities; and
- secrets never enter prompts, facts, traces, or outbound diagnostics;
- confirmed output is readable from Console; and
- restart reconstructs the same Conversation projection.
- a new Console message is rendered once in Telegram without another
  Conversation append or May request.

## Integrity Checklist

- Telegram and Console share one `Conversation may:primary`.
- One durable human message has at most one May App request.
- One response attempt has one delivery operation.
- Telegram identity is delivery/context evidence, not Conversation or work authority.
- May owns conversation and final wording; domain Apps own project outcomes.
- Cross-App/human attention uses durable parent-child request dependencies.
- Sessions, events, notifications, and traces never replace request/task state.
- Restart reconstructs Conversation and preserves exact request identity.
- Delivery status is honest and separate from semantic completion.
