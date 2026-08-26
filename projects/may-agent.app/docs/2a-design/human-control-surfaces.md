# Human Control Surfaces

**Design status:** Accepted.
**Implementation status:** Implemented for May Console and Telegram.

**Aligned with:** [system-model.md](system-model.md),
[message-lifecycle.md](message-lifecycle.md), [may-console.md](may-console.md),
and [telegram-notifications.md](telegram-notifications.md).

## Mental model

Console and Telegram are adapters over the same May Conversation and the same
Tasks. They own presentation, provider coordinates, and local watch state.
They do not own work.

```text
Console ──┐
          ├─> Conversation may:primary ─> May App (`may`)
Telegram ─┘                                │
                                           └─> Tasks owned by responsible Apps
```

The ordinary human objects are:

- an App, which owns a responsibility;
- a Task, which is durable work reconciled by an App;
- a Topic, which links related turns to exact Tasks; and
- a Conversation message, which is how a human talks with May.

A Host request correlates one caller with its eventual result. A session is a
replaceable execution attempt. Neither is the ordinary human control target.
May has one normal visible conversation Task per Conversation, not one generic
Task per human request. It also may own other goal Tasks when no other App is
responsible. The Host Operations App (`may-agent`) owns platform
Tasks. An agent run named `may` is only a bounded turn decision or an attempt
selected by an App.

## Shared resource interface

Every human adapter exposes the same small meanings:

| Meaning                | Console form                                   | Telegram form                                         |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| list or select App     | `/apps [app]`                                  | native `/apps [app]`                                  |
| list Topics            | `/topics`                                      | native `/topics`                                      |
| show or follow Topic   | `/topic [ref\|clear]`                         | native `/topic [ref\|clear]`                         |
| list Tasks             | `/tasks [all] [history]`, then `/tasks more`   | native `/tasks [all] [history]`, then `/tasks more`   |
| show human actions     | `/todo [all]`, `/todo more`                    | native `/todo [all]`, `/todo more`                    |
| read one Task          | `/task <ref>`                                  | native `/task <ref>`                                  |
| watch one Task         | `/watch [ref]`                                 | `/watch [ref]`, later buttons allowed                 |
| stop watching          | `/unwatch`                                     | `/unwatch`                                            |
| cancel one Task        | `/cancel [ref]`                                | `/cancel [ref]`                                       |
| reload definitions     | `/reload`                                      | native `/reload`                                      |
| talk or give feedback  | bare text                                      | ordinary message                                      |

Adapters may render these resources differently. Console uses aligned text and
tab completion. Telegram uses compact messages and may add native buttons.
The Host resolves Apps and Task references and revalidates canonical identity.

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

Each adapter surface keeps one selected App, initially `may`. `/apps` lists
Apps and `/apps <app>` changes that local selection. `/tasks` reads active
Tasks for the selected App, `all` widens the read to every App, and `history`
adds retained terminal Tasks. Selection is a small Console-process or Telegram
chat/topic variable, not another durable resource. An exact `/task <ref>` may
cross the selected App boundary. An adapter preserves the human's local input
order across an asynchronous selection read, so a following command or message
uses the newly selected App without serializing Host event handling.

Host request history is diagnostic data, not a second work interface.
`/session`, `/sessions`, and `/steer` are not ordinary human commands.

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

The admission activity causes Console to follow the Task immediately. Later
Task wakes make the adapter re-read canonical Task state; they do not append a
message for every internal event. Adapters render meaningful states in their
native style: queued, working with the latest useful progress, waiting with an
exact blocker and resume condition, needs-human-action, or done with the
result. A claim that work is active must come from Task/execution state, never
from May's prose alone.

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

Apps must author `spec.outcome` as the concrete goal a human can recognize and
`spec.acceptance` as the observable result that finishes it. The human surface
does not recover a hidden goal from arbitrary App input and does not ask a model
to rewrite generic Task text.

Each compact Task row shows the stable reference, owning App, a plain state
(`queued`, `working`, `waiting`, `needs review`, `done`, or `cancelled`), how
recently it changed, its goal, and either `needs you` or `no action from you`.
`attention` alone means App review or recovery; only an open human-owned
Condition means `needs you`.

An exact Task view answers five questions directly from the existing resource:

1. `Goal` — what the Task is for (`spec.outcome`);
2. `State` — what its phase, readiness, and current attempt mean in plain
   language;
3. `Current` — its newest useful progress, result, or exact wait;
4. `Expected result` — how completion is judged (`spec.acceptance`); and
5. `You` — the requested human action, or `Nothing needed right now.`

The exact updated time follows those answers. Canonical Task ID and diagnostic
session remain available last as secondary details. This is one bounded read
projection of Task truth: it adds no presentation record, lifecycle, polling,
delivery acknowledgement, or model turn.

## Human actions

Human attention is a derived Task view, not another inbox. A live Task appears
in `/todo` only while it has an unsatisfied Condition whose owner is `human` or
`human:<role>`. Generic `attention`, failure, elapsed time, and provider
delivery state do not qualify.

`/todo` reads the selected App and `/todo all` widens the read to every App.
Each row shows one stable Task reference, App, plain requested action, and,
when the Condition records it, the age of the current human wait. An unknown
start time is omitted rather than inferred from later observation. A
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
another surface to watch. Console follows a newly assigned owner Task by default.
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

## Cancellation

`/cancel` changes the named or watched Task, not its current session. The Host:

1. persists a cancellation record;
2. advances the Task resource fence;
3. removes it from ready and recovery indexes;
4. interrupts the current local session when one exists; and
5. retains a cancellation result distinct from accepted achievement.

An in-flight stale result cannot cross the new resource fence. A maintained
responsibility may refuse generic cancellation and name its App-specific
control instead. `/unwatch` is never cancellation.

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
