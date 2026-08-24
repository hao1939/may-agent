# Human Control Surfaces

**Design status:** Accepted.
**Implementation status:** Implemented for May Console and Telegram.

**Aligned with:** [system-model.md](system-model.md),
[message-lifecycle.md](message-lifecycle.md), [may-console.md](may-console.md),
and [telegram-notifications.md](telegram-notifications.md).

## Mental model

Console and Telegram are adapters over the same May Conversation and the same
App Tasks. They own presentation, provider coordinates, and local watch state.
They do not own work.

```text
Console ──┐
          ├─> Conversation may:primary ─> May App (`may`)
Telegram ─┘                                │
                                           └─> responsible App Tasks
```

The ordinary human objects are:

- an App, which owns a responsibility;
- a Task, which is durable work reconciled by an App; and
- a Conversation message, which is how a human talks with May.

A Host request correlates one caller with its eventual result. A session is a
replaceable execution attempt. Neither is the ordinary human control target.
The May App owns Conversation Tasks; the Host Operations App (`may-agent`) owns
platform Tasks. An agent run named `may` is only an attempt used by either App.

## Shared resource interface

Every human adapter exposes the same small meanings:

| Meaning             | Console form              | Telegram form                         |
| ------------------- | ------------------------- | ------------------------------------- |
| list or select App  | `/apps [app]`             | native `/apps [app]`                  |
| list Tasks          | `/tasks [all] [history]`, then `/tasks more` | native `/tasks [all] [history]`, then `/tasks more` |
| show human actions  | `/todo [all]`             | native `/todo [all]`                  |
| read one Task       | `/task <ref>`             | native `/task <ref>`                  |
| watch one Task      | `/watch [ref]`            | `/watch [ref]`, later buttons allowed |
| stop watching       | `/unwatch`                | `/unwatch`                            |
| cancel one Task     | `/cancel [ref]`           | `/cancel [ref]`                       |
| reload definitions  | `/reload`                 | native `/reload`                      |
| talk or give feedback | bare text               | ordinary message                      |

Adapters may render these resources differently. Console uses aligned text and
tab completion. Telegram uses compact messages and may add native buttons.
The Host resolves Apps and Task references and revalidates canonical identity.

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

## Human actions

Human attention is a derived Task view, not another inbox. A live Task appears
in `/todo` only while it has an unsatisfied Condition whose owner is `human` or
`human:<role>`. Generic `attention`, failure, elapsed time, and provider
delivery state do not qualify.

`/todo` reads the selected App and `/todo all` widens the read to every App.
Each row shows one stable Task reference, App, plain requested action, and the
age of the current human wait. A human-owned Condition should set
`requestedAction`; existing approval Conditions are rendered from their
allowed decisions and approval identity, and older generic Conditions fall
back to the Task's waiting summary. The projection is capped at 50 Tasks and
reports the authoritative total when more exist.

Off watch, a semantic reconciliation or cancellation wake causes one
coalesced App-scoped reread. A new or materially changed action produces one
compact notification and updates Console's prompt count, for example
`you[evaluation · 2 todo]>`. Executor progress does not rescan this list.
While watched, the normal exact Task card shows `Action needed`; the same
change is not also presented as an off-watch notification on that surface.

After `/todo` or an automatic notification is actually shown, its canonical
Task identities enter Conversation as command-view metadata. The automatic
view uses a stable hash of the current bounded Task revisions, so several
adapters can preserve one semantic Conversation view while choosing native
presentation. A lost adapter cache may repeat presentation, but never creates,
completes, or acknowledges human work. Clearing the Condition removes the Task
on the next semantic wake. Delivery never gates that transition.

Provider delivery is observational. A failed or uncertain adapter send cannot
change a Conversation result or a Task.

Bare text always goes to May with `context.focusedApp`. A watch additionally
adds `context.focusedTask`. The selected App is a useful conversational lens,
not permission to force work into the wrong owner.

When May assigns asynchronous work, the Conversation shows the stable May Task
reference and its useful current wait. When the destination App durably attaches
the request, one assignment message names both the May Task and exact owner Task
and carries a canonical `followTask` presentation hint. Console automatically
follows that owner Task; it never guesses from prose, the newest session, or the
last Task reference. Exact Task detail shows linked App Task references and typed
Conditions, never internal request IDs. A human can also `/watch` another Task or
continue talking naturally. While watching, feedback is routed as typed input to
that exact owner Task. It wakes waiting work for one reconsideration and does not
create a sibling Task.
The first waiting status is shown as soon as May accepts the dependency: what
is known, which Task owns the next step, and what it is actually waiting for.
Later distinct waiting summaries may update it; unchanged summaries are
deduplicated. This is visible observation, not a transport receipt.

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

May therefore receives natural human language plus an exact Task identity. May
uses that identity only when the message is feedback for the unfinished Task.
Fresh feedback wakes a waiting or attention Task once. Unrelated text and text
without an exact focus do not globally wake every blocked Task.
May then interprets the feedback and sends typed input to the owning App and
exact Task.
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
