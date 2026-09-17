# Runtime Storage

**Design status:** Accepted.
**Implementation status:** SQLite holds canonical work and admission state;
files hold full execution artifacts. Bounded read projections coexist with
those authorities. The Conversation state API below consolidates existing
guarantees; #129 extracted their shared state operations. The focused source review used Host
`99bc1a31` on September 10, 2026.

The [inbox/Conversation implementation review](../proposals/storage-state-service.md#candidate-review-and-landing-order)
records the state/handler extraction, merged in #129 as `0bedd93a`, and its
actual code map. This updates the source boundary; deployment remains separate.
The [one-lifecycle baseline](../proposals/conversation-input-unification.md)
moves Conversation execution authority into Task claims and settlement. It needs
the changes identified below; they are not yet source guarantees.

## Decision

SQLite is authoritative for Tasks, attempts, accepted results, Conditions,
inbox items, accepted Requests, admission records, Events and Conversation
relationships. It also holds indexes and read projections. The database cannot be discarded and
rebuilt from transcripts. Backup and recovery must preserve both the database
and its referenced artifacts.

Files hold full prompts, transcripts, workflow inputs/results, large event
bodies and evaluation evidence. Keeping these payloads out of bounded resource
rows does not make the resource rows disposable.

Files are authoritative for full execution artifacts:

```text
.state/sessions/<id>/meta.json
.state/sessions/<id>/session.jsonl
.state/sessions/<id>/result.json
.state/sessions/<id>/session.eval.jsonl
.state/workflow-runs/<id>/run.json
.state/event-bodies/<sha256>.json
```

Session paths are immutable. A session remains under
`.state/sessions/<id>/` from creation through idle, terminal, and resumed
states. Lifecycle changes update `meta.json`, marker files, and the SQLite read
model; they never rename or relocate the session directory.

This is a storage invariant, not an optimization preference:

> A session ID owns exactly one filesystem path for its entire lifetime.

Moving completed sessions creates no retention value. It does not reclaim
space, and it introduces broken references, rename failure windows, collision
handling, and unnecessary resume logic.

SQLite resource rows retain the bounded state needed for correctness. Artifact
projections retain what a query needs without opening a file: identity, lifecycle status, ownership, timestamps,
lineage, counters, short previews, common correlation fields, and artifact
reference/hash/size metadata.

## Record Ownership

| Record | Authority and storage | Rebuildability |
| --- | --- | --- |
| Tasks, attempts, accepted results/receipts, Conditions and links | Canonical SQLite Task resource rows and fenced transactions | Not reconstructible from session artifacts; preserve the database |
| Host input handling and cross-App caller correlation | SQLite inbox rows, exact Task/dependency links and accepted results | Not disposable; preserve identity and accepted state |
| Accepted conversational Requests | SQLite `conversation_requests`: scope, revision, exact Task links and closure | Not reconstructible from input completion; preserve accepted obligations |
| Pending admission and ordered Task input | SQLite admission journal and Task-event links | Required to recover unaccepted input; an in-memory queue is only a hint |
| Event and causal links | SQLite identity, envelope and trace; large bodies in content-addressed files | Requires retained rows and referenced bodies; transcripts are not substitutes |
| Conversation messages, Topics and Task links | Durable message evidence and canonical SQLite Topic/correlation records | Read views derive from retained evidence; exact links are authoritative |
| Session | `meta.json`, `session.jsonl`, `result.json` | Bounded SQL lifecycle/index rows derive from retained artifacts |
| Workflow run | `workflow-runs/<id>/run.json` | Bounded SQL run projection derives from retained artifacts |
| Session digest/evaluation | Evaluation facts, `session.eval.jsonl` and referenced evidence | Summary queries are projections; rebuilding requires retained evidence |
| Metrics and alerts | SQLite definitions, samples and alert state | Definitions may be reloaded; historical samples cannot be recreated by remeasurement |
| Task lists, human-action views, event graphs and dashboards | Read projections of the authorities above | Disposable views; never restore Task state from presentation |

Host inbox rows track input handling. Separate `conversation_requests` implement the
[conversational Request contract](message-lifecycle.md#requests-acceptance-and-closure)
across turns. The Host fences updates by revision and commits closure with its
explanatory Conversation message in one transaction. The App judges whether
the accepted ask is fulfilled. Input completion is not fulfillment, and Request
storage does not copy Task progress or own execution.

The accepted [child-wait retirement](message-lifecycle.md#retained-state-compatibility)
uses the existing database-upgrade transaction. It marks only unfinished old
frontend waits as failed input handling and clears their scheduling/lease state,
fencing old claims. Original wait and session identities and saved decisions
remain evidence. Completed inputs, child inputs, Task state/results, Topic links
and accepted Requests remain intact; finishing an obsolete input never closes
an accepted ask. Reopening the upgraded database does not repeat the transition.
The source candidate is tracked in the
[simplification proposal](../proposals/authority-boundary-simplification.md#1-one-durable-delegation-path);
rollout remains separate.

Host #175, merged as `e38d2861`, retains compact per-Task event
identities in the existing Task-event links after pending input is claimed or
consumed. A link records receipt, not successful work or another work lifecycle.
Pending bodies remain in the Task trigger/attempt, and Events remain the fact
authority. Receipt lookup uses exact identity, not a scan of attempt history or
a highest-event-ID shortcut that could discard out-of-order input.

Receipt keys remain for the receiving Task's lifetime and are removed with that
Task. Event-detail pruning must not silently make an old receipt new input.
This adds one compact key per received durable event; it does not retain a
second copy of each event body. Version 3 rebuilds missing links once from
retained attempt batches, compatibility triggers, accepted live-input IDs and
pending input. Evidence already removed before this upgrade cannot be
reconstructed. Mixed old/new writers are unsupported: an older writer can
still delete receipt history. Rollback preserves Task results and pending input
but restores the earlier duplicate-wake risk. See
[duplicate handling](events.md#duplicate-delivery-and-safe-reconsideration).

Small Event bodies remain inline. Large bodies are written to the
content-addressed store before their event row commits; SQL retains a bounded
projection and the artifact reference.

Keep resource writes bounded. Retention limits row count and cannot compensate
for unbounded payloads. Historical storage incidents belong in review evidence,
not in the definition of authority.

## Write And Recovery Contract

Canonical Task transitions use a version- and attempt-fenced SQLite transaction
that commits accepted state and its related records atomically. Requests and
admission records have their own durable coordination boundaries; see
[Events](events.md) and [Task Resource Engine](task-resource-engine.md).

Claimed request attachment commits Task input, request wait/claim release and
Topic correlation together. Settlement persists linked request readiness in
the same transaction; an event notification only accelerates discovery.
The shared-lifecycle PoC also checks the admission owner's current authority
inside that transaction: a failed lease renewal can revoke local ownership
before the stored lease expires. A replay of an already committed attachment
returns its exact outcome without authorizing new work. The
[ownership evidence](../proposals/controller-poc-recovery-review.md#public-stop-and-admission-ownership)
records the fix and its limits.

The following retry-exhaustion rule describes the merged source baseline;
the continuing-Task proposal replaces that gate with backoff and explicit owner
closure, preserving unfinished input until it receives its exact answer.
Retained input is not necessarily runnable work: retry-exhausted attention
must ready linked requests for review without permitting another execution.
Ordinary attention with new eligible input must wait for a fresh result.
Request attachment and the retry-exhaustion readiness correction are merged
at the [source baseline](../README.md). The [storage proposal](../proposals/storage-state-service.md)
records their proof and considers further extraction.

For artifact-backed records, the file and its SQL projection use this order:

```text
serialize -> write temporary file -> atomic rename -> write SQL projection
```

If the file write fails, the SQL row is not committed. If SQL fails after the
rename, the file is a harmless orphan and a later reconciler may rebuild the
projection or garbage-collect it. A SQL row must never point at a file that was
not durably renamed first.

Content-addressed event bodies are immutable. Mutable session and workflow
records use atomic replace and publish the new hash/size in the SQL projection.
Readers verify a hash when correctness depends on exact content; a mismatch is
reported as storage corruption rather than silently using different content.

## Query Contract

Do not parse full bodies or use `task LIKE` as an identity mechanism. Producers
persist frequently queried event dimensions explicitly:

```text
session_id, workflow_run_id, project_id, task_id, attempt_id,
handler, metric_id, alert_id, escalation_id, subject_status, duration_ms
```

Queries use typed columns. Full-content inspection resolves the artifact
reference.

## Conversation state API

Conversation, accepted Request and Topic data belong behind the Host's State
and storage boundary. Use a small set of typed local functions backed by the
existing SQLite connection. Apps and agents use SDK reads and return proposed
decisions; they do not receive the database or the Host-private state API.
Adapters use their existing read/control protocols. No new server, database,
resource controller, generic repository or per-write event protocol is required.

The accepted [one-lifecycle baseline](../proposals/conversation-input-unification.md)
uses a Task claim as the single authority for Conversation execution. Ordered
input and caller correlation remain; an inbox row must not hold a second
independent execution claim. Fenced Task settlement composes typed conversation
operations so the input outcome, explanation and Request closure commit together.
This does not require one table or a generic CRUD/settlement API. The current
inbox-claim operations below describe the source that must migrate.

Task reads will distinguish accepted outcomes, pending work and explicit closure.
A caller waits for its exact assignment's outcome, not resource closure; stored
input/generation/result references prevent an old result satisfying a new ask.
Owner closure prevents claims and stale settlement while preserving evidence and
visible non-success for unresolved work. It must not imply Request fulfillment.
These storage changes are pending; current receipts and mode semantics remain
readable until the coordinated migration.

Group the API by what the caller needs to accomplish:

| Operation | Required contract |
| --- | --- |
| Read Conversation | Return bounded messages, active Turn with its human/system origin, and related context; paging must use stable identities |
| Read/list accepted Requests | Scope by App/Conversation; page open asks and read an exact full scope, revision, links and closure |
| Find/read Topics | Return bounded context and exact Task references; Topic has no work status |
| Accept a Turn decision | Check the current inbox claim (target: the conversation Task attempt fence); save the validated decision, Topic changes and accepted/refined Request versions together before handoff |
| Admit Task with conversation links | Commit Task admission and supplied Topic/Request links together, checking current authority and Request revision |
| Complete a Turn | Commit input result, completion and any Request closure with durable answer evidence; failure/Stop never implies fulfillment |
| Admit a linked Task review (pending) | Validate saved links and source; reuse identity for the same Task change and Conversation/Topic, distinguishing a newly linked or revised Request |
| Complete a system review (pending) | Use normal Turn completion, recording handled evidence and the observed Request revision; allow a quiet outcome without a message or closure |
| Find missed follow-up (pending) | Return a bounded, progressing page of unhandled linked outcomes/decisions; honor pending, handled, stopped and exhausted input dispositions |

These are operation families, not new exported signatures. The pending review
operations extend the existing inbox and result evidence, not a new queue or
subscription table. The current `recordConversationTaskOutcome` operation
still commits the supervision Task's explanation and Request updates together;
its exclusive projection path retires only when the unified consumer replaces
it. Retain any shared transaction helpers used by ordinary completion.

Stop keeps its exact-turn meaning; the target enforces it through the common
Task attempt/input fence instead of a separate inbox execution authority. Topic
creation and Request updates join their enclosing operation; callers must not sequence independent saves to
manufacture atomicity.
Task admission remains valid without conversation links. App mapping, model/tool
execution and judgment run outside short transactions; state rechecks their
authority and expected versions at commit.

Request closure requires a durable explanation with stable message identity.
In current source, a direct Turn's inbox result can supply that evidence and its
Conversation projection; a separately published message uses the same identity. This does
not require a new messages table or an independently successful adapter send.
Repeated accepted operations reuse existing identity/version checks. Retain one
writer for each fact, and never reconstruct accepted asks by guessing from chat.

Events admit human input and, under the pending shared-input route, linked
Task reviews. They also announce meaningful changes. After commit,
`conversation.updated` tells readers to reread state. Losing a presentation hint
must not lose the result. A wake that creates work must retain its existing
durable admission/recovery guarantee; it is not merely a best-effort UI callback.

A review's durable result must identify which linked change and Request
revision it considered, even when the decision was quiet. Reuse retained input
and result evidence before adding fields; add only the minimal indexed
reference required by the pending-work query. Do not mirror Task status.
Retention must preserve enough handled/stopped evidence to avoid replaying an
old outcome after pruning. An event notification or wall-clock age alone is
not proof that follow-up succeeded or that a fresh model call is needed.

Keep page sizes and payloads bounded and inspect query plans for common reads.
A response limit alone does not prove bounded query cost. Reuse current evidence
and projections; do not copy Task status into Requests or introduce a second chat
history. [Architecture](architecture.md#conversation-core-and-capability-boundary)
owns placement; the [storage proposal](../proposals/storage-state-service.md#conversation-state-and-handler-extraction)
records the current helpers, extraction order and proof required.

## Retention And Maintenance

Retention is bounded work owned by the runtime maintenance boundary, not by an
agent or a metrics handler:

- delete a fixed-size batch and stop;
- never loop until a table is empty in a live request;
- never run full `VACUUM` in May's event loop;
- use passive WAL checkpoints during normal operation;
- run disruptive compaction only as an explicit offline operator action;
- delete an artifact only after no retained metadata row or domain record
  references it.

Database size is an observability signal, not a trigger for synchronous full
rewrites. With bounded rows, old rows can age out naturally and incremental
reclaim can remain opportunistic.

## Canonical Layout

Current writes use one schema and one session layout. Explicit bounded read or
migration adapters may interpret retained historical rows, but compatibility
never becomes a second writer, path, or mutable authority. Missing references
in current state are integrity errors, not an alternate storage mode.

## Agent Boundary

Storage is Host context outside agent generation. The agent uses its
normal generate and tool APIs; it does not call a private infra-context API.
Infra resolves artifacts and prepares context before `agent.run`, then persists
results and emits events after the run. This keeps every agent usable without
the autonomous event/task/metric runtime.
