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

Only Scout has completed the guarded production cutover. Legacy JSON remains
the authority for May, Gym, Evaluation, and AKS until each App completes the
same procedure. Historical data has not been deleted. Remaining work is to
hold the canary through idle-resource and due-recovery proof, cut over the
other Apps one at a time, extend fenced mid-attempt emission beyond direct
task-owned workflows only when a concrete agent use case needs it, then remove
the legacy JSON/resync path after the last reader moves.

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
