# Lightweight Event-Driven Reconciliation

**Status:** Accepted; migration in progress

**Scope:** the smallest useful May-agent core, immediate event coordination,
human response latency, recovery, and migration from the current Host

## Decision

Build the system around one plain loop:

```text
event arrives
  -> persist the event
  -> link and wake each exact interested task
  -> run one bounded App reconciliation
  -> persist what changed
  -> release execution resources
```

May is a small App that understands human intent and reconciles human-facing
tasks. The Host supplies a durable EventHub, compact task state, a small ready
set, bounded execution, and recovery. Apps supply meaning.

The governing cost rule is:

> Handling one event should cost roughly the size of the event and the exact
> tasks it changes, never the size of the App history, Conversation history,
> task tree, event log, or whole system.

Rich features remain possible, but they either run only when an App asks for
them or observe core events asynchronously. They do not enlarge every prompt,
gate task completion, or keep the idle Host busy.

## Start from the smallest system

The minimum useful system has six parts:

| Part       | Only job                                                                          |
| ---------- | --------------------------------------------------------------------------------- |
| EventHub   | Persist an event, give it an identity, and notify declared routes                 |
| Task store | Keep the current desired and observed state of each task                          |
| Dispatcher | Hold a deduplicated in-memory set of ready task IDs                               |
| Executor   | Run one fenced, bounded attempt and then release it                               |
| Apps       | Decide what an event means and what a task should do next                         |
| Adapters   | Turn Console, Telegram, HTTP, and provider input into events and render resources |

There is no durable queue service, App daemon, task-tree scheduler, delivery
gate, semantic adapter router, or mandatory evaluation loop.

Only four ideas are needed to explain ordinary behavior:

- an **event** says something happened;
- a **task** says what an App is responsible for making true;
- an **App** decides the next step; and
- the **Host** persists, wakes, runs, and recovers without deciding meaning.

A caller that is owed a later answer also gets a small request correlation
record. It links the incoming event, requested App work, and result; it is not
a worker or another work lifecycle. An attempt is only the temporary fenced
execution of one task.

## Core rules

### Events and executions are decoupled

External events are accepted immediately while other work runs. Different
tasks may reconcile in parallel. The same task has at most one active attempt.

An event may have zero or more explicitly declared consumers. Each matching
route links at most one exact task; routing never scans task prose or asks every
App whether it is interested. A valid fact with no consumer remains a recorded
fact and creates no work.

An event for a running task is durably linked to that task and marks it changed.
It does not start a second attempt for the same task and does not silently
invalidate the current attempt. When that attempt ends, one fresh pass sees all
new input. Explicit cancellation is an event that revokes the attempt.

The producer never waits for downstream consumers. Once an event is durably
accepted, its consumers proceed independently.

### An App may emit events before it finishes

An execution often needs to break down or coordinate work. Its events must not
be held until its final task result is accepted.

```text
parent attempt
  -> emit child request or coordination fact
  -> EventHub durably accepts it
  -> event becomes visible immediately
  -> child may run in parallel
  -> parent either continues briefly or records a wait and releases capacity
  -> child result event wakes the parent
```

Every `emit` is its own small commit point:

1. verify that the source attempt still owns its task;
2. deduplicate by a stable emission key;
3. append the event with source task, generation, attempt, and causal identity;
4. persist any explicitly targeted task wake; and
5. only then make the event visible to in-process subscribers.

The call returns the durable event identity. If the attempt crashes afterward,
the event remains valid; there is no distributed rollback. A retry with the
same emission key does not publish it twice. An emit from an expired, replaced,
or cancelled attempt is rejected.

Generic emission is for facts and exact task coordination, not an implicit RPC
protocol. When another App owes this task a result, the handler returns a typed
dependency. The Host gives that App request a deterministic identity, keeps
the existing request row as the one correlation authority, and records the
parent's exact Condition. If the result arrives before the wait commit, the
post-commit replay sees the already-persisted result and wakes the parent. A
second return-link table would duplicate the request authority and is not
added.

An emitted diagnostic fact is simply persisted and published. The source
task's input checkpoint advances only when its final result is accepted;
emitting an event does not pretend the source task has finished observing its
own inputs. Direct `app.input.requested` emission from task-owned workflows is
rejected; use the typed dependency result instead.

Apps should normally release expensive execution after delegating durable
work:

```text
emit work -> record wait -> return
```

Continuing briefly after an emit is valid when it enables useful independent
work. Keeping an agent process open only to wait for another task is not.

### One task is serialized and fenced

The task is the durable loop; attempts are disposable. A task contains only
the current information needed to decide whether it is ready and what should
happen next:

```text
identity and App
desired outcome and acceptance
state and version
unobserved event position
active attempt lease, when running
wait target or next check time, when waiting
compact result and evidence links
```

Each accepted attempt result checks the active attempt and task generation.
Stale results cannot overwrite newer state. Events that arrived during the
attempt remain pending and cause one later pass.

Task mutation is resource-local. It reads and writes one task plus exact event,
wait, dependency, request, and receipt rows needed by that transition. It never
parses or serializes a whole App task graph.

### Reconciliation is bounded

One reconciliation may:

- answer or converge;
- emit facts or child requests;
- update task intent;
- record an exact wait or next check time; or
- leave visible attention when safe progress is impossible.

Then it releases its lease, model stream, subprocess, tool clients, timers, and
attempt-local memory. A workflow is a synchronous bounded procedure inside
that attempt. An agent session is execution evidence, not another task loop.

### Recovery is insurance, not ordinary scheduling

Events are the normal trigger. Recovery queries only indexed task fields:

```text
state
changed
leaseUntil
nextCheckAt
```

The Host performs:

- one immediate bounded startup query;
- one timer for the nearest `nextCheckAt`;
- indexed repair of expired leases; and
- a paged 30-60 second safety query for ready, changed, due, or expired tasks.

