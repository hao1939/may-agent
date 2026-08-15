# Telegram Channel

**Design status:** Accepted.
**Implementation status:** Canonical May App admission, stable reply identity,
correlated outbound delivery, restart-safe lookup, and bounded concurrent turns
are implemented. Additional presentation/noise tuning does not change the
ownership contract.

## Purpose

Telegram is a mobile transport for the same human-request contract used by CLI,
Web, and May Console. It must not create a Telegram-specific owner, queue,
escalation lifecycle, or completion rule.

```text
human Telegram message
  -> normalize chat/topic/message/reply identity
  -> one May App request
  -> direct answer or typed child App delegation
  -> May review
  -> correlated delivery operation
  -> delivered / failed / uncertain
```

The May App inbox item owns the human request. A Telegram message, event, trace,
session, notification row, or reply anchor is transport/context evidence only.

## Responsibilities

Telegram transport owns:

- bot API encoding and credentials;
- chat, topic, message, and reply identifiers;
- inbound deduplication;
- durable channel-message indexing;
- send attempts and provider receipts; and
- presentation constraints such as length and formatting.

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

The adapter derives a stable idempotency key from the provider identity and
admits one request to the `may` App. Provider redelivery cannot create another
May item.

The admission receipt means only “validated and durably admitted.” Telegram
must not display or record semantic completion until the May request and
required delivery operation reach their terminal states.

## Reply Correlation

One chat/topic may contain several unfinished requests. Resolve an inbound
reply in this order:

1. exact Telegram reply anchor mapped to a May request or prior child result;
2. exact request/App/task reference carried by the message;
3. the only plausible unfinished May request in the conversation; or
4. one focused clarification request.

Never choose the most recent session, latest event, or fuzzy text match as
durable routing. If correlation is ambiguous, visible clarification is safer
than attaching the reply to the wrong work.

The channel-message index records at least:

```ts
type ChannelMessageLink = {
  channel: "telegram";
  chatId: string;
  topicId?: string;
  messageId: string;
  mayRequestId: string;
  deliveryId?: string;
  traceId?: string;
};
```

Legacy context fields may be projected for history, but new routing uses the
canonical May request and delivery identities.

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

Never fall forward to a newer human message merely because it is on the same
trace or conversation.

## Controls

Explicit Telegram commands may map to deterministic typed controls such as:

- steer/cancel an exact session;
- invoke a declared App action;
- submit an exact approval/Condition response;
- status; and
- authorized reload/restart.

The adapter validates the exact target and records the control result. Bare
cancel never expands to cancel-all. An ordinary language request still enters
May admission rather than a command-specific ownership path.

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
- ordinary input uses the same May App path as other transports;
- exact reply anchors isolate concurrent requests;
- ambiguous replies clarify instead of guessing;
- direct answers close only after terminal delivery evidence;
- delegated child completion wakes and resumes the exact May parent;
- restart during May handling or delivery preserves identity;
- original session loss creates a fresh session for the same request;
- proactive attention is one May child request, not an event-pair lifecycle;
- uncertain sends do not duplicate blindly;
- explicit controls target exact identities; and
- secrets never enter prompts, facts, traces, or outbound diagnostics.

## Integrity Checklist

- One human turn requiring a result has one May App request.
- One response attempt has one delivery operation.
- Telegram identity is context, not work authority.
- May owns conversation and final wording; domain Apps own project outcomes.
- Cross-App/human attention uses durable parent-child request dependencies.
- Sessions, events, notifications, and traces never replace request/task state.
- Restart and reply correlation preserve exact request identity.
- Delivery status is honest and separate from semantic completion.
