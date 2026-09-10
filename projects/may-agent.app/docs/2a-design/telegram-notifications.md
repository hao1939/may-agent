# Telegram Channel

**Design status:** Accepted.
**Implementation status:** Shared Conversation admission, native App/Task
reads, one Task watch per chat/topic, focused context, human-action projection,
and Task cancellation are implemented. Outbound sends are best effort; there
is no durable per-surface replay cursor. Watch refreshes suppress unchanged
semantic Task revisions and render only meaningful changes. Follow-up
admission now presents the responsible Task directly, and human-action reads
follow exact dependency links to the Task that owns the action.
The accepted [current-turn Stop button](human-control-surfaces.md#current-turn-control)
remains unimplemented; Task cancellation and ending a watch have separate effects.

## Purpose

Telegram is a mobile adapter over the same May-owned Conversation used by May
Console. It may use Telegram-native commands, replies, buttons, and formatting,
but it must not create a Telegram-specific owner, queue, context store,
escalation lifecycle, or completion rule.

[Message Lifecycle](message-lifecycle.md) owns May's bounded turn, direct work
and Task follow-through. [Human Control Surfaces](human-control-surfaces.md)
owns commands, Task identity, watching and human-action views. Telegram adds
provider coordinates and presentation; it does not redefine those contracts.

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

A Runtime-authored Task admission activity is rendered as `Task activity`, not
as May's speech. It includes the exact Task reference and proves that durable
work was accepted. Telegram may keep its native watch interaction rather than
copy Console's prompt behavior; subsequent watch updates still re-read the same
canonical Task and suppress low-level event noise.

It does not:

- choose a project App, task, workflow, or owner;
- start a model session directly for ordinary input;
- infer completion from an event or session;
- mutate App/task state;
- retry uncertain sends blindly; or
- turn a notification into durable work.

May owns conversation, clarification, human-purpose review of linked Tasks,
human preferences, and final reply wording. Domain Apps own project meaning,
Task dependencies, and durable desired outcomes.

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

Every ordinary inbound Telegram message creates its own bounded May frontend request. A
Telegram reply anchor does not reopen, steer, or replace another request. The
adapter attaches only the provider message ID and at most 2,000 characters of
quoted text. It does not reopen notification rows, reconstruct a session or
trace, or choose a project from old metadata. May understands the reply from
that bounded quote, the shared Conversation, and an exact focused Task when one
is being watched.

May reads the same bounded Conversation available to Console, including the
latest command view each surface actually showed. Task views carry exact Task
references. Never choose the most recent session, latest event, or fuzzy text
match as durable routing. If the human's meaning remains materially ambiguous
after using available context and safe defaults, May states the likely
interpretation and recommendation and asks for the smallest remaining decision
inside the new request.

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
Conversation and canonical message/request identity.

## May Execution And Session Loss

The agent selected by the May App performs one bounded attempt from the exact request, source identity,
dependency observation, reply anchor, bounded conversation projection, and
relevant preferences.

A session is replaceable execution context. If its original session is gone:

```text
unfinished May frontend request
  -> recover exact request and Conversation state
  -> prepare a fresh bounded May session
  -> finish the same bounded decision

missed linked-Task review
  -> recover from Topic links, canonical Task state, and durable Events
```

Do not replay the last prompt or steer an unrelated current session. Session
loss cannot lose or duplicate the bounded request or responsible Task link.

## Answers and durable work

A bounded May turn can finish authorized work directly. Durable admission links
the Topic to the responsible Task before the frontend turn completes. Later
Task changes may produce useful Conversation updates under
[Message Lifecycle](message-lifecycle.md). Telegram renders those messages;
an agent label or provider send is not evidence of Task completion.

## Proactive Human Attention

When a domain App/task genuinely requires human judgment, it either keeps one
explicit human-owned Condition on the source Task or establishes a typed child
request to the `may` App when conversation policy or clarification is itself
work. The direct Condition contains:

- the exact decision/action requested;
- source App request or task identity;
- compact evidence and safe choices;
- severity/urgency;
- stable semantic correlation key; and
- the source resume condition.

The shared `/todo` projection discovers `owner: human` and `owner: human:<role>`
Conditions without giving the domain App direct transport access. Telegram
renders that Task and action using native layout. If a May child is used, May
may deduplicate, clarify, reject, defer under explicit policy, or respond. The
source App/task waits on the exact May child result or exact human Condition;
it never waits on a notification event.

Historical `escalation.*` and `message.created` event pairs remain traceable as
read-only evidence. They do not own new attention work or resume sessions.

## Outbound Presentation

The Conversation message is semantic truth. Telegram observes an update,
performs a bounded Conversation read, and makes a best-effort provider send.
Provider message IDs and send diagnostics may be retained for replies and
debugging, but they do not create a delivery lifecycle or completion gate.

On startup Telegram begins from the current Conversation head so it does not
replay a large history into a chat. While running it renders newly observed
message identities. A later explicit history/catch-up feature would require a
separate reviewed product decision; ordinary operation does not promise
exactly-once display or offline replay.

## Reply Target

For an immediate answer, reply to the incoming Telegram message. For a later
Task result, use the Conversation message's persisted Topic and channel
coordinates. If the exact reply anchor is unavailable, send visibly as a
standalone message in the same chat/topic and retain the Topic and Task links.

The durable return address is the request's opaque `channelTargetId`
(Telegram chat), optional `channelThreadId` (topic), and `channelMessageId`
(reply anchor). These fields remain Host/transport mechanics and are not shown
to the App. With several allowed chats, a response always uses the exact
originating target rather than the first configured chat.

Never fall forward to a newer human message merely because it is on the same
trace or conversation.

## Controls

Telegram exposes the same small Task meanings as Console:

- `/apps [app]`;
- `/topics` and `/topic [ref|clear]`;
- `/tasks [all] [history]`;
- `/todo [all]` and `/todo more`;
- `/task <ref>`;
- `/watch [ref]` and `/unwatch`;
- `/cancel [ref]`; and
- authorized Runtime reload.

`/tasks` returns ten compact cards per page; `/tasks more` continues the prior
query. Exact detail remains `/task <ref>`. Historical Telegram command events
remain auditable, while the Conversation projection carries only the newest
command view for each chat/topic.

The presentation may use native buttons without changing the resource API.
Ordinary help does not expose Host request history, session listing, steering,
or session cancellation.

One chat/topic selects one App (initially `may`) and watches at most one Task.
It may also follow one Conversation Topic. The selected Topic ID is attached to
later ordinary messages; the Telegram chat thread remains only a provider
coordinate. Topic selection does not create or control a Task.
While watched, ordinary text remains a May Conversation turn with exact
`context.focusedApp` and `context.focusedTask`; focus supplies context and does
not force feedback or mutation. Text is never sent directly to an execution
session. Semantic Task events wake one coalesced exact
read. Passive Conversation synchronization reads bounded messages only. Idle
watch has no poller, timer, workflow, session, or model call.

`/todo` returns up to 50 Tasks that own explicit open human Conditions or are
exact reachable dependency leaves for the selected App. Rows point to and
deduplicate by the Task that owns the Condition; no action state is copied to a
parent. `/todo more` follows the current opaque cursor, and `/todo all` crosses
App scope. Reconciliation and cancellation events trigger
one coalesced App-scoped reread for active chat/topic surfaces. Executor
progress refreshes an exact watch only and does not rescan `/todo`. A new or
changed off-watch action may produce one best-effort compact notification on
each configured surface and records exact Task references in shared
Conversation after it is shown. Surfaces do not coordinate or promise global
exactly-once delivery. Configured base chats are active after startup without
waiting for a new inbound message. Provider delivery status remains
observational.

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
- child Task completion wakes and resumes its exact requester Task;
- restart during May handling or delivery preserves identity;
- original session loss creates a fresh session for the same request;
- proactive attention is one May child request, not an event-pair lifecycle;
- failed or uncertain provider sends never rerun May or reopen Task work;
- Task controls target exact identities and never list-position/session guesses;
- focused watch feedback reaches May with exact canonical Task context;
- idle watch performs no polling and coalesces concurrent wakes;
- `/todo` membership comes only from open human-owned Conditions on the exact
  Task or a reachable dependency leaf, remains bounded, and clears without
  delivery acknowledgement;
- secrets never enter prompts, facts, traces, or outbound diagnostics;
- persisted output is readable from Console even if Telegram delivery fails;
- restart reconstructs the same Conversation projection; and
- a new Console message is rendered once in Telegram without another
  Conversation append or May request.

## Integrity Checklist

- Telegram and Console share one `Conversation may:primary`.
- One durable human message has at most one May App request.
- One Conversation identity is the semantic response identity across adapters.
- Telegram identity is delivery/context evidence, not Conversation or work authority.
- May owns conversation and final wording; domain Apps own project outcomes.
- Cross-App/human attention uses durable parent-child request dependencies.
- Sessions, events, notifications, and traces never replace request/task state.
- Restart reconstructs Conversation and preserves exact request identity.
- Delivery status is honest and separate from semantic completion.