The safety query does not reconcile every task and does not deserialize whole
App state. Repeated failure backs off. An operator may request a deeper audit,
but that audit is not a standing loop.

Pre-task App admission follows the same shape. The event fast path queues a new
frozen admission immediately. Restart and reload recover one bounded batch;
the background safety pass reads at most 16 due plans once per minute through
the existing `(status, updated_at)` index. Failed plans remain durable evidence,
but a permanently invalid route cannot create a five-second retry storm.

### The ready set is intentionally small

The Dispatcher is not durable authority. It contains task IDs and can be
rebuilt from task state after restart. It exists only for:

- concurrency control;
- human-first scheduling;
- per-task serialization;
- duplicate-wake coalescing;
- event-storm protection; and
- graceful shutdown.

Two FIFO lanes are enough initially:

```text
human
normal
```

Human work drains first and has reserved Host capacity. Normal work cannot
occupy every slot. App priority may order entries within the normal lane only
if real workloads prove that useful; it cannot override trusted human origin.

### Human input is the foreground path

Every ordinary human message goes to May. Console and Telegram may implement
explicit commands, but adapters do not inspect prose, match skills, or select
an App.

```text
human message
  -> append Conversation message and event
  -> create or wake May task in the human lane
  -> May reads bounded Conversation context and understands intent
  -> answer now, or emit/steer durable App work and explain what started
  -> append the useful result to Conversation
  -> adapters independently render the Conversation update
```

Turns in one Conversation are serialized. Different Conversations and
unrelated tasks may proceed independently. Adapter delivery attempts never
change whether May's semantic result is complete.

## Responsibility boundaries

### Apps

An App owns only meaning:

- map admitted input to a stable task;
- decide what current events mean;
- run the next bounded piece of work;
- emit coordination events when useful;
- decide whether the outcome is satisfied, waiting, or needs attention; and
- return useful summary, response, and evidence.

May adds human intent understanding and bounded Conversation context. It owns
no queue, retry daemon, persistence format, delivery receipt, session cleanup,
task scan, or transport-specific behavior.

### Host

The Host owns mechanics:

- EventHub persistence and declared routing;
- compact request and task records;
- the human/normal ready set and capacity;
- attempt fencing and bounded execution;
- exact waits, due times, and restart recovery; and
- resource reads and adapter notifications.

It never interprets task prose, infers skills from generated instructions, or
chooses a domain outcome.

### Optional capabilities and observers

Workflows, agents, tools, and skills are lazy capabilities used by the current
attempt. Metrics, traces, evaluations, digests, projections, and notification
delivery are asynchronous observers of accepted events and resource changes.

An optional feature may fail without changing an accepted task result. It may
publish a new fact that wakes work, but it cannot secretly reopen work by
mutating core state.

## Mechanism audit

Every retained mechanism must solve a current failure more cheaply than the
core itself can. The desired disposition is:

| Current mechanism                     | Failure it addresses                   | Decision                                                                             |
| ------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| EventBus and public event interface   | durable input and change notification  | **Keep, simplify:** one persistence-first EventHub; no second event lifecycle        |
| Admission plans and commands          | recover partial routing work           | **Replace:** event plus exact task/request links are the durable acceptance record   |
| Inbox/request correlation             | remember which caller is owed a result | **Keep small:** create only for addressed calls; never execute policy there          |
| Whole-App task JSON                   | task authority and restart recovery    | **Replace:** indexed resource-local task rows                                        |
| Task controller                       | serialize and run ready tasks          | **Simplify:** one Host dispatcher with task IDs, two lanes, and per-task fencing     |
| Conditions                            | wait for an exact observable change    | **Simplify:** task `waitFor` links and `nextCheckAt`, not a second state machine     |
| Task tree and projections             | human review and aggregate display     | **Move off-path:** rebuild asynchronously or on read; never schedule from it         |
| Attempts and sessions                 | fence execution and retain evidence    | **Keep bounded:** one small active attempt; archive transcript detail asynchronously |
| Periodic resync and completion refill | recover lost in-memory wakes           | **Replace:** indexed startup/due/expired queries and a bounded safety query          |
| P0-P3 scheduling and capacity         | urgency and overload control           | **Simplify:** trusted human/normal lanes, reserved human capacity, FIFO by default   |
| Workflows and skills                  | reusable execution knowledge           | **Keep lazy:** load or expose only when the App chooses them                         |
| Metrics and traces                    | observation and diagnosis              | **Move off-path:** cheap causal IDs/counters inline; aggregation is a subscriber     |
| Evaluations, Gym, and session digests | quality and learning                   | **Move off-path:** explicit or sampled event consumers under normal capacity         |
| Delivery receipts                     | adapter retry diagnosis                | **Keep adapter-local if needed:** never gate Conversation or task completion         |
| Conversation projection               | shared human context across adapters   | **Keep bounded:** append messages, notify adapters, read by byte budget              |
| Broad retention and cleanup           | storage capacity                       | **Defer safely:** first remove history from hot-path cost, then archive in pages     |

The default answer for a new feature is neither “put it in the core” nor
“create another worker.” It is: consume an event, perform one bounded action,
persist the owned resource, and stop.

## Confirmed current overhead

The current May App is already small; the platform path around it is not.
Observed evidence includes:

- a bare `help` turn waited about 13.4 seconds for capacity because task
  controllers never acquire the existing foreground lane;
- task claim and session preparation added about 3.6 seconds before inference;
- the simple turn produced roughly 40.8 KB of prompt because bounded human
  context is combined with a large generic owner protocol;
- generated protocol text can trigger May's regex skill rules even when the
  human did not express that intent;
- one task transition rewrites whole-App state blobs measured around 4.7 MB to
  20.3 MB across current Apps;
- controllers scan at fixed intervals and refill runnable work after
  completion; and
- retained events, traces, sessions, digests, and admission records are large
  enough that any history-proportional hot-path read is unsafe.

