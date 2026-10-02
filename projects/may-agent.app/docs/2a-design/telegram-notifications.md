# Telegram Channel

**Supports:** [Human Control Surfaces](human-control-surfaces.md). Carries the same discussion, results and controls through a usable messaging interface.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#convention-over-configuration).

**Design status:** Accepted.
**Implementation status:** Shared Conversation admission, native App/Task
reads, one Task watch per chat/topic, focused context, human-action projection,
and Task cancellation are implemented. Outbound sends are best effort; there
is no durable per-surface replay cursor. Host
[PR #221](https://github.com/hao1939/may-agent/pull/221) uses completed,
destination-scoped delivery receipts to suppress an unchanged exact human
action after restart while keeping unknown, failed, partial, changed, or
aggregate deliveries eligible. It also makes watch refreshes compare the compact
presentation plus exact reply authority, ignoring metadata-only changes while
retaining visible progress, dependencies, actions, and changed
approval/Condition anchors. PR #221 merged at `1283ea7a` on September 21.
Hao authorized deployment on September 21; the same-container rollout succeeded
at 08:49 UTC. The durable receipt `may-goal-app_86bea4d7-pr221-1283ea7a`
records that exact source revision, matching built/loaded binary hashes and
healthy services. Independent read-back confirmed readiness and all four Apps.
This proves activation; longer-term notification quality and independent
Evaluation follow-up remain separate. Follow-up admission now presents
the responsible Task directly, and human-action reads follow exact dependency
links to the Task that owns the action.
The [current-turn Stop button](human-control-surfaces.md#current-turn-control)
is implemented; Task cancellation and ending a watch have separate effects.
Request deadlines and close cancellation merged in Host
[PR #133](https://github.com/hao1939/may-agent/pull/133) as `39a23f22`.
Source checks and merge state are not a deployment claim.
The [conversation experience record](../proposals/telegram-conversation-experience.md)
retains the acknowledgment, contextual-button and compact-update trials.
Current source includes those mechanisms; a live bot's behavior depends on its
binary, App definitions, permissions and provider state.

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
layout. It marks Telegram-origin human input and already-delivered command views
as rendered, without suppressing new Runtime activity. A mirrored Console message remains the
same Conversation message; Telegram does not append a copy.

A Runtime-authored Task admission activity is rendered as `Background work
accepted`, not as May's speech or a completion claim. Its exact Task links support
Details and Follow updates buttons without exposing IDs in the default message.
Subsequent watch updates still re-read the same
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

The poll offset advances only after synchronous durable admission or deliberate
rejection, never while an earlier actionable update remains unadmitted. Failed
recording or admission keeps that update and its suffix eligible for provider
redelivery. May execution and outbound delivery do not gate the offset. A
redelivered recorded input loads its original journal event and retries only the
existing idempotent admission route, without rebuilding context from today's
focus or replaying ordinary side-effect listeners. Cancellation uses a stable
provider-message key to retain the original control. Reload uses the same request
and saved result, but may redo an interrupted definition load as described below.
Lookup uses a partial Telegram type/key index rather than scanning
retained Conversation history. This is not a new Telegram queue.
Provider retention bounds the retry window for unadmitted updates; accepted
Tasks do not depend on that retention. Host recovery remains responsible for
accepted work and saved admission plans, not arbitrary unadmitted journal rows.

Commands change local selection in provider order. Immediate command replies,
including help and invalid/unknown-command feedback, share one per-surface send
chain. This does not turn presentation-only notices into saved Conversation
views. Input admission, Stop, progress and asynchronous results remain independent;
this is not a total ordering of all outbound messages.
Unsupported attachments in authorized chats receive a best-effort explanation
asking for text; captions are not treated as proof that the media was understood.
Media processing remains unsupported. Service updates without user content may
be ignored deliberately; a failed explanatory send does not cause endless replay.
One adapter-local list identifies the current Bot API's non-text content,
including games, paid media, stories and checklists, plus explicit user shares
and Web App data. The same feedback handles all of them without inspecting or
executing the payload. Passive service notices such as joins and pins stay quiet.
This list follows the provider contract and needs review when Telegram adds
content variants; no automatic support for future formats is promised.

The admission receipt means only “validated and durably admitted.” May's
persisted result completes semantic work and enters Conversation. Telegram may
render that result when it observes the Conversation update; its transport
state does not change the request result.

## Reply Context

Every ordinary inbound Telegram message creates its own bounded May frontend request. A
Telegram reply anchor does not reopen, steer, or replace another request. The
adapter attaches the provider message ID and at most 2,000 characters of quoted
text. The stored `(chatId, messageId)` link may also supply its exact canonical
message, Topic and primary Task (`followTask`, or the sole `taskRefs` entry).
Details may name related Tasks without making them equal reply targets; a compact
update names only the Task it describes. An explicit reply takes precedence
over a different selected Topic or watch. A multi-Task view supplies no automatic
single-Task focus. These links are context, not approval or routing authority;
May still judges intention and uses validated controls. The adapter never
reconstructs a worker session or trace from a reply.

Only an actual human reply creates a reply anchor. Rendering an answer does not
silently attach later messages to it; ordinary continuation uses bounded history.
The selected Topic travels through saved input context into May's prepared
Conversation, scoped to that App and Conversation. It is a hint, not a committed
Topic decision, so May can recognize a new subject. Selection is preserved for
an admitted message across restart even though the adapter's local selection is not.

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
Message numbers are unique within a chat, not across chats. Legacy rows lacking
an unambiguous chat remain historical evidence and are excluded from reply lookup.
Command views carry chat and topic coordinates so the shared projection retains
each surface's latest view separately.

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

Each provider request has a finite client deadline: 15 seconds for ordinary
calls and 45 seconds for `getUpdates`, whose server wait is 30 seconds. The
deadline includes reading the response body. Closing the bot aborts its active
requests and prevents further polls and message chunks.

A confirmed formatting rejection may be retried once as plain text. Network
failure, timeout, or cancellation leaves delivery uncertain and does not cause
an immediate formatting retry. A multipart send counts as confirmed only when
every chunk has a provider message ID; IDs for confirmed chunks remain indexed
even if another chunk fails. Only the final receipt after complete delivery may
carry the exact human-action revision or reply authority. On restart that
receipt may suppress the same complete action set for the same chat/topic. A
changed action, candidate, Condition generation, incomplete current read, or
destination remains eligible for a new notification after restart; an
incomplete read cannot reuse a durable exact receipt. During one adapter
lifetime, its bounded per-surface presentation comparison may quiet the same
unchanged incomplete snapshot after a successful send; this does not establish
snapshot completeness, approval authority, or a restart-safe receipt. Legacy
Condition or approval anchors alone do not prove the complete action identity;
only the exact complete-delivery revision may suppress a repeat after restart.

Refreshes run on later events, without a periodic delivery retry loop. A later
wake may retry an unconfirmed message and duplicate its display or some chunks.
Without another wake, the message may remain missing from Telegram. These are
accepted presentation limits: the durable answer remains readable through
Conversation, and presentation failure never reruns accepted work.

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

The Telegram adapter interprets the optional stored thread as a positive decimal
integer that JavaScript can represent exactly. Missing or invalid values use
the existing no-thread fallback within that chat. Delivery, Stop controls and
watch bookkeeping use this same normalized coordinate; they must not disagree
about where a message was sent. Stored metadata and the shared event schema
stay transport-neutral. This provider thread is not a Conversation Topic ID.

Never fall forward to a newer human message merely because it is on the same
trace or conversation.

## Controls

Telegram exposes the same small Task meanings as Console:

Ordinary help starts with conversation and replying to updates. The commands
below are optional shortcuts, not prerequisites. Task-specific messages offer
Details and Follow updates using the same reads and local watch selection.
Buttons resolve the stored link for that exact chat/message, re-read the Task
and enforce the existing authorization boundary. They do not create approval
state or a subscription. Missing links explain that current status is needed.
Details preserves the clicked message's Topic without changing selection.
Follow updates selects that Task's App and the clicked Topic when available;
an unrelated previously selected Topic is cleared. A rejected Follow request,
including a completed Task, leaves the current watch and selection unchanged.
Automatic progress cards retain the selected Conversation Topic only when it
links the exact Task. Before checking membership, the adapter reloads the
selected Topic by ID so Tasks admitted after selection are not missed; a missing
Topic clears only that local selection. It captures that context before sending and
stores the same value in the message link and shown Conversation view, even
when selection changes during delivery.

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
not force feedback or mutation. An explicit reply can provide a different exact
subject. Text is never sent directly to an execution
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
Conversation after it is shown. Confirmed automatic watch updates use the same
delivered-action tracking as automatic alerts. After stopping a watch, an
unchanged action already shown by an automatic update stays quiet on later
wakes. Complete watch deliveries carry the same exact receipt used after restart.
Manual `/todo` views do not advance or suppress
that automatic-notification presentation state, so one manual/automatic overlap
is allowed. Surfaces do not coordinate or promise global exactly-once delivery.
Configured base chats are active after startup without waiting for a new inbound
message. Provider delivery status remains observational.
Single-decision notices invite a direct reply and link only the decision shown.
Multi-decision summaries invite a list/read rather than suggesting that “yes”
approves them all. Watch updates show the purpose, current state and useful
progress or decision; the full technical card remains under Details or `/task`.
An equivalent canonical answer for the exact Task/surface takes precedence over
its supporting terminal watch card.

The active-turn view carries optional source coordinates. Telegram-origin turn
controls appear beside that source message. Turns without a Telegram source
(including automated reviews and Console turns) create no unsolicited Telegram
activity card. Their accepted replies still use the shared Conversation mirror;
Task reads and the owning surface retain execution visibility. When a
new message arrives during an earlier turn, a best-effort notice says it is saved
but has not changed running work. Ordinary text remains queued, not immediate
steering. Stop this turn, cancel a Task and stop following have distinct effects.

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
Provider redelivery restores reply correlation and checks for a saved completion
by its exact parent event before retrying admission. A saved success or failure
is returned even if the request's acceptance write failed and it still says
pending. Only a request without completion evidence can reach admission retry.
Reload acceptance schedules an asynchronous operation; it is not proof of
completion. A redelivered request without a saved result reenters the reload
route even when marked accepted. Concurrent deliveries of the same event share
one process-local in-flight execution. That guard ends after result recording
or its failure; failed recording remains visible in the Host log and does not
fabricate an execution failure. After restart, the same unfinished request may
load current definitions again. This is deliberate at-least-once execution,
not an exactly-once effect guarantee or a new durable work tracker. Recovery
here depends on provider redelivery; it does not scan already-acknowledged
administrative commands for missing replies.
It does not rerun a completed reload merely to regenerate its reply. Reply
display remains best effort and may repeat after restart; it is not an
exactly-once receipt.

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

Keep failures and their consequences honest:

- invalid ingress records a rejected receipt with safe diagnostics;
- failed May admission remains visibly pending/failed;
- missing reply correlation asks for clarification;
- lost sessions recreate from the same request;
- send failures produce diagnostics, and confirmed provider IDs remain available;
- uncertain delivery does not trigger an immediate resend; later wake-driven
  refresh has the [accepted display limits](#outbound-presentation) above.

Transport success never masks a failed App admission, unresolved dependency, or
missing human closeout.

## Test Contract

Source acceptance includes the following contracts. Agent judgment and natural
conversation quality additionally need the separate experience trial in the
proposal; fixtures alone cannot prove them:

- provider redelivery admits exactly one May request;
- a pre-recording failure leaves the provider offset behind the failed update;
- lost receipts and restart preserve the original recorded context and controls;
- chat/message collisions and ambiguous legacy links never select another chat;
- Telegram-origin admission activity is visible and unsupported media is explained;
- ordinary input and Console input use `Conversation may:primary`;
- native command output becomes cross-channel context without creating work;
- transient presentation creates neither context nor work;
- reply anchors add context while each inbound message keeps its own request;
- selected Topic context reaches the actual agent input after admission and
  restart, without forcing the agent's Topic decision;
- delayed answers cannot create reply anchors or override a later selection;
- a rejected Follow command or button preserves the existing watch;
- ambiguous references clarify instead of guessing;
- persisted direct answers close semantic work without delivery evidence;
- child Task completion wakes and resumes its exact requester Task;
- restart during May handling or delivery preserves identity;
- original session loss creates a fresh session for the same request;
- proactive attention is one May child request, not an event-pair lifecycle;
- failed or uncertain provider sends never rerun May or reopen Task work;
- stalled provider calls and response bodies hit a deadline, long polling has
  enough time for its server wait, and close aborts active I/O;
- only confirmed formatting rejection permits a plain-text fallback;
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
