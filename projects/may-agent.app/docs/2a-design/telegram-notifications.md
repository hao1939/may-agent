# Telegram Channel

**Design status:** Accepted.
**Implementation status:** Shared Conversation admission, stable reply identity,
correlated outbound delivery, native App/Task reads, one Task watch per
chat/topic, focused feedback, and Task cancellation are implemented.

## Purpose

Telegram is a mobile adapter over the same May-owned Conversation used by May
Console. It may use Telegram-native commands, replies, buttons, and formatting,
but it must not create a Telegram-specific owner, queue, context store,
escalation lifecycle, or completion rule.

```text
human Telegram message
  -> normalize chat/topic/message/reply identity
  -> Conversation may:primary
  -> one fenced May request linked to one May task
  -> first-attempt answer or typed child App task dependency
  -> May review
  -> persisted result in Conversation
  -> Telegram independently renders unseen messages
```

The May task owns the work; the Host request correlates the human turn and
result. The Conversation provides shared durable context across Telegram and
Console. Telegram chat/topic/message IDs, traces, sessions, notification rows,
and reply anchors are delivery or context evidence only.

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

May owns conversation, clarification, cross-App task dependencies, human
preferences, and final reply wording. Domain Apps own project meaning and
durable desired outcomes.

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

The admission receipt means only “validated and durably admitted.” May's
persisted result completes semantic work and enters Conversation. Telegram may
render that result when it observes the Conversation update; its transport
state does not change the request result.

## Reply Context

Every ordinary inbound Telegram message creates its own fenced May request. A
Telegram reply anchor does not reopen, steer, or replace another request. The
adapter attaches only the provider message ID and at most 2,000 characters of
quoted text. It does not reopen notification rows, reconstruct a session or
trace, or choose a project from old metadata. May understands the reply from
that bounded quote, the shared Conversation, and an exact focused Task when one
is being watched.

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

Legacy context fields remain read-only history. New admission uses the shared
Conversation and canonical May request identity.

## May Execution And Session Loss

May performs one bounded owner pass from the exact request, source identity,
dependency observation, reply anchor, bounded conversation projection, and
relevant preferences.

A session is replaceable execution context. If its original session is gone:

```text
unfinished May request
  -> recover exact request, dependency, and Conversation state
  -> prepare a fresh bounded May session
  -> continue the same request
```

Do not replay the last prompt or steer an unrelated current session. Session
loss cannot lose, duplicate, or complete the May request.

## Answers And Cross-App Dependencies

May's task may converge in one attempt or request one typed child outcome from
the accountable App. In the latter case:

- the child request is persisted before it is woken;
- the parent May task waits on that exact child task ID;
- the child App reconciles its task;
- the child result wakes the parent task through the canonical dependency path; and
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

May may deduplicate, clarify, reject, defer under explicit policy, or respond.
Telegram creates a human-facing notification by rendering the persisted
Conversation response.
The source App/task waits on the exact May child result or an exact human
Condition; it never waits on a notification event.

Historical `escalation.*` and `message.created` event pairs remain traceable as
read-only evidence. They do not own new attention work or resume sessions.

## Outbound Delivery

The adapter may stage one delivery operation linked to the originating
Conversation message:

```text
persisted Conversation message
  -> durable delivery operation
  -> Telegram send attempt
  -> delivered / failed / uncertain
```

Keep semantic result and transport certainty separate:

| State            | Meaning                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| May result ready | Semantic work is terminal and the content is readable from any adapter |
| Delivery pending | No provider attempt has reached a terminal policy state                |
| Delivered        | Provider evidence confirms the message                                 |
| Failed           | Retry policy may safely continue or the failure is terminal            |
| Uncertain        | The send may have succeeded; blind retry could duplicate it            |

Delivery state is operational adapter state. It never reopens, delays, or
changes the May result. For an uncertain send, inspect provider/channel state
or request operator judgment while preserving the same operation ID; do not
blindly duplicate it.

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

Telegram exposes the same small Task meanings as Console:

- `/apps [app]`;
- `/tasks [app] [all]`;
- `/task <ref>`;
- `/watch [ref]` and `/unwatch`;
- `/cancel [ref]`; and
- authorized Runtime reload.

The presentation may use native buttons without changing the resource API.
`/work` remains a hidden compatibility view of old May requests. Ordinary help
does not expose session listing, steering, or session cancellation.

One chat/topic watches at most one Task. While watched, ordinary text remains a
May Conversation turn with exact `context.focusedTask`; it is never sent
directly to an execution session. Semantic Task events wake one coalesced exact
read. Passive Conversation synchronization reads messages without rebuilding
the hidden request-work view. Idle watch has no poller, timer, workflow,
session, or model call.

The adapter validates the exact target and records the control result. A
human-requested read result that may shape the next turn is appended as a
command-authored Conversation message only after Telegram has actually shown
it; it creates no work. Bare cancel targets only the watched Task and never
expands to cancel-all. Ordinary language still enters Conversation admission
rather than a command-specific ownership path.

Authorized `/reload` follows the same rule. Telegram correlates the request by
chat/message identity, renders the single `runtime.reload.finished` result in
the originating chat/topic, and appends it to Conversation only after the send
succeeds. It does not ask May to interpret reload or maintain another work
tracker.

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
- persisted direct answers close semantic work without delivery evidence;
- child task completion wakes and resumes the exact May parent task;
- restart during May handling or delivery preserves identity;
- original session loss creates a fresh session for the same request;
- proactive attention is one May child request, not an event-pair lifecycle;
- uncertain sends do not duplicate blindly;
- Task controls target exact identities and never list-position/session guesses;
- focused watch feedback reaches May with exact canonical Task context;
- idle watch performs no polling and coalesces concurrent wakes;
- secrets never enter prompts, facts, traces, or outbound diagnostics;
- persisted output is readable from Console even if Telegram delivery fails;
- restart reconstructs the same Conversation projection; and
- a new Console message is rendered once in Telegram without another
  Conversation append or May request.

## Integrity Checklist

- Telegram and Console share one `Conversation may:primary`.
- One durable human message has at most one May App request.
- One adapter response attempt has at most one delivery operation.
- Telegram identity is delivery/context evidence, not Conversation or work authority.
- May owns conversation and final wording; domain Apps own project outcomes.
- Cross-App/human attention uses durable parent-child request dependencies.
- Sessions, events, notifications, and traces never replace request/task state.
- Restart reconstructs Conversation and preserves exact request identity.
- Delivery status is honest and separate from semantic completion.
