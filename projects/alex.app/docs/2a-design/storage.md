# Runtime Storage

**Supports:** [Architecture](architecture.md). Preserves authoritative records and consistent changes needed for dependable continuation.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#one-authority-for-each-resource).

**Design status:** Accepted.
**Implementation status:** SQLite holds canonical work and admission state;
files hold full execution artifacts. Conversation execution uses the shared
Task claim and settlement lifecycle. Accepted outcomes, explicit closure and
caller correlation have separate retained records. Source status does not
establish the deployed artifact; see the [source review](../archive/reviews/design-doc-hygiene-20260927.md).

The [storage extraction review](../proposals/storage-state-service.md#candidate-review-and-landing-order)
retains the earlier boundary work. The
[one-lifecycle baseline](../archive/reviews/conversation-input-unification.md)
records the shared authority decision. Active-Turn reads use current Task
execution and exact successor links; historical inbox leases are not authority.

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
| Accepted conversational Requests | SQLite `conversation_requests`: scope, revision, exact Task links and closure; `conversation_request_inputs`: inputs associated by the agent | Not reconstructible from input completion; preserve accepted obligations and their input associations |
| Pending admission and ordered Task input | SQLite admission journal and Task-event links | Required to recover unaccepted input; an in-memory queue is only a hint |
| Event and causal links | SQLite identity, envelope and trace; large bodies in content-addressed files | Requires retained rows and referenced bodies; transcripts are not substitutes |
| Conversation messages, Topics and Task links | Durable message evidence and canonical SQLite Topic/correlation records | Read views derive from retained evidence; exact links are authoritative |
| Session | `meta.json`, `session.jsonl`, `result.json` | Bounded SQL lifecycle/index rows derive from retained artifacts |
| Workflow run | `workflow-runs/<id>/run.json` | Bounded SQL run projection derives from retained artifacts |
| Session digest/evaluation | Evaluation facts, `session.eval.jsonl` and referenced evidence | Summary queries are projections; rebuilding requires retained evidence |
| Metrics and alerts | SQLite definitions, samples and alert state | Definitions may be reloaded; historical samples cannot be recreated by remeasurement |
| Task lists, human-action views, event graphs and dashboards | Read projections of the authorities above | Disposable views; never restore Task state from presentation |

Event metadata uses a JSON envelope document within SQLite, independently of
indexed producer/subject correlation. Payload bodies and trace metadata keep
their existing storage. See [event durability](events.md#durability-and-retention)
for document authority, exact recovery and the limits of older records. Optional
envelope fields need no SQL migration; a new searchable index may still need one.
The same transaction writes event metadata and query columns. Event identity and
delivery/acceptance state remain runtime authority, distinct from search projections.

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
The historical conversion is recorded in the
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
[duplicate handling](execution-feedback.md#duplicate-delivery-and-safe-reconsideration).

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

SQLite permits one writer even when changes only append records. A competing
writer is a normal transient condition. First minimize time holding the writer
lock: prepare immutable payloads and file artifacts before the owning transaction
where possible, and keep current-state checks, fences and atomic SQL changes
inside it. An outer transaction may still own the lock; moving work before a
nested helper alone does not shorten that outer transaction. Measure acquisition
wait separately from lock-holding time before adding retries.

Reuse existing bounded contention handling at
the owning transaction's acquisition boundary; run the body once after obtaining
the lock. Callers use that one retry budget rather than wrapping the transaction
in another retry. Nested operations share that transaction through savepoints. A failure
inside the body rolls it back; failure delivering a committed result does not
authorize replaying the body. A single atomic append can retry the rejected
statement. Exhaustion remains observable. Existing admission-plan recovery covers
saved plans. Failure before a plan or inbox entry is saved requires a durable
Event admission obligation; a contention retry alone does not close that gap.

The serving path's total lock wait includes SQLite's busy handler and any outer
retry. It must yield after a short bounded turn. Before persistence, return a
retryable failure without acknowledging input; after persistence, leave the
original obligation for its existing recovery owner. A lost reply after commit
requires receipt/delivery recovery, never blind replay of the committed body.
Recovery batches yield between items; several short waits must not accumulate
into one long blocking callback. Startup and isolated workers may have different
budgets. The [October 16 source candidate and trial](../archive/reviews/host-contention-fix-20261016.md)
remove extra serving sleeps while preserving those separate budgets; review and
rollout remain outstanding. The [Host improvement plan](../proposals/host-contract-improvements-20261016.md)
tracks the other gaps.

[App admission recovery](events.md#recovering-app-admission) describes Host PR
#336's merged implementation: a pending marker and the existing recovery scan.
Installed adoption requires separate evidence. It introduces no new queue and
preserves only the old outstanding Conversation subset during migration, leaving
other historical Events untouched.

Keep acquisition waits and lock-holding work distinct. Shorten expensive work
inside writes, and diagnose slow reads separately: WAL readers need not hold
the writer slot, but synchronous reads can still stall the Host. The
[October 4 SQLite review](../archive/reviews/sqlite-contention-20261004.md)
records the live evidence, isolated regressions and candidate status.
The follow-up [SQL audit](../archive/reviews/sql-query-audit-20261004.md) records
query-by-query screening, measured rewrite candidates and remaining transaction
scope work. Audit the actual parameters, plan, read frequency, intermediate
payload size and enclosing transaction; a scan or output LIMIT alone is not a
performance verdict. Prefer matching existing indexes and selecting small
identities before loading full bodies over adding indexes or retries by default.
Partial-index predicates belong in the lookup SQL even when callers already
validate them; a bound parameter may not let SQLite prove the predicate.
Rank/filter bounded historical identities before joining their large bodies.
For retention, discover bounded candidate identities outside the write and
recheck eligibility on those exact identities while deleting. Preserve existing
reference-protection triggers. A concurrent update may postpone deletion to a
later pass; it must not lose a newly protected record.

Pure Event identity preparation can precede the Event writer's own acquisition.
Unkeyed Events need no idempotency hash. Artifact creation still follows the
atomic duplicate check, so retrieving an accepted receipt does not depend on
new filesystem work. Moving artifact preparation further out needs a separate
contract-preserving change; a smaller writer slot does not justify weakening
receipt replay or an outer transaction's atomicity.

Claimed request attachment commits Task input, request wait/claim release and
Topic correlation together. Settlement persists linked request readiness in
the same transaction; an event notification only accelerates discovery.
The shared-lifecycle PoC also checks the admission owner's current authority
inside that transaction: a failed lease renewal can revoke local ownership
before the stored lease expires. A replay of an already committed attachment
returns its exact outcome without authorizing new work. The
[ownership evidence](../archive/reviews/controller-poc-recovery-review.md#public-stop-and-admission-ownership)
records the fix and its limits.

Recovery may restore a missing input link from historical admission aliases
only when every bound authority and result field agrees. An admission timestamp
alone does not distinguish authority. Different Task generations, specifications,
input evidence, accepted answers or feedback remain ambiguous and unlinked.
Selecting an equivalent alias preserves the historical rows and never reopens
the work or manufactures an accepted answer.

Unsuccessful Task attempts retain input and use persisted backoff within their
retry policy. Automatic exhaustion retains the assignment and its evidence.
New input does not erase older waits or accepted results; an authorized owner
decides whether to retry, revise or close the Task.
Input-result projection uses exact accepted evidence and can recover separately
from execution. See [failure and retry](task-resource-engine.md#one-lifecycle-baseline).

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

### Request input associations

Requirement saves and final updates accept `inputIds` identifying the current
inputs that establish or refine an intention. May chooses those associations.
Single-input turns infer that sole input; mixed turns retain existing
associations or require explicit IDs. The Host verifies that the IDs belong to
the current claim and stores them in `conversation_request_inputs` atomically
with the Request update. Several inputs can share one Request, and one input
can establish distinct Requests. The links retain history without execution state.
The same requirement-save tool can associate a new input with an existing Request
without copying its scope. Omitted scope retains the saved requirements; a new
Request still requires its complete scope. Use the returned revision for settlement.

Current input links supply `assignedRequests` with full accepted scope and
revision, independent of the recent-Topic context window. Every assigned Request,
including one saved during execution, needs an explicit final `requestUpdates`
entry with its own nonblank reason, including for an open disposition. The result
schema checks the reason before the agent finishes; an unrelated reply cannot
stand in for it. Omission rejects the whole settlement; reply, Request changes,
handoff and input completion stay atomic. The agent owns semantic completeness; the Host
detects missing dispositions, not incorrect explanations. A turn admits at most
eight assigned Requests, matching the existing final-update bound.
Recognition and association must happen before work on an accepted intention;
the Host cannot enforce obligations the agent has not saved or associated.

New input defers a proposed result as `unacceptedResult` for reconsideration
against current requirements. No automatic replay, Request executor, sweep or
retry loop is added. Stopped input remains stopped. Schema creation preserves
historical Requests without inventing associations from message IDs or prose;
previously stranded obligations need an explicit current review. The matching
Host change must be installed before these fields and checks are available.

### Operations

Conversation, accepted Request and Topic data belong behind the Host's State
and storage boundary. Use a small set of typed local functions backed by the
existing SQLite connection. Apps and agents use SDK reads and return proposed
decisions; they do not receive the database or the Host-private state API.
Adapters use their existing read/control protocols. No new server, database,
resource controller, generic repository or per-write event protocol is required.

The accepted [one-lifecycle baseline](../archive/reviews/conversation-input-unification.md)
uses a Task claim as the single authority for Conversation execution. Ordered
input and caller correlation remain; an inbox row must not hold a second
independent execution claim. Fenced Task settlement composes typed conversation
operations so the input outcome, explanation and Request closure commit together.
This does not require one table or a generic CRUD/settlement API.
`core/state/conversation-task-turns.ts` composes the current operations; the
historical inbox claim fields are retained evidence, not live authority.

Task reads distinguish accepted outcomes, pending work and explicit closure.
A caller waits for its exact assignment's outcome, not resource closure; stored
input/generation/result references prevent an old result satisfying a new ask.
Owner closure prevents claims and stale settlement while preserving evidence and
visible non-success for unresolved work. It must not imply Request fulfillment.
Retained legacy receipts remain readable; they do not reinstate the retired
mode or inbox execution lifecycle.

Group the API by what the caller needs to accomplish:

| Operation | Required contract |
| --- | --- |
| Read Conversation | Return bounded messages, active Turn with its human/system origin, and related context; paging must use stable identities |
| Read/list accepted Requests | Scope by App/Conversation; page open asks and read an exact full scope, revision, links and closure |
| Find/read Topics | Return bounded context and exact Task references; Topic has no work status |
| Accept a Turn decision | Check the Conversation Task attempt fence; save the validated decision, Topic changes and accepted/refined Request versions together before handoff |
| Admit Task with conversation links | Commit Task admission and supplied Topic/Request links together, checking current authority and Request revision |
| Complete a Turn | Commit input result, completion and any Request closure with durable answer evidence; failure/Stop never implies fulfillment |
| Admit a linked Task review | Validate saved links and source; reuse identity for the same Task change and Conversation/Topic, distinguishing a newly linked or revised Request |
| Complete a system review | Use normal Turn completion, recording handled evidence and the observed Request revision; allow a quiet outcome without a message or closure |
| Find missed follow-up | Return a bounded, progressing page of unhandled linked outcomes/decisions; honor pending, handled, stopped and exhausted input dispositions |

These are operation families. `admitConversationTaskInput` attaches input to
its Task; `updateConversationTaskRequest` and `completeConversationTaskTurn`
fence updates through the current attempt. `listPendingConversationTaskChanges`
and `admitConversationTaskChange` recover linked outcomes through the same
input route. Completion commits Request updates, durable explanations and
handled-change evidence together. There is no separate supervision Task or
`recordConversationTaskOutcome` completion path.

Stop keeps its exact-turn meaning; `stopConversationTaskTurn` enforces it through the common
Task attempt/input fence instead of a separate inbox execution authority. Topic
creation and Request updates join their enclosing operation; callers must not sequence independent saves to
manufacture atomicity.
Task admission remains valid without conversation links. App mapping, model/tool
execution and judgment run outside short transactions; state rechecks their
authority and expected versions at commit.

Request reference storage accepts Task identities independently of Topic
membership or current Task availability. Schema, revision and owner checks
still apply; storage does not turn reference metadata into a work admission or
subscription. Handoff admission supplies its actual Task reference and return
links atomically. The semantic contract is in
[Message Lifecycle](message-lifecycle.md#requests-acceptance-and-closure).

Request closure requires a durable explanation with stable message identity.
In current source, a direct Turn's inbox result can supply that evidence and its
Conversation projection; a separately published message uses the same identity. This does
not require a new messages table or an independently successful adapter send.
Repeated accepted operations reuse existing identity/version checks. Retain one
writer for each fact, and never reconstruct accepted asks by guessing from chat.

Events admit human input and linked Task reviews through the shared-input
route. They also announce meaningful changes. After commit,
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

Conversation recovery filters out closed conversations and self-returns before
materializing attempt history. A saved ordinary input return selects its exact
result/report attempt; legacy Topic subscriptions retain their broader eligible
history. The same receipt, cancellation and generation rules still decide what
can be returned. This query-scope correction reduces repeated reads without a
new cursor, replay limit or copied completion state. The correction is merged
in Host #340, with closed-conversation regression coverage in #342. Deployment
and worst-case latency remain separate checks. See the
[query trial and source record](../archive/reviews/post337-evidence-cost-20261005.md).

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

Keep history-wide candidate searches outside write transactions. A deletion
limit bounds rows changed, not rows examined or time holding SQLite's writer
lock. Orphan cleanup should read a bounded set of candidate IDs first, then
delete those exact rows while rechecking that their owning events are still
absent. An empty candidate set needs no write. Retention protections remain
authoritative at deletion; discovery alone never authorizes removal. This is
Host maintenance mechanics and adds no App procedure or recovery controller.

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
