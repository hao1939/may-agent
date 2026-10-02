# Telegram: a natural conversation with reliable follow-through

**Supports:** [Human Control Surfaces](../2a-design/human-control-surfaces.md). Applies common discussion and follow-through rules to the Telegram experience.

**Choice basis:** [Applicable philosophy and convention](../1-principles/core-principles.md#convention-over-configuration); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Design status:** Accepted for implementation, September 11, 2026.
**Implementation status:** Candidate source on Host branch
`fix/telegram-conversation-experience`, based on `a8f65188`, in
[Host PR #157](https://github.com/hao1939/may-agent/pull/157) at `ed1192c1`, with
the simplicity correction below following the verified `7bfb7f08` checkpoint.
The five reproduced
defects and existing-context presentation changes are implemented locally;
verification results are recorded below. Not merged or deployed. The separately
authorized live Telegram/model experience trial remains pending.

## Outcome

People should talk to May, not operate a Task console through chat. They should
understand what May understood, what is happening, what needs their decision,
and how to return to earlier work. Commands and internal IDs are optional.

Keep the existing foundation: one shared Conversation, Topics for context,
Requests for accepted asks, and Tasks for independent background work. May can
answer or do useful bounded work directly; handing every message to an App
would make the experience worse.

This proposal has two parts: fix confirmed reliability defects, then simplify
presentation and guidance. Neither requires a new work lifecycle or the pending
[Conversation execution migration](conversation-input-unification.md).

## What the person should experience

These examples describe the target, not behavior already verified with a model.

| Situation | Expected interaction |
| --- | --- |
| “What does this error mean?” | Answer directly. No separate “request accepted” ceremony for a quick answer. |
| “Review the deployment changes; don't change anything yet.” | May makes the scope clear: “I'll review the changes and report the risks before changing anything.” Do not claim work has started or finished without evidence. |
| Work continues in the background | Show the purpose and current state briefly, with a contextual way to see details. Report meaningful progress, a blocker, a decision or the result. |
| Reply “Yes, do that” to an earlier suggestion | Use that exact message and its Topic/Task links, even after discussing something else. Ask only if the intended action is still unclear. |
| “Actually, only review the networking changes.” | May interprets this as a correction using context. If it is queued behind a running turn, say so; do not claim the running work has already changed. |
| “Where were we with the deployment?” tomorrow | Read the relevant Topic and current Task state; give a short catch-up and next step, not the whole transcript. |
| Several tasks are ongoing | “What's still running?” gives a compact list by purpose. Changing topic or selecting another Task does not cancel existing work. |
| May needs a decision | Explain the decision and enough evidence to choose. The person can reply to that message without first learning `/watch <id>`. |

The ordinary experience should reveal purpose, status and the next useful
action. Exact IDs, attempts, sessions and detailed diagnostics belong in an
explicit details view. A title helps a person recognize work; it is not a
replacement for exact identity inside the system.

## Evidence behind the proposal

The review examined Host `f614edbb`. Thirty existing Telegram tests passed in
an isolated checkout whose relevant adapter, storage and Conversation files
matched that baseline. Additional probes used the actual adapter, fake provider
responses and temporary SQLite. They reproduced the five defects below; they
did not call Telegram or a model and do not establish incident frequency.

Source paths below are relative to the Host repository, `projects/may-agent`.

| Confirmed defect | Evidence | User impact |
| --- | --- | --- |
| Incoming updates are acknowledged before durable recording | `src/app/transport/telegram.ts`, `pollLoop`: offset advances before asynchronous message handling. A failed publication followed by recovery produced one handling attempt, later poll offset 101, zero recorded inputs and zero replies. | A message can disappear without May ever receiving it. |
| Reply lookup is not scoped to the chat | `src/lib/db/notifications.ts` and `src/lib/db/schema.ts`: the key is only `telegram_msg_id`. Two chats with message 55 replaced the same row; a reply in the first chat linked to the second chat's answer. | “Yes, do that” can receive the wrong context. |
| Command views omit the chat identity | `recordConversationMessage` accepts `chatId` but omits `metadata.channelTargetId`. Two `/tasks` views from different chats lacked that coordinate. `src/app/core/state/conversations.ts` uses it to separate latest command views. | May can lose the distinction between what each surface showed. |
| Telegram-origin Task admission notices are suppressed | `syncConversation` skips every non-agent Telegram-origin message, including Runtime `task-admitted` activity. A fixture's Telegram-origin notice was invisible; its Console-origin counterpart appeared. | A person may not learn that background work was accepted. |
| Unsupported messages are silently ignored | `handleMessage` returns without top-level `text`. A photo with a question in its caption produced no input and no reply. | The person cannot tell whether May understood, is working, or ignored them. |

There are also source-backed presentation concerns, not measured user-test
results: generic active-turn messages are sent to every known surface; watch
changes repeat full technical cards; human-action notices direct people to
`/watch`; help leads with commands. Existing tests passing did not cover the
failure sequences above or prove that the interaction feels natural.

## 1. Repair the existing boundaries

### Admit input before acknowledging it

Advance the provider acknowledgment only when actionable input has been durably
admitted or deliberately rejected under the existing authorization/input rules.
An input-storage failure must leave the update eligible for redelivery.
Recording alone is insufficient: implementation review found that Host recovery
retries saved admission plans, not every event recorded before a plan exists.
Keep the provider update pending until admission succeeds. Redelivery loads the
original journal event and uses the existing idempotent admission route, without
rebuilding context from today's focus or replaying ordinary side-effect listeners.
Neither May's execution nor a successful outbound reply gates acknowledgment.
Reuse the existing stable message identity; add no local durable queue.

Telegram's offset acknowledges all earlier updates, not just one message. Keep
it behind any earlier unadmitted update. Separate the short recording/control
boundary from execution and outbound delivery; simply awaiting today's complete
handler would put slow sends in front of polling. Preserve command-then-message
ordering within a chat/topic and allow other chats to progress despite a slow
send. An actual storage outage can delay acknowledgments; that is acceptable.

Keep Stop outside the conversational execution queue. Account for callbacks
and commands too: a replay must not blindly repeat an already accepted mutation.
Reuse their existing identity/control contracts; fix a demonstrated gap there
without introducing a Telegram durable queue or generic exactly-once framework.

### Preserve the exact reply and surface

Use `(chatId, messageId)` for stored Telegram message links and reply lookup.
Retain the optional Telegram topic coordinate and canonical Conversation message
identity. Include `channelTargetId` in command views so the shared projection
keeps each chat/topic's latest view separate.

Migrate legacy links only when their chat can be established unambiguously.
Otherwise preserve the historical evidence but do not use it for exact routing.
Fall back to the bounded quote and current canonical context; ask if necessary.
Never guess the chat from the first configured target or the current focus.

A reply supplies context, not blanket approval, authority or direct access to a
worker session. Revalidate the actual action and target through existing controls.

### Show accepted work and unsupported input honestly

Suppress an echo because it was already shown, not merely because it came from
Telegram and was not written by an agent. Render fresh Runtime admission activity
using its existing `taskRefs`, `followTask`, Topic and return coordinates. A
brief “Background work accepted: review deployment risks” reports a fact; it
does not impersonate May or imply completion.

For unsupported media in an authorized chat, provide a short, truthful response,
for example: “I can't read this attachment yet. Please paste the error text.”
Do not silently discard a caption or imply the attachment was understood.
Full media processing is outside this proposal. Treat unsupported input as a
deliberate rejection, not a failing job that retries forever. Its explanatory
send remains best effort and must not hold up input acknowledgment. Preserve
the existing authorization boundary before processing content.

## 2. Make follow-up natural without another subsystem

### Context belongs to the conversation

May interprets “continue”, corrections and short confirmations using the exact
reply anchor, current Topic, linked Tasks and existing bounded history readers.
When an explicit reply points elsewhere, do not silently substitute the current
watch. May resolves genuine ambiguity with a short question identifying the
candidate purposes. Do not encode intention with keyword rules in Telegram.

Use a small set of contextual buttons where they remove typing: task details,
follow this Task and existing Stop controls. Reuse the one-watch-per-chat/topic
selection; following another Task changes a view, not its owner or execution.
Background Tasks and their Conversation updates do not require separate user
watch registration. Buttons carry exact identities and revalidate current state
and authorization; old buttons must not act on newer work.

An attention message should point to the specific decision/Task it describes,
not silently attach unrelated items from a whole page. A summary of several
decisions may offer a list/details view instead of treating “yes” as approval
for all of them. Buttons are navigation or explicit controls, not a new approval
state machine.

### Keep progress useful and truthful

Lead help with “Tell May what you need; reply to an update to follow up.” Keep
existing commands available as expert shortcuts and administration separate.

Prefer one compact, task-specific update to repeated complete cards. Reuse
existing semantic-revision suppression and canonical message identity. Where a
Conversation answer already explains a Task result, avoid also displaying its
equivalent technical terminal card. May judges significance and writes semantic
updates; the adapter formats known facts, without an extra model call per event.

Distinguish a queued message, an active turn, accepted background work and a
finished outcome. An activity indicator proves activity, not understanding.
Do not label every known chat's turn as work on that chat's latest message.
Use source coordinates where available; if the shared active-turn read lacks
them, review that small shared read-model gap rather than guess a target.

There is an important existing limit: `turn-handler.ts` emits
`onRequestMessage` after the turn finishes or hands off. Prompt wording alone
cannot guarantee an early semantic acknowledgment during lengthy direct tool
work. First trial the existing path. If silence remains a real problem, review
the smallest shared capability for May to publish an in-turn Conversation
message; do not fabricate intent in Telegram, force a Task handoff or add a
second LLM turn solely to say “working”. This capability is a conditional
follow-up, not assumed implemented by the presentation changes.

### Make interruption and returning predictable

Keep three meanings distinct: Stop this turn ends the current conversational
attempt; cancel a Task acts on that background work; stop following only quiets
the selected view. Explain the difference when relevant, not on every message.
Confirm only the state actually accepted by the existing control path.

Ordinary new text is currently a queued turn, not immediate steering. Preserve
the exact Stop button and explicitly communicate queued corrections when the
state is available. Do not promise that typing “stop” instantly interrupts a
tool. Seamless steering remains in the
[shared turn-control design](../2a-design/human-control-surfaces.md#current-turn-control).

Closing the person's Telegram client does not stop accepted Tasks. After a bot
restart, May can use durable Topics, Requests and Tasks to answer a new catch-up
question. This is an explicit contextual read, not automatic offline replay.
If context is missing or several topics match, say so and clarify. A local watch
or replaceable model session must not be the only way to find the work again.

## Ownership and accepted limits

| Responsibility | Owner |
| --- | --- |
| Durable input, exact identities, canonical state, recovery and validated controls | Existing Host Events, State and Work boundaries |
| Provider acknowledgment, message links, chat/topic coordinates, formatting and buttons | Replaceable Telegram adapter and its transport storage helpers |
| Understand intention, choose direct work or Task handoff, clarify, summarize and judge useful progress | May's existing Conversation capability and App guidance |
| Execute independent work, preserve evidence and report actual results | The responsible App/Task, which can be May |

No Telegram-specific Task lifecycle, scheduler, durable delivery queue,
subscription registry, intent classifier or extra agent. Removing Telegram must
not stop accepted work. The shared Conversation is not being redesigned as a
multi-user isolation or identity system; exact chat coordinates prevent incorrect
correlation but do not establish a new privacy/authorization boundary.

Outbound messages remain best effort. A send may be missing or repeated after
an uncertain failure; that must not rerun accepted work. Startup still begins
at the current Conversation head, without historical replay. This proposal does
not promise media understanding, immediate natural-language interruption,
perfect intent recognition or a guaranteed progress-message latency.

## Delivery and acceptance

Implement in small, independently reviewable steps:

1. Repair input acknowledgment; test failure, redelivery and existing recovery.
2. Repair chat-scoped message links and command-view metadata, including migration.
3. Restore admission visibility and add truthful unsupported-input feedback.
4. Simplify help, progress and contextual follow-up; improve May guidance only
   where existing context/tools suffice. Record any missing shared capability
   separately instead of expanding the adapter.

Turn the useful probes into portable tests within the existing suites, not a
new parallel test framework. Required source acceptance scenarios are:

- A failed pre-recording input is retried and recorded once after recovery;
  a recorded-but-unadmitted input is retried through the Host's idempotent route
  on provider redelivery, without duplicate work. An unadmitted earlier update
  is not skipped by a later offset.
- A slow send does not block another chat's admission or Stop; same-surface
  command/message order survives redelivery without repeated accepted mutations.
- Two chats reuse the same provider message number. Replies and command views
  stay correctly scoped, including topics and ambiguous legacy rows.
- A Telegram-origin admission is visible once in the normal success path,
  without echoing the human input or claiming completion. Unsupported media
  gets a truthful explanation when delivery succeeds.
- Switching focus, replying to an older decision, and restarting storage keep
  exact context. An expired control cannot affect a newer turn or another Task.
- Progress refreshes suppress unchanged noise. Selecting another view leaves
  other work running; stopping a watch is not cancellation.

Then perform a separately authorized real Telegram/model trial: ask a quick
question; request longer work; correct it while busy; discuss a second topic;
reply “yes” to the first proposal; handle a blocker; close and reopen the client;
ask for a catch-up after bot restart. Keep the test work low-risk and synthetic.
Record whether the person can identify purpose, current state and next action
without commands, whether May selects the right context, and where silence or
duplication remains. Do not publish chat history, tokens or personal configuration.

Stop the first implementation round when the five reproduced defects pass their
regressions and the existing-context UX changes are verified. Source tests do
not establish natural conversation quality; mark the experience trial pending
until it actually runs. Expand only for a concrete failure that the trial exposes.

## Recommended review decision

Approve the reliability fixes and conversation-first direction. Retain optional
commands, one local watch, best-effort outbound delivery and existing Stop
semantics. Defer media processing, seamless steering and any in-turn messaging
addition until their specific need and smallest shared implementation are clear.

The implementation updates the owning
[Telegram contract](../2a-design/telegram-notifications.md),
[human controls](../2a-design/human-control-surfaces.md) and
[Message Lifecycle](../2a-design/message-lifecycle.md) where appropriate. Source
implementation and live deployment remain distinct.

## Implementation evidence

### Simplicity correction

The repeated review cycle exposed a testing gap: adapter-only checks verified
Topic metadata without proving what May actually received. A full-boundary probe
found that admission dropped the selected Topic and the adapter manufactured a
reply to its last rendered answer. A second probe found that trying to follow
completed work silently discarded an unrelated active watch.

The correction removes last-answer tracking, carries the Topic hint through
existing saved input context and leaves selection unchanged on rejected Follow.
May still decides the Topic; ordinary continuation uses bounded history. No new
store, queue, retry path or migration work is needed. The two regressions exercise
real admission and prepared agent input, delayed delivery, storage reopen,
redelivery, explicit replies, cleared selection and out-of-scope Topic hints.
This is source evidence with a fake provider/model, not a live conversation trial.
At `15c8ea2e`, 106 affected tests and canonical design checks pass. Runtime
changes add 11 net lines across three files and remove the last-answer map.
No migration changes were made in this correction. The test-only follow-up
`cc8d967f` measures waits monotonically: an injected wall-clock jump reproduced
an early retry-test timeout before the change and passed afterward, with the
same timeout and assertions. The subsequent full local run had 2,763 passes,
three existing installation-only skips and one early timeout in an unchanged
controller test; its 24-test owning suite passes in isolation. Hosted checks and
review status remain on the PR. This is not a clean local full-suite claim.

At `eb937c1e`, the unsupported-content check covers the current documented
Telegram content variants, including the review's games and paid media, through
one adapter-local list. The existing test now checks those variants, exact
chat/thread reply coordinates, unauthorized input and quiet service notices.
At `ed1192c1`, the controller test wait also uses monotonic elapsed time. The
existing 40-handoff test reproduces a wall-clock jump during execution; it failed
before the helper change and passes afterward, preserving its timeout and yield
assertion. Production scheduling is unchanged. Full validation is tracked on
the PR; these corrections introduce no new migration or recovery behavior.
Full local CI at `ed1192c1` passes: 2,764 tests passed, three existing
installation-only skips, zero failures; browser tests executed. Host/SDK types,
App-boundary checks and lint passed. All 73 focused Telegram/controller tests
and canonical design checks pass. Hosted Quality and Container passed on the
same revision in run `34620436328`, including the isolated built-image smoke
check. Copilot was explicitly requested again on that exact head. Prior failed
runs above remain evidence, not a claim that unrelated flaky assertions are fixed.

### Existing candidate evidence

The candidate keeps one input path and moves only slow command delivery out of
input handling. It acknowledges durable admission, not merely event recording.
It does not add a durable queue or a tracking owner. Message-link
migration preserves every old row; unknown/conflicting chat coordinates are not
used for replies. Details/Follow buttons reuse that same link, including after
restart. Exact Stop remains separate from background Task cancellation.

An optional source coordinate extension to the shared active-turn read was
necessary: the old `{id, revision}` alone could not tell Telegram which message
was being handled. It adds no state table or new control authority. Semantic
in-turn messages and seamless steering remain deferred as proposed.

Focused checks cover the real event journal with fake Telegram responses,
SQLite migration/reopen, failed recording, lost receipts, cross-chat collisions,
stalled sends, queued corrections and exact controls. Existing runtime recovery
and Conversation tests are included in the broader verification. No production
bot, credentials or model is needed for these checks. Live interaction quality
is deliberately not inferred from them.

The broader suite also exposed malformed Task references blocking the rest of a
Telegram update batch under the new acknowledgment rule. Invalid or ambiguous
references now have an explicit input-error type: Telegram explains the rejection
and continues, while a real storage failure still leaves the update retryable.
The existing end-to-end cancellation/reload test covers that distinction.

The initial draft incorrectly assumed that all recorded-but-unadmitted inputs
were automatically recovered. The implementation instead retains provider
redelivery until admission succeeds, reusing the Host's persisted-event loader
and idempotent route. A regression with an oversized message proves that a lost
receipt plus restart admits the original full input once, even before any
admission plan exists. Missing or corrupt external event bodies fail closed.
Provider retention still bounds how long an unadmitted update can be retried;
accepted Tasks and their durable state do not depend on Telegram retention.

Verification at `67f0600f`:

- `bun run ci`: Host/SDK types, App-boundary checks and lint passed;
  2,742 tests passed, zero failed, and three existing installation-specific
  checks were skipped. Browser checks executed.
- The regression for terminal-answer/watch ordering passed ten consecutive
  local runs after removing the extra deferred watch-ending step.
- Documentation integrity: zero errors/warnings; local Markdown links checked.
- GitHub Container build and isolated image smoke test passed. The PR records
  the current Quality check and review status.
- Live Telegram/model experience trial and deployment: not performed.

### Follow-up review

Four additional synthetic probes exposed gaps not covered by the earlier green
suite: following older work retained an unrelated Topic; a single-task card
with related Tasks lost its exact reply focus; a retried reload finished without
restoring its reply destination; malformed inline event data replayed as `{}`.

The refinement reuses `followTask` to distinguish a card's primary Task from
related detail links, carries the clicked Topic and clears incompatible local
selection, restores reload correlation before admission retry and reads saved
completion through its existing parent-event link. Both inline and external
event bodies must match any stored descriptor and parse as an object. Legacy
rows without descriptors still require valid object data. No new queue, lifecycle,
or observer registration is added.

The obsolete `telegram-reply-smoke.ts` is retired: it checked old session-routing
events and unscoped message IDs rather than current Conversation admission.
Its historical results are not acceptance evidence for this candidate. Current
portable Telegram tests remain; a live experience trial is still pending.

Verification at `c0b98c12`: complete `bun run ci` passed, with 2,746 tests
passing, zero failures, and the same three installation-specific skips across
283 files. Browser coverage executed. Host/SDK type checks, App-boundary checks
and lint passed. Canonical design integrity, examples and App checks passed.
Hosted checks are tracked on the PR. No deployment or live model/Telegram trial
was performed.

The next review identified two narrower gaps. Automatic progress cards omitted
the matching selected Conversation Topic, and recorded-input lookup could only
narrow by event type before scanning history. At `676162ad`, progress captures
the matching Topic before sending and retains it in both the provider-message
link and shown Conversation view. A partial index covers Telegram input type
and provider key without reconstructing the original Task scope. It costs one
index entry per keyed Telegram event and a one-time build for existing storage;
it adds no new state authority or retry process.

Both regressions failed before the fix. The progress test covers delayed sends,
changed selection, replies, Details and Follow; the lookup test inspects the
actual production query plan before and after storage reopen. Existing schema
tests verify index creation on old databases. Full current-revision checks and
hosted results are tracked on the PR; live interaction validation remains pending.

At `fea62dee`, validation errors, help and unknown-command replies join the
existing immediate-command delivery chain. A held-send probe reproduced their
previous overtaking behavior. The change shares the same ordering helper without
adding state or changing which views enter Conversation. Input admission, Stop
and asynchronous updates stay independent. Three regression cases cover send
success, failure and shutdown, including independent chats/topics and preserved
presentation-only feedback. All 42 targeted Telegram tests passed; full local
and hosted verification is tracked on the PR.

At `b49233c2`, one adapter-local conversion interprets stored Telegram thread
coordinates for delivery, Stop controls and watch bookkeeping. The shared event
schema deliberately accepts transport-neutral text: malformed values previously
sent without a thread but registered controls and watches under a different key.
This made Stop appear expired and could duplicate a terminal result. Unsafe
numeric strings also rounded to another identity. Missing or invalid values now
share the existing no-thread fallback without rewriting stored data or adding
state. Conversation Topic identity and exact Stop authorization are unchanged.

Five regression cases failed before this fix. All 54 focused Telegram tests
now pass, including valid/missing/invalid/unsafe stored coordinates, a terminal
result with and without a Task wake, and existing stale/unauthorized Stop checks.
Canonical design integrity, examples and App checks passed. Full current-head
local and hosted verification is tracked on the PR; no live Telegram/model
trial or deployment was performed.

At `5527df51`, reload redelivery checks its exact parent's saved completion
before retrying admission. A completed request can still say pending when its
acceptance write failed; previously that caused a second reload. A saved success
or failure is now returned without reexecution. The regression injects a real
SQLite acceptance-write failure and reopens storage, preserving one request,
one execution and one completion. Both new cases failed before the fix; all 56
focused Telegram tests pass. Full local and hosted verification is tracked on
the PR. No live reload or deployment was performed.

At `6d3ec44e`, accepted reloads without completion can reenter their original
route on provider redelivery. A process-local in-flight guard shares concurrent
deliveries of that event; persisted completion remains the authority after
execution. Result-write failures are logged without inventing an execution
failure and release the guard for later retry. This permits safe redo of an
unfinished definition load, not exactly-once execution or recovery after
Telegram has already acknowledged the command.

Two probes failed before the fix: a stored accepted request without completion
never resumed after storage reopen, and repeated in-flight delivery started
three reloads. The restart matrix models the accepted-before-execution crash
boundary; it is not a live process-kill trial. All 64 focused Telegram/router
tests pass, including result-write failure and existing completed-success/failure
cases. Current full local, hosted and requested Copilot review evidence is tracked
on the PR. No live reload, model call or deployment was performed.

The verification follow-up at `c85f4f8b` uses a monotonic clock for the existing
Stop test's eight-second wait after observing an early wall-clock timeout.
The timeout and assertions are unchanged; its focused tests pass. The known
separate controller-retry instability and all full-run outcomes remain disclosed
on the PR rather than being hidden by test retries or skipped coverage.

The requested Copilot review identified stale selected-Topic Task links in its
summary. At `7bfb7f08`, Task views and progress reread that Topic by ID before
checking membership and refresh the local cache. The existing progress-context
test now links the Task after Topic selection; it reproduced a lost Topic before
the fix and passes afterward, retaining its delayed-send, reply and button checks.
No new subscription or state authority is added.