Database cleanup is not the first repair. Current behavior must become
resource-local before retention policy changes historical evidence.

## Performance contract

Provider/model thinking time is measured separately. The initial Host targets
are:

| Stage                                                          |         Target |
| -------------------------------------------------------------- | -------------: |
| Event acceptance through durable task wake                     |    p95 < 50 ms |
| Human-lane capacity wait under normal saturation               |   p95 < 100 ms |
| Task claim through provider request start                      |   p95 < 250 ms |
| Accepted result through Conversation append                    |   p95 < 100 ms |
| Immediate `emit` durable acceptance                            |    p95 < 50 ms |
| Generated reconciliation instructions                          |        <= 4 KB |
| Default dynamic May context                                    |       <= 12 KB |
| Idle Host CPU with no due work                                 | < 1% sustained |
| Idle Host RSS, excluding active child processes and file cache |       < 200 MB |

Structural tests matter more than one favorable benchmark:

- background saturation cannot consume reserved human capacity;
- the same task never has two attempts;
- different tasks can react in parallel;
- an event emitted mid-attempt is visible before the attempt finishes;
- retrying the same emission key creates no duplicate event or child request;
- a child may finish before its parent returns without losing the parent wake;
- an event arriving during an attempt produces one later pass;
- restart recovers a lost ready-set entry from indexed state;
- no foreground mutation reads or writes a whole-App blob; and
- optional observers and adapter delivery cannot delay semantic completion.

## Migration plan

The migration keeps one authority at each stage and deletes replaced paths.

### Implementation checkpoint (2026-08-21)

The Host now has the migration bridge rather than a second permanent runtime:

- trusted human and normal lanes share bounded Host capacity, with foreground
  capacity reserved for human work;
- reconciliation timing separates ready wait, claim, context construction,
  provider start/runtime, result persistence, total time, and prompt bytes;
- the owner protocol is below 4 KB and dynamic Conversation context is bounded
  to 12 KB;
- task rows, attempts, event links, Conditions, receipts, groups, admissions,
  leases, readiness, and due times can live in the EventHub SQLite database;
- mutations use task generation/resource/attempt fences and no longer require a
  whole-App write after cutover;
- task-owned workflows receive an execution-scoped `events.emit` capability;
  actionable emits require a stable `localKey`, persist before visibility, and
  deduplicate retries;
- one indexed startup/safety query and nearest-due timer replace periodic
  whole-state resync for a cut-over App, with a bounded cursor so every lost
  wake is eventually covered; and
- runtime discovery uses resource rows only after paused import, drained
  attempts, shadow comparison, revision-fenced activation, and explicit resume.

The guarded operator command now makes that boundary concrete: `inspect` shows
the current authority and exact source revision, `pause` stops new claims, and
offline `activate` requires drained attempts, the final reviewed SHA-256, and
an explicit assertion that the daemon is stopped. It refuses to overwrite an
already-active resource authority. The operator procedure is documented in
[Agent App operations and recovery](../2b-manual/app-operations-recovery.md).

The first production canary is now active for `scout-knowledge-lib`. Its seven
Tasks were imported from paused source revision
`672faa8ed0af8b91f81f8d05d6d2025ae2b7704efe3cb47f249c3ed4d299168b`,
shadow-compared, activated, and restarted on resource authority. Repeated
restart and HTTP task reads left the legacy file at the same revision, size,
and modification time. Five resource-backed task-list samples completed in
5-29 ms while background model work saturated the daemon.

The guarded rollout then cut over Gym, the May-agent platform App, Evaluation,
the human-facing May App, and AKS in that order. Each App was paused, allowed
to drain, inspected again after the daemon stopped, imported at the final
reviewed source revision, activated once, and resumed:

| App                        | Imported Tasks | Final legacy source revision                                       |
| -------------------------- | -------------: | ------------------------------------------------------------------ |
| Scout knowledge library    |              7 | `672faa8ed0af8b91f81f8d05d6d2025ae2b7704efe3cb47f249c3ed4d299168b` |
| Gym                        |             11 | `6dfe27f255e134e493c516836402fe50df3bb41b8a98f926c88cf34ef06b7a32` |
| May-agent platform         |             47 | `9c0d63cdd65a72db3b44fcefc29989e823ba48e7924fb9afe6f1454abefe2d09` |
| Evaluation                 |            668 | `542568e0782ed897427c44b5d046437ff87c1640f5f73ceabed23a9c22176fca` |
| May human Conversation App |              0 | `6c8036378418204d41881386757ddff6c09ad59cbff69ef1eb1139cc41b890dd` |
| AKS RP E2E                 |            541 | `d2dae7e1741afb2ea2912980ca584372f3cc661f7d56f8028fd5e8eab3ad6441` |

All six restarted on resource authority without changing the source file's
hash, size, or modification time. The human-facing May App had no live Tasks
to import; its retained legacy history remained untouched. Evaluation and AKS
admitted fresh fenced attempts through normal reconciliation rather than
resuming drained legacy attempts.

That restart exposed one superseded path: fresh task-owned agent sessions were
claimed and all resumed directly by the generic session manager, bypassing
Host capacity. Nine expensive sessions could therefore restart together and
starve control traffic. Runtime commit `be12e5ca` removes that handoff. Startup
now interrupts the previous execution evidence, preserves the Task, and
requeues it behind the ordinary human/normal capacity gate. The deployed
artifact passed the supervisor health gate and restored responsive task reads
under load.

Foreground reads now load the named task, parent chain, direct children,
dependencies, linked Conditions and receipts, and a bounded recent-attempt
window. Resource-backed Task list/get and Condition replay no longer depend on
`state.json` or an App-wide snapshot.

