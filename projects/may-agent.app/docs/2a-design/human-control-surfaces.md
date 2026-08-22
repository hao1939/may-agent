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
          ├─> Conversation may:primary ─> May
Telegram ─┘                                │
                                           └─> App Tasks
```

The ordinary human objects are:

- an App, which owns a responsibility;
- a Task, which is durable work reconciled by an App; and
- a Conversation message, which is how a human talks with May.

A Host request correlates one caller with its eventual result. A session is a
replaceable execution attempt. Neither is the ordinary human control target.

## Shared resource interface

Every human adapter exposes the same small meanings:

| Meaning             | Console form              | Telegram form                         |
| ------------------- | ------------------------- | ------------------------------------- |
| list Apps           | `/apps [app]`             | native `/apps [app]`                  |
| list Tasks          | `/tasks [app] [all]`      | native `/tasks [app] [all]`           |
| read one Task       | `/task <ref>`             | native `/task <ref>`                  |
| watch one Task      | `/watch [ref]`            | `/watch [ref]`, later buttons allowed |
| stop watching       | `/unwatch`                | `/unwatch`                            |
| cancel one Task     | `/cancel [ref]`           | `/cancel [ref]`                       |
| talk or give feedback | bare text               | ordinary message                      |

Adapters may render these resources differently. Console uses aligned text and
tab completion. Telegram uses compact messages and may add native buttons.
The Host resolves Apps and Task references and revalidates canonical identity.

`/work` remains a temporary hidden diagnostic alias for the old May-request
projection. It is not another Task interface and is absent from ordinary help.
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

Provider delivery is observational. A failed or uncertain adapter send cannot
change a Conversation result or a Task.

## One focused watch

Each Console process or Telegram chat/topic may watch at most one Task. Watch
state belongs to the adapter surface; it is not a Task field and does not force
another surface to watch.

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
interprets the feedback and sends a typed Task-targeted event to the owning App.
The adapter never steers a temporary session and May never edits another App's
Task storage directly.

A semantic Task transition emits an identity-only wake. The adapter coalesces
updates, performs at most one read at a time, and renders the latest Task. A
terminal result ends the watch automatically. `/unwatch` changes only local
presentation.

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
- `/tasks` is a bounded indexed page ordered by semantic update time;
- `/apps` reads the loaded registry plus aggregate active counts;
- Task reference hashes are indexed at Task creation/import; and
- watch is push-to-read with one coalesced in-flight read.

Lease renewals, tool chunks, transcript text, queue movement, and delivery
events do not wake human Task watches. The hidden request-work projection is
computed only when explicitly requested. Slow adapters never block Task commit.

## Adapter responsibilities

An adapter may parse native commands, cache bounded completions, choose layout,
and keep one local watch. It must not own a work queue, infer a Task from the
latest session, make delivery part of Task state, poll for watch progress, or
send slash-command ambiguity to a model.

## Verification

Tests must prove stable collision-aware references, bounded indexed reads,
one-watch replacement, focused feedback through May, wake coalescing, automatic
terminal exit, durable Task cancellation, stale-attempt fencing, cross-surface
Conversation context, and independence from adapter delivery.
