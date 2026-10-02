# Task-Focused Shared Human Interface

**Historical context:** [Human Control Surfaces](../../2a-design/human-control-surfaces.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Accepted and implemented; archived decision record

**Scope:** May Console, Telegram, future Conversation adapters, Task references,
focused interaction, cancellation, and read-path performance

**Aligned with:** [System Model](../../2a-design/system-model.md),
[Human Control Surfaces](../../2a-design/human-control-surfaces.md), and
[Lightweight Event-Driven Reconciliation](lightweight-event-driven-reconciliation.md)

## Proposed decision

Make Tasks the ordinary human work surface. Keep requests as small Host-owned
caller correlation, and keep sessions as replaceable execution evidence.

```text
human conversation
  -> Host request correlation
  -> App Task
  -> zero or more bounded attempts/sessions
  -> accepted result or explicit cancellation
```

The interface should normally expose only the stable pieces:

- Apps own responsibilities;
- Tasks are the work Apps reconcile;
- May owns natural human conversation; and
- adapters present the same resources in channel-appropriate ways.

Requests remain necessary when a caller is owed a result, but they are not the
primary object a human manages. Sessions are not ordinary control targets.
They may fail, restart, or be replaced without changing the Task.

This proposal changes the accepted `/work` and session-control experience. It
does not change the underlying request-correlation requirement or make watch
state another work lifecycle.

## Small command surface

The normal command vocabulary is:

| Command                 | Meaning                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `/apps`                 | List installed Apps with bounded active Task counts        |
| `/apps <app>`           | Show one App and its current Task summary                  |
| `/tasks`                | List active Tasks across Apps                              |
| `/tasks <app>`          | List active Tasks for one App                              |
| `/tasks all`            | Include bounded completed history                          |
| `/tasks <app> all`      | Include bounded completed history for one App              |
| `/task <ref>`           | Read one exact Task                                        |
| `/watch <ref>`          | Watch and focus one Task, replacing any previous watch     |
| `/watch`                | Show the currently watched Task, if any                    |
| `/unwatch`              | Leave the current watch; it never changes the Task         |
| `/cancel [ref]`         | Request cancellation of the named or currently watched Task |
| `/help`                 | Show this ordinary command set                             |

Pagination and status filters may be adapter controls rather than more
top-level commands. Console can accept explicit options such as
`--status attention`; Telegram can use buttons. Both produce the same typed
query.

Do not add `/progress`, `/result`, or `/history`: `/task` and `/tasks all`
already answer those questions. Do not expose `/session`, `/sessions`, or
`/steer` in normal help. Low-level session inspection may remain behind an
explicit diagnostic mode, but it is not part of the shared human contract.

## Stable Task references

A short reference is a presentation alias, never the Task's authoritative ID.
The canonical identity remains the pair `{ appId, taskId }`.

```text
8f12ac90
```

No `t:` prefix is needed because every ordinary command that accepts this
value targets a Task. Eight hexadecimal characters represent 32 bits, not
eight bits, so collision handling is mandatory.

The Host derives the full SHA-256 from a versioned, length-safe encoding of:

```text
task-reference-v1 + appId + taskId
```

Resolution rules are deterministic:

1. Show eight hex characters when that prefix identifies one retained Task.
2. Show sixteen for every Task sharing the same eight-character prefix.
3. Accept an exact canonical Task identity as a diagnostic fallback.
4. Reject ambiguous prefixes and return the candidate Apps/outcomes.
5. If sixteen characters ever collide, require more characters up to the full
   digest; never guess or use list order.
6. Keep canonical identity in Conversation metadata and control requests. A
   displayed short reference may be recomputed and is not durable authority.

The reference index covers live Tasks and retained completion/cancellation
receipts. A Task remains addressable after it leaves the active list. Reusing
the same canonical App/Task identity intentionally resolves to that same Task
lineage; generation and resource version remain separate concurrency fences.

## One focused watch

Each adapter surface may watch at most one Task:

```text
/watch 8f12ac90
you[task 8f12ac90]> please keep the compatibility alias for one release
```

For Console, the surface is one Console process. For Telegram, it is one
allowed chat/topic. Starting another watch replaces the old one. Watch state
is adapter presentation state, not Conversation state and not a Task field;
one surface does not force another surface to start watching.

While watched, bare text from that surface remains a normal durable human
Conversation message handled by May, but the adapter attaches the exact
canonical Task target under `context.focusedTask`; the event target remains
the May App. May therefore interprets natural feedback with an unambiguous
resource identity and emits a typed, targeted feedback event to the owning
App/Task. The owning App decides whether that information revises intent,
wakes another pass, interrupts replaceable execution, or has no effect. The
adapter never sends prose directly to a temporary session and May never edits
another App's Task state directly.

The focused prompt must remain visibly different. `/unwatch` returns to normal
Conversation mode without mutating work. A terminal Task shows its final
result and automatically ends the watch. `waiting` and `attention` do not end
the watch because those are the states in which human feedback is most useful.

The initial snapshot shown by `/watch` and the terminal snapshot may be
recorded as command-authored Conversation context after successful
presentation. Intermediate progress is transient and never enlarges May's
durable context.

## Why humans do not steer sessions

A session is one attempt to advance a Task. Direct session steering creates
the wrong durable relationship:

```text
Task A -> session 1 fails -> session 2 replaces it
```

Feedback addressed to session 1 becomes stale; feedback addressed to Task A
remains valid. Task-focused feedback also lets the App decide whether to
interrupt the current attempt, apply the feedback at its next safe boundary,
or revise the desired outcome. Session processes and transcripts remain
available as evidence linked from diagnostic Task detail.

The normal interface therefore has no `/steer`. A diagnostic operator may
still inspect or interrupt a broken process, but that is a runtime recovery
operation, not ordinary collaboration with an App.

## Cancellation

`/cancel` targets a Task, never merely its current session:

```text
/cancel 8f12ac90  # normal mode
/cancel           # focused mode; targets the watched Task
```

Cancellation is a durable desired-state change:

1. persist the exact cancellation request and human authority;
2. prevent another ordinary attempt from starting;
3. revoke or interrupt the current attempt, if any;
4. run bounded App-declared cleanup only when required; and
5. retain a cancellation receipt distinct from accepted achievement.

Killing a session without changing the Task is not cancellation because the
reconciler would correctly start another attempt. `/unwatch` is never an
alias for cancellation.

An App may refuse generic cancellation for a shared or maintain Task whose
responsibility must continue. Its Task view should expose whether cancellation
is allowed and, when it is not, name the appropriate App-specific pause or
close action. Cancellation must never be reported as satisfying the Task's
acceptance criteria.

## Deterministic adapter and Host boundary

Slash commands are a typed resource interface, not an LLM intent language:

```text
adapter input
  -> shared grammar
  -> adapter completion or native selection
  -> canonical App/Task resolution
  -> typed Host read/control
  -> adapter-specific rendering
```

Code resolves command names, App identities, short references, filters,
pagination, and cancellation targets. An unknown or ambiguous slash command
returns local choices; it is not handed to May for guessing. Ordinary prose
still goes to May. Semantic feedback within a focused watch goes to May with
the exact Task already attached.

Console should use tab completion from bounded cached App and Task summaries,
then send canonical identities. Telegram should register native top-level
commands and use buttons for Apps, Tasks, pagination, watch, and confirmation.
The Host revalidates every canonical target because adapter caches can be
stale.

One shared command/query service owns parsing-independent semantics:

- list/get installed Apps;
- list/get Tasks;
- resolve Task references;
- start/replace/clear an adapter-local watch; and
- request typed Task cancellation.

Console may call it through the control socket. In-process Telegram may call
the same service directly; it must not maintain a second database-specific
interpretation. Renderers remain separate because aligned terminal rows,
Telegram cards, and future Web controls have different presentation needs.

## Conversation integration

Explicit `/apps`, `/tasks`, and `/task` views that may shape the next human
turn are appended only after successful presentation as command-authored
Conversation messages. Their bounded metadata contains ordered canonical
resource references, not list positions or only short hashes.

This preserves natural follow-ups such as “the waiting one” across Console and
Telegram. A numeric row may be shown for scanning, but it is never accepted as
Task identity. Watch progress, completion animations, reconnect notices, and
typing indicators are transient.

## Performance design

This interface should make normal operation cheaper than the current design.
It removes session event streaming from ordinary use and replaces repeated
Conversation-work projections with bounded Task resource reads. It will slow
the system only if implemented with polling, history scans, or synchronous
adapter delivery; those implementations are prohibited.

### Reads

- `/task <ref>` performs one indexed reference lookup and one resource/receipt
  read. It never scans Task JSON or Conversation history.
- `/tasks` uses phase/update indexes, a bounded first page, and an opaque
  cursor. `/tasks all` is still paged; it is never an unbounded history read.
- `/apps` reads the in-memory installed-App registry and bounded aggregate Task
  counts. It does not load every Task body.
- Reference hashes are computed once when a canonical Task identity first
  appears. An indexed derived mapping resolves eight/sixteen/full prefixes in
  logarithmic time and survives live-to-receipt transition.
- Collision detection for one page is batched. It must not issue one
  history-sized query per displayed Task.

The current resource store already has indexed App/phase/update fields. A
global active-Task view should add an index beginning with phase/update rather
than fan out through every App or scan all rows. Completed history needs a
bounded completion-time index and cursor.

### Watch

Watch is push-to-read, never polling:

```text
accepted semantic Task change
  -> coalescible app.task.updated(appId, taskId, resourceVersion)
  -> watched adapter marks the Task dirty
  -> one bounded Task read
  -> render the latest version
```

The wake contains identity/version, not the Task body. Lease renewal, tool
tokens, session transcript chunks, queue movement, and adapter delivery do not
emit human Task updates. If several changes arrive while one read is in
flight, the adapter performs at most one additional read. Console may coalesce
brief bursts; Telegram should edit one status message and throttle provider
updates. A slow or disconnected adapter never blocks Task commit or another
adapter.

One watch per surface bounds memory, subscriptions, and network fan-out. An
idle watch owns no timer, model turn, workflow, or session and should consume
effectively no CPU.

### Interaction

Starting a watch, reading it, or receiving a resource refresh never invokes an
LLM. Only a human's natural feedback invokes May, exactly as an ordinary
Conversation turn does. Attaching the canonical Task target makes that turn
cheaper and more reliable than asking May to infer a target from a numbered
list.

Initial performance budgets, excluding model/provider and Telegram network
latency, are:

| Operation                                      | Budget        |
| ---------------------------------------------- | ------------: |
| Indexed `/task` read                           | p95 < 50 ms   |
| Bounded `/tasks` or `/apps` first page         | p95 < 100 ms  |
| Task commit overhead for publishing a wake     | p95 < 5 ms    |
| Accepted update to local Console refresh       | p95 < 250 ms  |
| Idle watch CPU                                 | no polling; approximately zero |
| In-flight reads per watched surface            | at most one   |

These budgets extend the lightweight reconciliation contract; they must be
measured separately from model time.

The implementation adds the global phase/update and completion indexes, exact
reference index, and bounded pages. A deterministic in-memory benchmark over
10,000 active plus 10,000 completed Tasks measured:

| Read                         | observed p95 |
| ---------------------------- | -----------: |
| exact `/task`                |      0.16 ms |
| active `/tasks` first page   |     14.04 ms |
| `/tasks all` first page      |     20.63 ms |
| `/apps` aggregate            |      9.04 ms |

Run `bun scripts/benchmark-human-task-interface.ts` from the Runtime
repository to repeat the non-model check. Production load evidence should
still be sampled after deployment; the synthetic result proves algorithmic
shape, not provider or disk contention.

## Failure and restart behavior

- Reordering, pagination, or completion never changes a short reference's
  target.
- An ambiguous reference fails with candidates and performs no control.
- A missed wake is harmless: the next wake or explicit read returns current
  Task truth.
- Console reconnect retains its one in-process watch and re-reads the Task.
- Telegram may retain one watch preference per chat/topic, but correctness
  never depends on restoring it.
- If a watched Task is no longer live, its receipt supplies the terminal view
  and the adapter exits watch.
- Failed presentation does not append a Conversation command view.
- Failed or uncertain Telegram delivery never changes Task state.

## Implemented shape

The platform now exposes the shared indexed resource service and both adapters
use it. The implementation includes:

1. a bounded Task view with App identity, semantic update time,
   cancellability, terminal disposition, current dependency, and optional
   diagnostic execution link;
2. installed-App list/detail and bounded cross-App Task list reads;
3. an indexed derived Task-reference mapping and resolver;
4. one wake-only `app.task.updated` resource update after accepted
   semantic changes;
5. control subscriptions to one exact Task per surface;
6. a shared command/query service and Console completion;
7. separate Console and Telegram renderers over the same resource views;
8. durable focused-feedback targeting and typed Task cancellation; and
9. `/work` temporarily retained as a hidden alias for the existing request
   view, exposed accurately as `/requests` during migration.

Do not map `/work` directly to `/tasks`: current `/work` rows are Host requests,
not Task resources. After the Task interface proves sufficient for ordinary
use, `/requests` can remain diagnostic and `/work` can be removed.

If accepted, align `system-model.md`, `human-control-surfaces.md`,
`message-lifecycle.md`, `may-console.md`, `telegram-notifications.md`, and the
user guide before production activation. Archive the older presentation
prototype after its useful rendering findings are incorporated.

## Verification contract

Focused tests must prove:

1. list reorder and pagination cannot retarget a Task reference;
2. an eight-character collision expands to sixteen and an ambiguous input is
   rejected without side effects;
3. a completed Task remains readable through its original reference;
4. Console completion and Telegram selection resolve to the same canonical
   App/Task identity;
5. ordinary text outside watch remains an unscoped May Conversation turn;
6. text inside watch is a May Conversation turn with the exact Task target;
7. replacing or leaving a watch never mutates either Task;
8. only terminal completion/cancellation automatically leaves watch;
9. cancellation stops future claims, interrupts the current attempt, and is
   not recorded as accepted achievement;
10. watch updates coalesce to one in-flight read and never stream session/tool
    output;
11. slow or failed adapters cannot delay Task commit or semantic completion;
12. explicit semantic views enter Conversation only after presentation, while
    intermediate watch output remains transient; and
13. bounded App/Task reads meet the non-model budgets under active background
    reconciliation.