The first all-App restart exposed another whole-system cost. A burst of
`app.dependency.updated` events synchronously woke an exact inbox dependency,
then called the whole Host scan and evaluated Condition links by joining every
Task's JSON. Individual durable subscribers took 60-145 ms; accumulated work
held the daemon near one CPU core and made HTTP task reads time out. The repair
keeps the same semantics but makes both operations exact: the inbox wake
returns only affected App IDs, and a normalized indexed Task-to-Condition link
replaces hot-path `json_each` scans. The safety scan remains recovery insurance;
it is no longer invoked by an ordinary dependency event.

A final boundary audit found one remaining legacy read: inbox dependency
recovery constructed an App-directory reader, which reparsed frozen
`state.json` snapshots instead of asking the loaded Task capability for the
named resource. Runtime commit `ad86431e` removed that second reader and now
uses the same resource-local Task view as list/get. Its regression test removes
the legacy file after activation and still resolves the exact dependency.

A later production audit found 152 active inbox waits but only 10 distinct
`{appId, taskId}` dependencies. Recovery had decoded every wait and repeated
the same exact Task read as many as 118 times per minute. It also woke by local
`taskId` alone even though that ID existed in two Apps. Recovery now pages a
bounded indexed set of distinct canonical identities, reads each identity once,
and scopes every new Task-dependency wake to its App. Ordinary dependency events
remain the immediate path; this page remains once-per-minute recovery insurance.

The production deploy of `ad86431e` completed through receipt
`deploy-20260821T035008Z-2278365`: the loaded artifact matched the requested
SHA-256, health was `healthy`, the owner wake was targeted, and no duplicate
deploy occurred. The control socket became ready about 16 seconds after the new
daemon process started, versus about 58 seconds before the last legacy reader
was removed. Eight live AKS Task-list requests completed in 77-125 ms. A
20-second sample during active AKS work averaged 11.05% of one CPU and 370 MiB
RSS, with most individual seconds at 1-10%; the prior failure held roughly one
CPU and exceeded 850 MiB RSS. A following 30-second observation produced no
daemon log writes or slow `app-inbox-route` warnings. The live schema held
1,284 resource Tasks and 151 normalized Condition routes with zero missing
links. All five retained legacy source files still had their reviewed hashes.

The shared human Task interface then confirmed that read-side caching is not
the next optimization: with 20,000 Task rows, exact Task p95 was about 0.20 ms,
active-list p95 11.34 ms, all-history p95 24.89 ms, and App-list p95 7.80 ms.
The interface performs no model call, polling, or legacy work-projection rebuild.

A later active-work sample found a separate execution-boundary cost: one shell
command produced hundreds of megabytes, wrote a complete capture, and then made
the Host synchronously replay that capture through transient tool updates while
also writing a second complete copy. Runtime commit `5faa4d2c` keeps the child
process's capture as the one complete artifact and lets the Host read only a
bounded recent tail. A 64 MiB benchmark reduced Host reads from 67.1 MiB to
138 KiB and removed the second 64 MiB copy while preserving the same bounded
model result and complete `fullOutputPath`. TypeScript and 19 focused normal,
timeout, abort, process-group, and large-output tests passed.

The supervisor deployed that commit through receipt
`bounded-shell-capture-5faa4d2c-20260821`. The loaded artifact SHA-256
`608d4c7f2f3a6057a9d061eece138d005758ddd0b8278e64f5760099ef95bfb6`
matched the request, health was `healthy`, the exact platform-owner wake was
recorded, and `duplicateDeploy` was false. Two subsequent live task commands
retained complete 160.6 KiB and 165.0 KiB captures while their persisted tool
results remained about 42 KiB and named the complete files. This proves the
bounded shell-capture path; it does not prove the overall idle CPU/RSS target.
Profiling still observes substantial AKS, Git, Azure CLI, and other file-read
work during active reconciliation, which remains a separate cost audit rather
than a reason to put scheduling or another queue into the core.

A later live active-load sample showed the remaining acceptance problem more
precisely. The daemon was memory/CPU saturated while only one or two agent
sessions were active; durable event writes commonly took 30-200 ms, while the
session lifecycle subscriber took 30-350 ms. Task queries were not responsible.
The EventBus now has a passive `listen` path that runs only after persistence
and required routing. Each listener owns a filtered FIFO capped at 256 pending
notifications and drains at most 64 per event-loop turn. A slow listener cannot
block another or retain an unbounded event backlog; overflow keeps the newest
notifications and warns because consumers can reread durable resources. Socket
streams, Console output, Conversation mirroring, and task-session recovery use
this path, so their work and failures cannot extend the producer's `emit`.
The old Telegram outbound compatibility machine has been removed. It watched
raw session text, child-session completion, and human-targeted
`message.created` events; ran a second May review session; and maintained
adapter-local reply, approval, deduplication, and delivery state. That duplicated
the accepted Conversation/Task lifecycle and made Telegram behavior different
from Console. Explicit runtime and cron notices now append tool-authored
messages to `Conversation may:primary`; ordinary answers and proactive May
attention are persisted Conversation results. Telegram only observes the
bounded Conversation and Task resources, so no Telegram listener remains on
semantic event acceptance.

Telegram reply routing is smaller too. A reply no longer opens a notification
row to reconstruct project, session, approval, and trace state or lets the
adapter choose an App. It carries only the provider reply ID and a bounded
quote into the same May Conversation request. Conversation context and an
optional exact watched Task are the semantic inputs.
The unreachable legacy reconstruction query and its Telegram-specific focused
view have now been removed from the compatibility command router as well.

The local status read also has an opt-in process diagnostic sample. It exposes
heap used/total, external and array-buffer memory, and RSS without adding work
to ordinary health probes. This is the next live measurement needed to tell
retained JavaScript data from allocator capacity before changing caches or
retention.

The periodic delivery/pair sweep has also left the persistence boundary. It
previously ran before the first event insert after each 30-second interval, so
that caller inherited queries and updates over retained delivery history. The
existing separate maintenance process now owns the same repair pass; event
insertion only persists the current event.

