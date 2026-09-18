# Human Control Surfaces

**Design status:** Accepted.
**Implementation status:** The shared commands, Conversation reads, Task reads,
and one-watch interaction are implemented for May Console and Telegram.
Canonical message identity across bounded fallback projections is implemented.
Exact attempt-scoped progress and suppression of unchanged watch output are
also implemented. Console correlates a canonical Conversation result with its
exact watched Task and suppresses the equivalent supporting terminal card.
Human-action projection follows exact dependency leaves and preserves legacy
`Hao` approval visibility while canonical `human:<role>` ownership is adopted.
Durable May admission exposes the responsible Task directly. The
[shared conversation-input handler](message-lifecycle.md#one-conversation-input-path)
runs through the Conversation's stable Task, including linked-result reviews;
it replaced the separate supervision Task in #158. Historical supervision
records are not an additional current work owner.
The focused review at Host `99bc1a31` includes durable turn Stop, accepted Request
storage/closure, Console Esc and Telegram/browser Stop-button bindings. Current-turn
steering remains open. App judgment needs separate
[behavioral evidence](message-lifecycle.md#current-implementation-and-gaps).

**Aligned with:** [system-model.md](system-model.md),
[message-lifecycle.md](message-lifecycle.md), [may-console.md](may-console.md),
and [telegram-notifications.md](telegram-notifications.md).

The [Telegram experience candidate](../proposals/telegram-conversation-experience.md)
implements optional contextual Task buttons, compact progress and source-aware
turn display. The shared active-turn read adds only optional source coordinates;
exact control identity and revision checks remain unchanged. This candidate is
not yet a merged or deployed experience claim.

## Mental model

Console and Telegram are adapters over the same May Conversation and the same
Tasks. They own presentation, provider coordinates, and local watch state.
They do not own work.

Conversation remains the place for active discussion, including long design
reviews and joint problem-solving. Only a specific independent outcome becomes
background work; see [Message Lifecycle](message-lifecycle.md#mental-model).

```text
Console ──┐
          ├─> Conversation may:primary ─> May App (`may`)
Telegram ─┘                                │
                                           └─> Tasks owned by responsible Apps
```

The ordinary human objects are:

- an App, which owns a responsibility;
- a Request, which is an accepted ask May must close the loop on in Conversation;
- a Task, which is durable work reconciled by an App;
- a Topic, which links related turns to exact Tasks; and
- a Conversation message, which is how a human talks with May.

An inbox item correlates one input with its handling result.
It may finish while a conversational Request remains unresolved. Host row IDs
and replaceable execution sessions remain diagnostic details.
In the accepted [one-lifecycle baseline](task-resource-engine.md#one-lifecycle-baseline),
one stable Task actually executes the Conversation's Turns. It is not a wrapper
around another running inbox handler, a Task per message or a background handoff.
The Conversation, Topic-to-Task links, responsible Tasks and event log preserve
Request evidence. Users still chat normally and manage delegated work explicitly.
In the accepted design, linked Task facts and timer-discovered follow-up enter the same conversation
handler as human input. The active Turn exposes its source and the same Stop
control; users need no supervisor or subscription command. May may own ordinary
goal Tasks when it owns the responsibility.
The installed maintenance App owns its assigned runtime-change Tasks. An agent
run named `may` is an execution profile selected for a bounded attempt, not an
implicit runtime administrator.

The target distinguishes an accepted outcome from Task closure in reads and
controls. Esc/Stop ends the current Turn; Request closure resolves an ask; Task
closure ends future execution. Background pause must leave conversation handling
available. Ordinary Apps can close work after accepting its result; no extra
user action is needed for that convention. The command/view details below still
describe current source, including `maintain`/`done`; their migration is pending.
No new slash command is specified by this design.

## Shared resource interface

Every human adapter exposes the same small meanings:

| Meaning               | Console form                                 | Telegram form                                       |
| --------------------- | -------------------------------------------- | --------------------------------------------------- |
| list or select App    | `/apps [app]`                                | native `/apps [app]`                                |
| list Topics           | `/topics`                                    | native `/topics`                                    |
| show or follow Topic  | `/topic [ref\|clear]`                        | native `/topic [ref\|clear]`                        |
| list Tasks            | `/tasks [all] [history]`, then `/tasks more` | native `/tasks [all] [history]`, then `/tasks more` |
| show human actions    | `/todo [all]`, `/todo more`                  | native `/todo [all]`, `/todo more`                  |
| read one Task         | `/task <ref>`                                | native `/task <ref>`                                |
| watch one Task        | `/watch [ref]`                               | `/watch [ref]`, later buttons allowed               |
| stop watching         | `/unwatch`                                   | `/unwatch`                                          |
| cancel one Task       | `/cancel [ref]`                              | `/cancel [ref]`                                     |
| stop this turn        | Esc when the conversation input has focus    | Stop button on the active turn                      |
| talk or give feedback | bare text                                    | ordinary message                                    |

Adapters may render these resources differently. Console uses aligned text and
tab completion. Telegram uses compact messages and may add native buttons.
The Host resolves Apps and Task references and revalidates canonical identity.
The Stop row is the accepted interface; see [current-turn control](#current-turn-control)
for the current implementation. A browser conversation uses the same Stop button
and exact turn target.

Help groups everyday conversation and Task controls separately from Host
administration and diagnostics. `/reload` reloads Host definitions; Console
`/restart` restarts the Host. Neither is limited to the selected App. Console
`/exit` closes the client; `/shell` leaves it for a local shell. Keep raw/session
diagnostics out of ordinary help. This is presentation in the existing adapters,
not a new command framework.

Telegram currently also accepts an unlisted `/close` that shuts down the entire
Host. Remove that ambiguous command from the ordinary adapter; any retained
shutdown control belongs to explicit Host administration with its scope visible.
`/todo` lists Tasks needing human action, not every open conversational Request.

Each surface may also follow one Topic. `/topics` lists the newest page of short
references, plain titles, and linked Task counts; `/topics more` reads older
pages. `/topic <ref>` resolves that exact Topic from indexed storage even when
it is old, selects it, and shows bounded related turns plus linked Task
references. `/topic` shows the current selection and `/topic clear` leaves it.
The selection only adds the exact Topic ID to later human messages. It never
starts, stops, or owns work. Switching Topic ends an unrelated local Task watch,
but the Task continues.

Older Topics remain addressable by stable reference and paged history rather
than being copied into every May prompt. Selecting an older Topic or replying
to one of its messages supplies the exact identity, so the Host loads its
bounded turns and current canonical Task links. When ordinary text refers to an
older discussion without an exact identity, May may use bounded read-only Topic
lookup and then choose the relevant exact Topic. Adapters do not guess by
keywords, silently change their selected Topic, or treat lookup as work.

Clarifying questions and answers use the same Conversation on every surface.
An adapter preserves reply coordinates and Topic identity when available, but
does not parse the answer or maintain a questionnaire. May interprets a full or
partial answer from the shared ordered Turns. If the question came from an
exact Task's human-owned Condition, the rendered question carries that Task
identity so May can return the answer to the same work even when the human
responds from another surface.

`replyTo` records a human-selected reply target, not the last message an adapter
displayed. Replayed history and asynchronous results must not silently bind the
next human message. Console has no message-reply gesture: bare text uses the
shared Conversation plus its selected App, Topic, and watched Task context.

Each adapter surface keeps one selected App, initially `may`. `/apps` lists
Apps and `/apps <app>` changes that local selection. `/tasks` reads live Tasks
for the selected App, including `maintain` Tasks that are currently converged;
`all` widens the read to every App, and `history` adds retained terminal Tasks.
Selection is a small Console-process or Telegram chat/topic variable, not
another durable resource. An exact `/task <ref>` may cross the selected App
boundary. An adapter preserves the human's local input
order by changing the local selection immediately, so a following command or
message uses the newly selected App without waiting for its asynchronous
validation read or serializing Host event handling. Failed validation restores
the prior selection, and a stale validation response cannot overwrite a newer
selection.

Host input-handling history is diagnostic data, not a second work interface.
`/session`, `/sessions`, and `/steer` are not current ordinary human commands.
The turn-control contract below does not introduce those session commands.

## Stable Task identity

The canonical Task identity is `{ appId, taskId }`. Humans normally see an
eight-character SHA-256 alias such as `8f12ac90`. The Host indexes the full
digest from a versioned, length-safe encoding of the canonical identity.

- eight characters are shown while unique;
- colliding aliases expand to sixteen, then the full digest;
- ambiguous input fails and never chooses by list position; and
- a retained completion or cancellation stays addressable by the same alias.

Numbers shown for visual layout are never accepted as identity.

## Conversation

Ordinary text publishes one durable `conversation.message.created` event for
`may:primary`. Console and Telegram both listen for `conversation.updated`,
re-read the append-only Conversation, and render stable message IDs they have
not shown on that surface.

Conversation shows both sides of a durable promise without confusing them:

- an agent-authored message says what May understood or decided; and
- a tool-authored Task activity says what Runtime actually admitted, with an
  exact `taskRefs`/`followTask` identity.

The accepted [Request contract](message-lifecycle.md#requests-acceptance-and-closure)
adds continuity across these messages: what May accepted, what remains, and
the final outcome or explicit reason for closure. Humans can refer to that ask
in ordinary conversation without managing internal request IDs. Start with
clear acknowledgments, progress and closure messages; no separate Request
dashboard or new slash-command family is required. A Task card's `done` state
alone does not show that May has answered the original ask.

The admission activity causes Console to follow the Task immediately. Later
Task wakes make the adapter re-read canonical Task state; they do not append a
message for every internal event. Adapters render meaningful states in their
native style: queued, working with the latest useful progress, waiting with an
exact blocker and resume condition, needs-human-action, up to date for a live
converged maintain Task, or done with a terminal result. A claim that work is
active must come from Task/execution state, never from May's prose alone.

An explicitly requested App or Task view is appended as a command-authored
Conversation message only after it is shown successfully. Its bounded metadata
contains ordered canonical `taskRefs`, so the next May turn receives the view
the human actually saw. Automatic watch progress, reconnect notices, typing
indicators, and delivery notices are transient.

All command events remain durable evidence, while the current Conversation
projection exposes only the newest command view per adapter surface. `/tasks`
returns ten compact cards at a time and `/tasks more` continues the same opaque
cursor. Exact outcome, progress, result, and evidence stay available through
`/task <ref>`.

In the shared Task lifecycle PoC, exact detail includes the structured accepted
result while the Task remains open; compact cards omit that payload. A newer
running attempt must not display the prior result as its current answer.

Apps must author `spec.outcome` as the concrete goal a human can recognize and
`spec.acceptance` as the observable result that finishes it. The human surface
does not recover a hidden goal from arbitrary App input and does not ask a model
to rewrite generic Task text.

Each compact Task row shows the stable reference, owning App, a plain state
(`queued`, `working`, `waiting`, `needs review`, `up to date`, `done`, or
`cancelled`), how recently it changed, its goal, and either `needs you` or `no
action from you`. `up to date` means a live `maintain` Task is converged with
no pending cycle; `done` is terminal. If a new wake makes that Task changed or
ready, show it as queued even while its last accepted phase remains converged.
Exact reads, lists, and status filters must agree; this is a projection of
existing readiness, not a second stored phase or lifecycle.
`attention` alone means App review or recovery; only an open human-owned
Condition means `needs you`.

An exact Task view answers five questions directly from the existing resource:

1. `Goal` — what the Task is for (`spec.outcome`);
2. `State` — what its phase, readiness, and current attempt mean in plain
   language;
3. `Current` — its newest useful progress, result, or exact wait;
4. `Expected result` — how completion is judged (`spec.acceptance`); and
5. `You` — the requested human action, or `Nothing needed right now.`

For a wait, `Current` also names who or what acts next, the exact resume event,
and the next recovery review. `Nothing needed right now` is valid only when no
unresolved dependency leaf needs human action; it never means that an
ownerless or unreviewed wait is healthy. The exact updated time follows those
answers. Canonical Task ID and diagnostic session remain available last as
secondary details. This is one bounded read projection of Task truth: it adds
no presentation record, lifecycle, polling, delivery acknowledgement, or model
turn.

## Human actions

Human attention is a derived Task view, not another inbox. A live Task appears
in `/todo` while it or an exact reachable dependency leaf has an unsatisfied
Condition whose canonical owner is `human` or `human:<role>`. Display names
such as `Hao` are labels, not owner identities. Generic `attention`, failure,
elapsed time, and provider delivery state do not qualify.

`/todo` reads the selected App and `/todo all` widens the read to every App.
Each row is deduplicated by the Task that owns the Condition and shows its
stable reference, App, plain requested action, and, when the Condition records
it, the age of the current human wait. A selected App's view includes human
blockers reachable through its exact dependencies, while still pointing to the
leaf Task that the human will update. No state is copied onto the parent. An
unknown start time is omitted rather than inferred from later observation. A
human-owned Condition should set
`requestedAction`; existing approval Conditions are rendered from their
allowed decisions and approval identity, and older generic Conditions fall
back to the Task's waiting summary. The projection is paged in groups of 50;
`/todo more` follows the same opaque cursor used by the Task reader.

Off watch, a semantic reconciliation or cancellation wake causes one
coalesced App-scoped reread. A surface may best-effort announce a new or
materially changed requested action, and Console updates its prompt count, for
example `you[evaluation · 2 todo]>`. Executor progress does not rescan this list.
While watched, the normal exact Task card shows `Action needed`; the same
change is not also presented as an off-watch notification on that surface.

After `/todo` or an automatic notification is actually shown, its canonical
Task identities may enter Conversation as command-view metadata. Each adapter
keeps only a bounded local map of the requested actions it has shown. Adapters
do not coordinate notification delivery or promise cross-surface exactly-once
presentation. A lost adapter cache may repeat presentation, but never creates,
completes, or acknowledges human work. Clearing the Condition removes the Task
on the next semantic wake. Delivery never gates that transition.

Provider delivery is observational. A failed or uncertain adapter send cannot
change a Conversation result or a Task.

Bare text always goes to May with `context.focusedApp`. A watch additionally
adds `context.focusedTask`. The selected App is a useful conversational lens,
not permission to force work into the wrong owner.

### Exact plain-text decisions

A narrow explicit decision may additionally produce a generic control fact when
all of these mechanical conditions hold: the provider authenticated a configured
approver; the literal reply is exactly an allowed decision such as `approve`,
`reject`, or `defer`; it replies to one stored human-action card; and the card's
immutable approval identity, packet/proposal hashes, revision, Task, and allowed
decisions still match one current unresolved human Condition. The adapter stores
that anchor from the same exact Task snapshot whose text it displays. A reply to
an older card cannot decide its replacement.

The literal reply still enters the ordinary Conversation with provider sender,
message, reply, chat, thread, Task, and Topic correlation. Conditional text,
corrections, unbound affirmations, unauthorized senders, ambiguous multi-Task
cards, and stale anchors remain only Conversation input. The adapter does not
interpret them as consent.

The control fact is journaled evidence, not App-work admission and not mutation
authority by event name alone. Current state comes first: ingress rereads the exact
Task/Condition before journaling a decision, and applying code rereads it again
before mutation. Its anchor includes the Task generation and exact Condition
identity, but not mutable resource version; a cancelled, terminal or
new-generation Task cannot reuse the old card. An applying App must reread the
trusted journal source and exact decision association at its mutation boundary,
immediately recheck the reviewed candidate/evidence/scope/current target, and
enforce replay idempotency. A separately approved activation operation must also
pin the source identity it will activate and report the identity actually loaded.
Source application, activation, observed adoption, and independent follow-up are
separate receipts on the ordinary accountable Task; failure of a later stage
cannot rewrite an earlier receipt into completed rollout.

When May assigns asynchronous work, the Conversation Topic links to the real
Tasks owned by destination Apps. When a destination App durably attaches the
request, one assignment message names the owner App, repeats the concrete
requested outcome, names that exact owner Task, and carries a canonical
`followTask` presentation hint. Console automatically
follows that owner Task; it never guesses from prose, the newest session, or the
last Task reference. Exact Task detail shows linked App Task references and typed
Conditions, never internal request IDs. A human can also `/watch` another Task or
continue talking naturally. While watching, text still goes to May. May uses the
focused identity as context and routes typed input to that exact owner Task only
when the understood intention concerns it. Relevant feedback wakes waiting work
for one reconsideration and does not create a sibling Task; an answerable
question or unrelated topic does not mutate it.
Several human turns may target the same Task, but they do not become several
owners of its output. Assignment is unique by Conversation, Topic, and owner
Task. The Task emits each public transition once regardless of how many human
requests or surfaces refer to it. Its canonical view supplies progress, waits,
and results; Topic never copies them.

Runtime reload is deterministic control, not App work. The request is accepted
synchronously, the Runtime performs one reload, and one correlated
`runtime.reload.finished` fact reports success or failure. Only the initiating
adapter renders that fact. After successful presentation it appends the result
as a command-authored Conversation message, so another surface and May can use
what the human actually saw. Reload creates no Task, queue entry, or model turn.

## One focused watch

Each Console process or Telegram chat/topic may watch at most one Task. Watch
state belongs to the adapter surface; it is not a Task field and does not force
another surface to watch. Console follows the newly assigned responsible Task
by default.
An explicit `/watch`, a newer assignment, or an App-context switch replaces or
ends that local watch without changing either Task.

While watching, bare text still goes through May. The adapter attaches:

```json
{
  "focusedTask": {
    "appId": "evaluation",
    "taskId": "review/docs"
  }
}
```

May therefore receives natural human language plus an exact Task identity. The
identity is a candidate referent, not an instruction. May first decides whether
the human is asking about that Task, changing or controlling it, or starting an
unrelated topic. It uses the identity for mutation only when the understood
intention concerns the unfinished Task. When authoring the May request, the
Host resolves that identity once to a bounded current status, summary, response,
and evidence observation. A missing or unreadable Task is reported as unknown;
focus never causes a broad scan, poll, or admission failure.
The executor also receives the Task's accepted open Conditions and live App
request identities. For relevant feedback it must reconsider the human's actual
concern against that existing state, preserve a still-relevant wait, and create
different work only when the current Task cannot fulfill the outcome.
For a request that originally asked an App to create suitable work, its later
resolved owner Task is observation, not a new target. Reusing that request keeps
the original request identity and target semantics; it does not retarget or
replace the dependency.
Fresh feedback wakes a waiting or attention Task once. Unrelated text and text
without an exact focus do not globally wake every blocked Task.
May then answers directly, asks for the smallest irreducible clarification,
sends typed input to the owning App and exact Task, or delegates a genuinely
new outcome.
The adapter never steers a temporary session and May never edits another App's
Task storage directly.

A semantic Task transition or human-readable executor progress message emits
an identity-only wake. Executor lifecycle stages remain diagnostic and do not
wake a human surface. The adapter coalesces updates, performs at most one read
at a time, and renders the latest Task. A terminal result ends the watch
automatically. `/unwatch` changes only local presentation.

Automatic progress is shown at most once per live adapter surface and semantic
Task revision. The adapter retains a bounded map of revisions it actually
rendered. Returning with `/watch <ref>` shows one compact catch-up snapshot only
when the current Task revision differs; it does not replay a transcript or turn
presentation into delivery state. Explicit `/task <ref>` remains an intentional
read and may show the current value again. Restarting an adapter creates a new
surface, so it may show the current snapshot once.

Watch does not poll and owns no timer, workflow, session, or model turn.

## Current-turn control

**Interface decision:** Use Esc in Console and a Stop button in Telegram/browser.
No `/stop` command is needed in the intended everyday vocabulary.

| Console context                                   | Esc behavior                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| A menu or dialog is open                          | Dismiss that UI first; do not stop work                               |
| Conversation input has focus and a turn is active | Request Stop for that exact turn; preserve the draft and Conversation |
| No turn is active                                 | Preserve the draft and Conversation; do not exit Console              |

Show the shortcut while a turn is active. A Stop button carries the observed
turn identity and becomes inactive when that turn ends. A control reports
whether Stop was accepted or its target had already ended; acknowledging the
request does not promise every external operation has already halted.
If persistence fails or the adapter is disconnected, report that Stop was not
confirmed. Never display a stopped outcome based only on a local keypress.

**Current implementation:** Host #112 added durable Stop; #121 added Console
Esc and Telegram/browser Stop buttons and removed Console `/stop`. Adapters
read `activeTurn: { id, revision }` from the Conversation resource and publish
`conversation.turn.stop.requested` with App, Conversation, turn ID and expected
revision. This is present in the focused `99bc1a31` source review, not a claim
that an installation is running that release.

Ordinary messages still wait for the active Conversation claim. Stop followed
by a new message provides the first simple redirection path: Esc, then the
correction. The later steering capability
below must retain the correction durably. Existing low-level session controls
alone do not establish that contract. At that reviewed revision, failed
conversational execution had a durable failed outcome without automatic model
retry. The shared Task PoC retains unfinished input for paced retry; an explicit
Stop still prevents replay of the stopped input.

Human adapters expose distinct meanings:

| Action                 | Effect                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Stop this turn         | Stop the exact active conversational turn, leaving admitted background Tasks running. |
| Steer this turn        | Apply a correction to the exact active conversational turn.                           |
| Steer or cancel Task X | Send feedback to, or cancel, that exact durable Task.                                 |
| Stop watching          | End local notifications; work continues.                                              |

An adapter targets the observed Conversation and turn identity. Stop and
explicit steering travel through events to Host control without waiting for
the model or the ordinary turn queue. A delayed control for an older turn must
never silently target a newer execution. Natural-language Task feedback still
goes through May's interpretation; Task controls do not target a guessed session.

In the shared Task lifecycle, Stop first commits the attempt fence and the
disposition of its exact inputs, then signals execution to abort. Those inputs
cannot be retried by recovery, and late callbacks cannot append a successful
reply or admit new work on the stopped attempt's behalf. Already admitted Tasks remain addressable and
continue unless separately cancelled. Stopping does not undo earlier messages
or completed effects, or guarantee that an external operation aborts instantly.
Later human input can start a new turn in the same discussion.
Failed Stop persistence leaves execution unchanged. A repeated committed Stop
is idempotent; a stale control for an already completed attempt is rejected
without changing its accepted result.
The conversational Request remains unresolved unless the human also withdraws
the ask. Its presence must not automatically restart the stopped turn. Cancelling
the ask and cancelling a linked Task are explicit, related decisions; closing
a conversational Request alone cannot stop background execution.

Steering preserves the correction in Conversation and acknowledges whether it
was applied to current work or retained for the next turn. Use executor steering
when supported; otherwise interrupt and continue from the corrected input and
current evidence. Do not require seamless execution recovery or blindly repeat
side effects. If the target turn has already finished, retain the unconsumed
correction for the next turn rather than silently losing it. Receiving a
correction is not evidence that its requested change has been completed.
No `/steer` command is required. Keep ordinary discussion and corrections in
Conversation; an explicit steering gesture, if added, supplies timing and the
exact target while the App interprets the correction.

Keep these mechanics on the existing event system, turn/request state, and
execution controls. Adapters provide presentation and exact targets; the Host enforces
identity and stop state; Apps/LLMs interpret corrections. No per-turn Task,
separate control service, or new work lifecycle is required.

## Cancellation

`/cancel` changes the named or watched Task, not its current session. The Host:

1. persists a cancellation record;
2. advances the Task resource fence;
3. removes it from ready and recovery indexes;
4. aborts the exact current attempt, whose adapter releases its session,
   workflow, Codex turn, or CLI process tree; and
5. retains a cancellation result distinct from accepted achievement.

An in-flight stale result cannot cross the new resource fence. Current source
may refuse generic cancellation of a maintained Task and name an App-specific
control instead. The pending common lifecycle removes that mode exception:
an authorized owner can close any Task, with non-success retained for unfinished
work and no implicit cancellation of independent children. `/unwatch` is never
cancellation.
Use `/cancel <ref>` when the target is not already watched. Bare `/cancel`
resolves only the currently watched Task and fails when there is none. Render
the exact Task reference and summary in its acknowledgment so the target is
clear. Esc never substitutes for Task cancellation, and `/exit` only closes
the Console client.

## Performance boundary

Human reads do not invoke a model and do not reconstruct Conversation history:

- passive Conversation synchronization reads bounded messages only;
- repeated Conversation wakes coalesce to one active read plus one dirty retry;
- each adapter keeps only a bounded deduplication window larger than its read page;
- `/task` uses one indexed reference lookup and one exact resource read;
- `/tasks` is a bounded indexed page ordered by semantic update time; each
  surface retains only its next opaque cursor and `/tasks more` continues the
  exact prior App/state query without asking the human to copy that cursor;
- `/apps` reads the loaded registry plus aggregate active counts;
- Task reference hashes are indexed at Task creation/import; and
- watch is push-to-read with one coalesced in-flight read; and
- `/todo` is a capped indexed Condition projection, refreshed only by
  App-scoped semantic Task wakes and coalesced to one in-flight read.

Lease renewals, tool chunks, transcript text, queue movement, and delivery
events do not wake human Task watches. Slow adapters never block Task commit.
Stale-result fencing, previous-runtime recovery, and socket reconnect details
remain attempt diagnostics or transient adapter notices. They never replace the
Task's semantic summary, progress, or accepted Conditions.

## Adapter responsibilities

An adapter may parse native commands, cache bounded completions, choose layout,
and keep one local watch plus a bounded rendered-revision map. It must not own a
work queue, infer a Task from the latest session, make delivery part of Task
state, poll for watch progress, or send slash-command ambiguity to a model.

## Verification

Tests must prove stable collision-aware references, bounded indexed reads,
selected-App defaults, explicit assignment auto-follow, App-switch watch exit,
one-watch replacement, at-most-once automatic progress, focused feedback through
May, fresh-input wake from waits, wake coalescing, automatic
terminal exit, durable Task cancellation, stale-attempt fencing, cross-surface
Conversation context, exact human-Condition membership, bounded `/todo`
reconstruction, and independence from adapter delivery.

Retain the existing durable Stop checks: controls
bypass a busy turn, stopped requests stay stopped after restart, late results
and admissions are rejected, already admitted Tasks survive a turn Stop, stale
controls cannot affect a newer turn. Before claiming the new interfaces work,
verify Esc precedence for menus/dialogs, draft preservation, idle behavior,
exact button targets and truthful acknowledgments. Steering separately needs
completion-race checks without losing or applying the same correction twice.