Session digest and `last-session` projection writes plus terminal agent cleanup
now use the same passive listener path. The session-start identity binding stays
synchronous because execution begins immediately after that event; separating
that tiny ordering responsibility avoids hiding a real race behind the word
"observer."

The remaining synchronous EventBus handlers are limited to work that changes
the meaning or acceptance of the current event: persistence; durable App and
command routing; CLI/cron admission; metric mutation/admission; bounded
stuck/recovery and escalation state; session-start identity binding; and the
small ordering-critical runtime indexes. Console/Telegram presentation,
socket streams, projections, cleanup, digests, and network delivery are not on
that boundary.

Generic session recovery is deterministic again. The Host no longer invokes a
digest/evaluator model to choose whether a stuck session should be cancelled or
an interrupted session resumed. It counts consecutive error-only turns,
cancels at the fixed bound, performs at most two delayed resumes for eligible
unbound sessions, and emits an escalation on exhaustion. Judgment then belongs
to the owning App or human. This removes model latency, transcript synthesis,
and evaluator availability from a mechanical infrastructure path.

The subsequent active-load sample also found allocation churn in shell
progress: every output poll rebuilt, decoded, truncated, and published the
rolling tail even though runtime consumers used the event only for liveness.
Running commands now observe only capture-file size and emit one small progress
pulse per second. After the process group drains, the Host reads one bounded
tail exactly once; the complete capture remains on disk. A paced 320 KiB
structural test proves Host reads stay at or below the configured tail even
when output arrives slowly enough that an older poller would have copied every
byte. A parent-only `strace` comparison over an 8 MiB capture recorded 237
`read`/`pread64` calls versus 236 for an otherwise identical `true` command:
the verbose command added one bounded tail read, not a stream-sized replay.

The same live sample exposed a separate cleanup multiplier. Process-group
drain polled every 20 ms by walking all of `/proc` and reading every process's
`stat` record so it could ignore zombie-only groups. On the busy Host, one
settlement produced hundreds of thousands of reads. Drain now uses the
kernel's process-group probe during each bounded grace period and performs one
member walk only at a phase boundary. A descendant-drain `strace` now records
511 parent reads, versus a 214-read `true` baseline; the remaining difference
is one verification walk, not one walk per poll.

The detached native CLI runner had the same unbounded shape in a different
form: it appended every Codex/Claude stdout and stderr chunk to arrays, joined
the full stream, and parsed it again at completion. It now writes the complete
JSONL stream directly to evidence, parses protocol lines incrementally, and
retains only 64 KiB of diagnostics. A multi-megabyte protocol test proves that
early failure signals, session identity, terminal protocol state, and final
text survive while retained diagnostics remain bounded.

Conversation observation is bounded as well. Telegram now coalesces a burst of
`conversation.updated` hints into one active sync plus one dirty retry instead
of chaining one database read and network pass per wake. Console and Telegram
keep fixed deduplication windows larger than their bounded Conversation pages,
so append-only history cannot become adapter heap growth.

The retained session index exposed another history-proportional diagnostic
path. Production currently has 23,671 `meta.json` records totaling about
763 MB; a single `trace()` or session-tree read parsed every record before
selecting one session. That transient object graph can explain the observed
roughly 1.5 GB anonymous RSS and sustained heap-helper activity even though
ordinary Task reads are cheap. The source now reads the named metadata record
directly and discovers only its children through the indexed `sessions`
parent key. A 100-read sample against the live retained corpus measured about
0.15 ms p95 for the exact metadata plus child query. Structural tests prevent
these interactive reads from falling back to the whole-history registry scan.
Workflow trace expansion had the same shape: 25,015 retained workflow rows
and about 388 MB of artifacts were enumerated for every node. It now follows
the exact parent-workflow index and reads only nodes in the requested tree.
Startup recovery also used that complete enumeration merely to locate old
`running` workflows. It now selects only `running` rows older than the current
process through a `status, startedAt` index before reading the small candidate
set.
The explicit deep health audit is now history-independent as well. Session, evaluation, and
workflow counts are computed by SQLite aggregates, and stale-session detail is
selected only from active-status rows with a 1,000-row bound. It no longer
loads every `meta.json`, performs one evaluation lookup per historical session,
or reads every workflow artifact. The report exposes
`staleSessionsTruncated` when its detail bound is reached; retained history is
unchanged.

The agent-facing `system_status` dashboard had one similar fallback: each call
enumerated every retained session directory, checked every active marker, and
sorted all directory names before reading a small page. It now reads active
sessions through the status index and at most 100 recent terminal sessions
through an ended-time index. A projection-only test succeeds with no session
artifact directory, proving that this optional dashboard no longer turns
retained history into foreground filesystem work.

Production retained 68 invalid frozen admission plans. The old five-second
scan retried every one of them and continuously rewrote `updated_at`. Recovery
now selects at most 16 plans after a one-minute cooldown; its query is covered
by `idx_app_event_admission_plan_status` and averaged about 0.014 ms over 1,000
reads against the retained 1.9 GiB database. New events still take the immediate
admission path, and no historical plan was deleted or silently terminalized.

The first production activation of this cohort, correlation
`lightweight-runtime-20260822-fe8725b6`, rolled back healthy because the new
Task-reference index attempted its retained-identity backfill as about 22,800
separate autocommit writes and missed the startup health window. The failure
was not hidden by a longer timeout. The backfill is now one atomic transaction;
an isolated 20,000-row proof completed in about 205 ms and verifies rollback on
insertion failure plus idempotence. The fresh correlation
`lightweight-runtime-retry-20260822-181704c9` became ready and settled
successfully in about 19 seconds with requested and loaded artifact SHA
`6ad97f88188165048c75c7d7dd8d3976726b9d62bbdbbf46b37daf2579a7c551`,
healthy status, a targeted Task wake, and no duplicate deploy. On the loaded
production state, exact control status, App list, bounded Task list, and exact
Task detail measured about 12.4 ms, 2.4 ms, 6.7 ms, and 1.4 ms respectively.
The main process settled near 310-325 MiB RSS rather than the prior roughly
2.9 GiB; a ten-second production sample with scheduled recovery still active
averaged 5% of one CPU and no physical reads. Retained history and the 68
invalid admission plans remain intact.

A longer sample then isolated the remaining five-second CPU spikes. About 20
legacy inbox items already had an exact dependency but were still reclaimed
after every failed review: generic claim release assigned a one-second retry,
and the five-second scan claimed them again. This turned dependency waiting
into polling even though dependency events and bounded recovery already exist.
Claim release now distinguishes ordinary pending work from dependency-bound
work. Ordinary failures retain their bounded retry; a failed dependency review
returns to `handling` with no `available_at` or `review_at` deadline and wakes
only for the exact dependency event or an explicit bounded recovery review. A
regression test proves that elapsed wall time alone cannot reclaim the wait and
that the later exact dependency wake makes it claimable immediately. No inbox
row, session, event, Task, or retained evidence was deleted or rewritten to
apply this repair.

Production correlation `event-driven-inbox-waits-20260822-fc0a91cc` then
loaded the exact tested commit with matching requested/loaded artifact SHA
`e0cf32bfdc670214b22a042b7aae1dafd76825d95cf94388df5578901e9b8424`,
healthy status, a targeted owner-Task wake, and no duplicate deploy. All 155
dependency waits initially observed after restart had no availability or review
deadline and no lease; a later 12-second sample held all 159 then-current waits
unchanged and unclaimed while new work continued to arrive. Console `/help`,
`/apps`, `/tasks`, and exact `/task 9ba8995f` reads worked through the shared
resource interface. Ten live samples measured median status, App-list,
Task-list, and exact-Task reads at about 0.84 ms, 2.66 ms, 10.73 ms, and 2.00 ms.
The main process held about 246-263 MiB RSS in a 29-second active-work sample.
That sample still contained periodic CPU work and one larger active-work spike,
so it proves removal of inbox reclaim churn, not the final idle-CPU target.

Tracing that remaining periodic work found a separate compatibility loop. Every
five seconds it reopened and hashed every App manifest, watcher, agent
configuration, workflow, and legacy lifecycle file to discover source changes.
The loop has been removed rather than replaced with another watcher. App
generations now change only through explicit `/reload` atomic publication or a
deployment restart. Handler, workflow, guard, and App modules resolve lazily
once per published runtime generation and remain loaded until the next explicit
`/reload` or restart. The App inbox
safety scan now defaults to one minute and exists only for recovery, schedules,
and observer insurance. Immediate work remains event-driven. This removes 104
lines of polling machinery without changing retained state.

Production correlation `explicit-app-reload-20260822-e16ecc57` loaded the exact
tested commit with matching requested/loaded artifact SHA
`a7e3a3e2928b0ae2918e241657209a4dfb0beda0b53996d46dbabab8dadaaa89`,
healthy status, a targeted owner-Task wake, and no duplicate deploy. Console
App and Task lists plus exact Task detail worked on the loaded binary. All 159
dependency waits remained without availability/review deadlines or leases. A
35-second active-work sample averaged 8.9% of one CPU, about 310 MiB RSS, and
zero major faults. A separate 25-second main-process syscall trace observed
zero App-manifest opens and zero watcher-source opens; the only workflow source
opened was the pair actually invoked by live Evaluation work. It did not show
the former repeating whole-App source sweep. An explicit `/reload` advanced
the published registry generation from 1 to 2, proving that deliberate
activation still works. That proof also exposed a real interface gap: the
durable control request had no terminal caller-facing result even though the
generation changed.

Runtime commit `01ecee16` closes that gap without creating work. Required
reload routing remains synchronous; the one reload emits one correlated
`runtime.reload.finished` fact afterward. Console or Telegram renders only the
result matching its local request identity and records it in Conversation only
after presentation. The Event API exposes the terminal fact as an indexed
operation link from the original request. The full gate passed 2,360 tests.
Production correlation `terminal-reload-result-20260822-01ecee16` loaded
matching requested/loaded artifact SHA
`1772f933a770665c20eab6de41c554e60c3443b2a0921b323c47ea1e9c8f2392`
with healthy status, a targeted owner-Task wake, and no duplicate deploy. Live
Console `/reload` showed the six-App result; request event 5933869 linked to
succeeded result event 5933870, and command-authored Conversation event 5933871
stored exactly the rendered result. No May Task or model turn was created.

The next retained-store profile separated steady EventHub cost from scheduled
observation cost. Normal seconds stayed near zero reads, while the five-minute
measurement boundary produced large cached reads. An exact syscall trace of the
AKS metric source found one batch reopening the 20.7 MiB canonical Task snapshot
11 times and its 2.9 MiB projection 14 times. Those reads were App observation,
not event admission or Task dispatch. The sampler now holds one immutable
point-in-time Task view for one batch, and the five focus metrics share one
source scan and one process. Against the unchanged retained store, project
metric reads fell from 398.2 MB to 206.1 MB and focus-metric reads from 69.3 MB
to 38.5 MB; combined elapsed time fell from about 5.1 seconds to 3.0 seconds.
This proves and removes one history-amplifying observer path without deleting,
compacting, checkpointing, or rewriting retained state. The remaining live
burst still requires source-level attribution before the idle-resource exit is
claimed.

Production correlation
`metric-read-amplification-20260822-52662fd1-r1` then loaded Host commit
`52662fd1` with matching requested and loaded artifact SHA, healthy status, one
targeted wake, and no duplicate deploy. A correlated live metric snapshot read
about 381 MB over seven active seconds, peaked at 54% of one CPU, and settled
back to zero reads and mostly 0-1% CPU; RSS rose briefly from 241 MiB to 291 MiB
and returned to roughly 233-250 MiB. This is materially below the earlier
multi-gigabyte one-second burst, but the manual snapshot did not include every
observer and schedule that aligns on a production interval boundary. The
larger combined boundary therefore remains open for exact attribution.

The follow-up source profile closed that attribution gap. The six Host SQL
sources together took about 13 ms against the unchanged 2.0 GB database; the
pressure came from the AKS App's two child samplers. The project sampler parsed
the complete 49 MB planner journal and repeatedly serialized the same Tasks
while resolving compatibility ownership. The focus sampler recursively walked
149,773 retained artifact files to locate 3,866 aggregate results. App commit
`4429248af2` now reads only the recent append-only planner suffix, reuses one
bounded Task/spec view, selects spec ownership in one pass, batches related
metrics, matches the watcher's canonical aggregate-result shape, and parses
only files changed within the two-day observation guard. Standalone project
sampling fell from 4.03 seconds/757,612 KiB peak RSS to 1.28 seconds/214,948
KiB; focus sampling fell from 2.54 seconds/208,272 KiB to 0.39
seconds/114,928 KiB. Live trigger event `5937151` persisted all 46 source
metrics in 3.27 seconds and the observed child peak was 221,264 KiB. This work
remains entirely in asynchronous App observation: event acceptance and
semantic routing are unchanged, and no retained event, Task, session, metric,
artifact, or historical journal row was deleted or rewritten.

Session-end repair had one remaining broad read: a successful owner session
loaded up to 512 attention Tasks and decoded their attempts to find failed
executions it could release. Commit `f950638a` replaces that scan with an
owner/failure index and reads Task context only for the exact returned IDs. A
2,000-Task structural cohort returned only the two eligible latest attempts.
Production correlation `execution-recovery-index-20260822-f950638a-r1`
loaded the exact commit with matching requested/loaded artifact SHA, healthy
status, one targeted owner-Task wake, and no duplicate deployment.

An active 48.556-second sample after that deployment averaged 5.293% of one
CPU for the May main process. RSS stayed between 403,704 and 406,920 KiB and
heap used was roughly 83-85 MiB. The simultaneously running AKS App child used
about 113% CPU and 780-820 MiB RSS for its full repository check. This
separates expensive App execution from the EventHub/Task core, but it is not an
idle proof.

The AKS watcher now projects Azure DevOps run responses to only `id`, `status`,
and `result` before publishing them (`1bca14b`). Verification also clarified
the publication boundary: Apps execute their published `.state/bundle`, so a
source edit alone cannot affect the running watcher; an explicit reload or Host
deployment must publish that source before live behavior is judged. Repeated
nonterminal run-level facts remain deliberate minute-level recovery insurance
for Conditions registered after an earlier observation. They should not be
removed without a replacement proof for long-running Conditions.

The human Task page now has an explicit continuation instead of a misleading
generic next-page hint. Console and each Telegram chat/topic retain only the
opaque cursor for their own prior App/state query; `/tasks more` continues that
exact query. Long shell commands now inspect capture progress once per visible
one-second progress interval instead of ten times per second. This removes
timer and allocation churn without reducing observable progress; the full Host
suite passes 2,363 tests.

Production correlation `task-interface-pagination-20260822-4a4f66d5-r1`
loaded commit `4a4f66d5` with matching requested/loaded artifact SHA
`155ceae06a6b2c5aec65a083c3015a7ed3873acd1e0b4b51eda6c71f819fbf33`,
healthy status, a targeted owner-Task wake, and no duplicate deployment. Live
Console `/help` exposed the new command, `/tasks all` returned one bounded page
with an explicit continuation, and `/tasks more` returned the next distinct
page while preserving the prior query.

A following 45-second no-agent sample averaged 7.778% of one CPU, peaked once
at 79%, and held RSS between 258,464 and 336,240 KiB. The same window crossed a
scheduled platform metric snapshot, four AKS pipeline observations, a pull
request observation, a metric breach, and the resulting bounded Task checks.
It therefore attributes the spike to scheduled App observation and is not the
still-required quiet-window idle proof.

The next Host profile found a long-lived memory multiplier at the App execution
boundary. Every handler and workflow invocation bundled its source again and
imported it through a unique module URL. JavaScript modules cannot be unloaded,
so completed bounded work left another module graph in the Host; the same
design also repaid the bundle cost on every execution. Runtime commit
`65227d48` keeps one in-flight or loaded module per canonical source path and
runtime generation. A failed load is retryable, and the existing explicit
`/reload` clears the generation cache before republishing agent and App
definitions. No source watcher or new lifecycle was added.

A real AKS `domain-task-execution` workflow took about 122 ms for the first
bundled import; twenty later resolutions in the same generation took 0.508 ms
total, about 0.025 ms each. Structural coverage proves unchanged source returns
the same module, changed source remains inactive before reload, and the changed
module appears after the reload boundary. The complete Host test suite,
TypeScript checks, SDK check, canonical App-boundary check, and compiled bundle
passed.

Production correlation `runtime-module-cache-65227d48-20260822T1136Z` loaded
the exact source with matching requested and loaded artifact SHA
`cc556405f52e348f9dd4fb7451862651fcd3fd98f6bff7bb7cb4b996b8e6d313`,
healthy status, one targeted owner-Task wake, and no duplicate deployment. A
fresh explicit reload request at event 5936526 linked to succeeded result event
5936527 and republished all six durable Apps. After restart, the Host reported
about 228 MiB RSS and 39 MiB heap used while two agent sessions were active,
down from roughly 873 MiB RSS and 194 MiB heap used in the pre-deploy active
sample. This validates removal of the module-graph multiplier; it is not yet a
quiet-window idle proof, and child App commands remain accountable to their
Apps rather than the EventHub core.

All six Apps have completed the guarded production cutover. Historical JSON
snapshots and retained evidence have not been deleted. A brand-new App now
atomically establishes resource authority from its declarative seed without
creating a legacy mutable `state.json`; an App that already has legacy state
still requires guarded cutover. Remaining work is to
hold the resource-backed cohort through live idle-resource, event-storm, and
due-recovery proof; validate the bounded execution, Conversation sync, indexed
diagnostic, and runtime-generation module paths under longer representative
load;
extend fenced mid-attempt emission beyond direct task-owned workflows only when
a concrete agent use case needs it; and remove legacy JSON/resync compatibility
only after its last retained-data or operator reader moves.

The human-adapter event boundary is now narrower as well. Console, Telegram,
HTTP, Web UI, `--send`, runtime controls, and exact session controls all submit
semantic `EventInput` through `publish`; Telegram keeps only passive bus reads
for Conversation and Task rendering. Repository search plus a seven-day
retained-event audit allowed deletion of the flat socket `input`, `steer`,
`cancel`, `cancel_all`, `fork`, `reload`, `restart`, and `shutdown`
translators. The canonical operator-event path remains because deployed
`--emit` calls still publish
unregistered App facts and explicit `trigger.*` controls. This removes unused
human compatibility without pretending the still-used operator contract is
dead or deleting any retained event.

### Phase 0: freeze the contract and expose cost

- Add deterministic tests for the structural properties above.
- Record admission, ready wait, claim, context build, provider start/end,
  persistence, and Conversation append times under one causal ID.
- Record prompt bytes, task bytes touched, active execution count, and lane.
- Do not add model-based monitoring or broad history reads.

**Exit:** a failing benchmark identifies the exact non-model stage, and tests
capture immediate event coordination before refactoring it.

### Phase 1: make human turns cheap now

- Carry trusted human origin to the Dispatcher and actually acquire reserved
  foreground capacity.
- Serialize by Conversation ID without blocking unrelated Conversations.
- Replace fixed 40-message projection with a byte-budgeted context.
- Replace the long owner protocol with a compact schema-enforced instruction.
- Remove May's regex skill activation over generated text.

**Exit:** `hello`, `help`, contextual follow-up, work-reference follow-up, and
result wake meet the non-model latency budget under saturated normal work.

### Phase 2: establish the resource-local core

- Put task, unobserved event links, active lease, wait link, due time, and
  compact result behind one transactional repository.
- Add indexes for ready, changed, due, and expired tasks.
- Migrate a paused App snapshot, shadow-compare reads, then cut over that App
  once. Do not run permanent dual authorities.
- Start with the smallest low-risk App, then one large App; migrate May only
  after the human Conversation path has passed the same proof.

**Exit:** one task transition touches only its own bounded rows, and restart
does not require parsing an App task tree.

### Phase 3: make event coordination explicit and safe

- Replace workflow/agent direct bus access with a fenced `emit` capability.
- Require a stable local emission key for actionable events.
- Persist causality, deduplication, and exact target wakes before notifying
  subscribers; keep result correlation on the typed App request row.
- Keep final result admission independent from already accepted emissions.
- Add the crash, duplicate, stale-attempt, early-child-result, and event-during-
  attempt tests.

**Exit:** Apps can break down and coordinate work through immediately visible
events without holding an executor or losing restart safety.

### Phase 4: replace continuous discovery with a light dispatcher

- Use one deduplicated Host ready set with human and normal lanes.
- Remove per-App broad completion refill and fixed full-state resync.
- Recover from indexed startup, nearest-due, expired-lease, and bounded safety
  queries.
- Back off repeated failures and prove graceful drain/restart.

**Exit:** an idle system stays idle, and missed in-memory notification is still
recovered within the safety interval.

### Phase 5: collapse redundant durable machinery

- Replace admission plan/command chains with the accepted event and exact
  task/request links.
- Reduce Conditions to task wait links and due times.
- Keep request correlation only where a caller is owed a response.
- Move task tree, Conversation display details, session digests, evaluations,
  metric aggregation, traces, and delivery retries to bounded subscribers or
  reads.

**Exit:** each durable record has one owner and one purpose; none forms a
second execution lifecycle.

### Phase 6: align, retain, and delete

- Update accepted design and manuals to this contract.
- Migrate every App and adapter to the same event/task interfaces.
- Define protected references, then archive or compact old detail in bounded
  pages.
- Delete whole-App mutable authority, broad resync, direct EventBus exposure,
  admission plan workers, generated prompt protocol, stale skill rules, and
  compatibility projections after their last reader moves.

**Exit:** repository search and runtime tests show one App work path and no
legacy fallback; retained history does not affect idle cost or human latency.

## Documentation alignment on acceptance

Current accepted design mostly agrees that Apps reconcile tasks and waits cross
event boundaries. Acceptance of this proposal requires these refinements:

- replace “outgoing events become visible with the final result” with the
  immediate fenced `emit` rule;
- describe result admission and event emission as separate commit points;
- replace frequent task resync language with indexed recovery insurance;
- stop presenting whole-App JSON as acceptable mutable authority;
- make human/normal lanes, rather than App-written priority alone, the trusted
  scheduling boundary;
- describe Conditions as exact task wait state, not an independently active
  subsystem; and
- consistently keep delivery, projections, metrics, traces, digests, and
  evaluation outside semantic completion.

Until the proposal is accepted and implemented, current design remains the
description of production behavior. The migration must update code, tests,
design, and manuals together at each cutover rather than documenting a future
state as already implemented.

## Non-goals

- introducing Kafka, a durable broker, or another service;
- creating a second fast path for “simple chat”;
- routing ordinary human language with adapter regexes;
- keeping workflows or sessions alive across durable waits;
- promising exactly-once external side effects; or
- deleting historical data before its authority and references are understood.

The intended result is not a less capable May-agent. It is a small core whose
capability grows through Apps and event consumers without making every human
turn, task transition, or idle minute more expensive.
