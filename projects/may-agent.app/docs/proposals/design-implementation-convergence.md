# May Design And Implementation Convergence

**Status:** Accepted for staged implementation

**Review date:** 2026-08-25

**Scope:** Review the complete May system—not only Conversation and Topic—then
converge Infra, Runtime, Apps, executors, adapters, metrics, and documentation on
one simple event-driven design.

## Purpose

The current core design is sound, but the implementation still carries several
older models beside it. This proposal records the gaps and a review order. Hao
authorized focused staged implementation on 2026-08-25; broad database cleanup
remains out of scope.

The goal is convergence, not another architecture:

```text
Turn or Event
  -> persist immediately
  -> May answers directly, or assigns work to an App Task
  -> the App reconciles its Task through a workflow, agent, or CLI executor
  -> progress, steering, waits, and results return as Task Events
  -> Console, Telegram, and later adapters observe and render the Conversation
```

The responsibilities remain plain:

- May understands and represents the human.
- Apps own durable Tasks and decide what completion means.
- Agents, workflows, Codex, and other executors perform bounded attempts; they
  do not own work.
- Topics connect human conversation context to related Tasks; they are not work.
- Infra persists Events, admits small routes, applies capacity, and delivers
  passive observations.
- Runtime wakes and fences Task attempts, accepts results, and recovers missed
  progress.

## What already fits

These parts should be retained rather than redesigned:

1. Event persistence precedes semantic routing and side effects.
2. Passive listeners have independent bounded FIFOs and cannot extend Event
   acceptance latency.
3. Apps, not sessions or executors, own durable Tasks.
4. A session, workflow run, or Codex thread is replaceable attempt evidence.
5. Repeated Task wakes coalesce and recovery uses bounded indexed reads.
6. May human Turns use the conversational request path rather than manufacturing
   a generic May tracking Task.
7. Console and Telegram observe one shared Conversation while retaining
   interface-appropriate presentation and commands.

## Findings

### 1. Metrics have two execution authorities

The accepted metrics design says there is no global `ALL_METRICS` catalog and
that definitions live beside the Apps that understand them. The current
implementation still has a roughly 2,500-line central registry in
`agents/tech-lead/handlers/metrics-snapshot.ts`.

The same work is also scheduled twice:

- `app.ts` publishes `trigger.metrics-snapshot` every five minutes; and
- `agents/tech-lead/cron.json` runs `metrics-snapshot` every five minutes.

Live evidence from the six hours ending at review time showed:

- 71 `trigger.metrics-snapshot` Events;
- 94 handler starts;
- 91 completions and 3 failures;
- 25.0 total handler-minutes;
- 16.5-second mean, 39.8-second p95, and 51.3-second maximum duration.

This is direct production cost and contradicts the one-scheduler design.

Proposed direction:

1. Confirm Cron as the one selected Host-maintenance authority.
2. Remove the App `platform-metrics` schedule.
3. Keep only small Host-owned runtime measurements in Host maintenance.
4. Move evaluation, scout, and domain measurements to their owning Apps in
   bounded steps.
5. Retire the central catalog after its last metric family moves.

### 2. Host Operations execution identity is contradictory

`app.ts` selects `may` for Host Operations Tasks and `project.json` names May as
owner. Active `tech-lead` material says that `tech-lead` owns the project and
May is outside project ownership. Retained live Task rows mostly name May as
their selected owner/execution profile.

This mixes May's human-deputy role with platform execution.

Preferred direction:

- the `may-agent` App owns platform Tasks;
- `tech-lead` is the default execution profile for those Tasks; and
- May understands, delegates, reviews returned evidence, and speaks to the
  human.

If May is intentionally retained as the platform executor, the conflicting
`tech-lead` owner model must instead be removed. Keeping both is the problem.

### 3. Host Operations exposes incidents as permanent contracts

`app.ts` contains public input variants bound to exact historical facts,
including old `appdep_*` IDs, Event IDs, Task generations, session IDs, commits,
artifact hashes, paths, and incident correlations.

These are preserved incidents, not reusable App capabilities. Encoding them in
the public schema makes the current contract hard to understand and encourages
future incidents to add another permanent route.

Proposed direction:

1. Confirm that no unfinished request still depends on each exact input kind.
2. Preserve completed proof in an artifact or archive.
3. Remove finite historical input kinds.
4. Keep a small stable contract: owner review, platform obligation, deployment
   request, and runtime capability request.

### 4. The Codex executor proposal overstates parity

The Codex proposal requires mechanical cancellation through
`TaskAttempt.signal` and one canonical attempt packet built by Runtime for all
executors. Current implementation differs:

- `TaskAttempt` has no `AbortSignal`;
- Task cancellation cannot interrupt an active Codex turn;
- Codex `interrupt()` is used for hard-stale recovery, not Task cancellation;
- the canonical packet is built inside the Codex adapter;
- live native execution does not consume that packet;
- `renderNativeTaskAttempt()` only clones synthetic test data; and
- role instructions are rediscovered from `<cwd>/agents/<agent>/AGENTS.md`,
  which does not resolve the global May role from an App workspace.

Proposed production gates:

1. Add mechanical cancellation to the executor contract and wire it to Codex
   interruption/process shutdown.
2. Build the canonical packet once in Runtime.
3. Pass the same packet and resolved role capabilities to native and external
   executors.
4. Add a fixture comparing real native and Codex attempt inputs.
5. Keep the proposal status honest until those gates pass.

### 5. Task Runtime still carries two persistence models

Every currently installed App records resource authority in
`app_task_store_meta`, but normal production code still supports the legacy JSON
Task tree through `app-task-store.ts`, `app-task-resource-cutover.ts`, and many
`!resourceStore` branches.

This leaves two persistence mental models inside two very large core files:

- `app-task-reconciler.ts`: 4,279 lines;
- `app-task-runtime.ts`: 4,699 lines.

Proposed direction:

1. Prove that no installed or live App depends on JSON authority.
2. Preserve old files as read-only evidence/export input.
3. Move any necessary importer to an offline script.
4. Remove dual read/write/cutover branches from normal startup and
   reconciliation.

### 6. Inbox Runtime retains abandoned lifecycle APIs

No production callers were found for several exported store operations,
including old referenced-work claiming, continuation completion, session claim
enumeration, delivery reads, unlinked delegation listing, and generic wait
queries. Some remain used only in tests or fixtures.

`app_inbox_deliveries` is still joined into request and health reads even though
there is no active production writer. This conflicts with the accepted rule
that transport delivery does not gate semantic work.

Proposed direction:

- remove unused APIs and delivery joins from the active path;
- retain historical tables and columns until a separately reviewed schema
  migration; and
- do not introduce another cleanup worker.

### 7. Pre-cutover May wrapper Tasks are retired

At review time the live store contained six old `may/conversation/app_*` Task
rows: one appeared waiting and five required attention. The current May App
uses `requests: { mode: "agent" }`, so new human Turns do not create these
wrappers.

As of 2026-08-25, all six rows have exact typed cancellation records and are
absent from the active Task view. The last stale wrapper was cancelled through
the same validated human Task control used by the adapters; May did not edit
persistence or create another cleanup Task. A production soak then proved that
direct answers and rejected unknown Task references created no wrapper or
delegation residue.

The retained rows remain historical evidence. No database deletion, permanent
legacy-wrapper janitor, or broad cleanup is needed. Finite human requests must
continue to use Host request correlation and must never be attached to a
standing Task that intentionally does not terminate.

### 8. Topic selection can fail after aging out of the recent view

This gap is implemented in the current candidate. Conversation reads now expose
opaque Topic pagination, exact Topic/ref reads, bounded exact Topic messages,
and exact reply-to-Topic resolution. Console and Telegram can select an old
Topic without relying on the recent projection. Natural old-discussion
references use a scoped read-only Conversation lookup whose candidates remain
an LLM decision, not a keyword router.

Retained direction:

- the selected Topic ID is authoritative; adapters may cache its presentation;
- exact selected Topic membership is read from canonical Topic storage;
- recent lists remain bounded; and
- presentation stays separate between Console and Telegram.

Related lower-priority adapter cleanup:

- serialize Console-local asynchronous Topic commands so pasted commands render
  in order;
- share only small Topic identity/resolution helpers;
- report an eight-character reference collision as ambiguous rather than not
  found.

### 9. Human request concurrency is implicit

`maxConcurrentRequests` looks like a strict total limit, but when capacity is
full the request pump may start one additional May request. Human precedence is
the correct behavior; the hidden extra slot is not.

Proposed direction:

- make the foreground human reserve explicit in configuration and naming;
- test the exact maximum and human-precedence behavior; and
- avoid adding a general broker or queue abstraction.

### 10. Task queue ordering has overlapping controls

`AppTaskQueue` combines:

- human and normal lanes;
- `front`;
- `promote`;
- P0 through P3 priority;
- front-burst fairness; and
- separate priority-skip aging maps.

This works, but it is difficult to explain and contains three overlapping ways
to move work ahead.

After higher-priority correctness work, consider reducing it to:

- human versus normal lane;
- stable priority and FIFO within the lane; and
- repeated wakes coalesced by Task ID.

Keep an extra ordering mechanism only when a focused starvation test proves it
is necessary.

### 11. Accepted documentation contains conflicting claims

Current inconsistencies include:

- `system-model.md` says every installed App maps admitted input to a Task,
  while May intentionally handles one bounded conversational request directly;
- `docs/INDEX.md` describes lightweight reconciliation as active future work,
  while that proposal says accepted, implemented, and verified;
- `agents/tech-lead/context.md` points to the former JSON Task tree and a removed
  proposal path;
- Runtime `package.json` still describes a feature-unit sub-agent system; and
- the EventBus header links to the obsolete `v2-architecture` document.

Use this wording consistently:

> Every executable durable App outcome uses a Task. May may answer one bounded
> conversational request directly; durable destination work belongs to the
> destination App's Tasks.

### 12. App verification does not cover all active material

Runtime TypeScript and canonical App-boundary checks passed. The Host Operations
App's focused `app.test.ts` passed all sixteen tests. The complete App check did
not pass:

- the current installation lacks Node/Bun type declarations used by workflows;
- `platform-owner-review.ts` still reads the removed
  `ctx.reconciliation.trigger`; and
- `session-recovery.ts` still returns obsolete state `needs-owner`.

This means the focused manifest tests can pass while active agent workflow
material remains incompatible with the current SDK. Fix or remove that material
before claiming full App verification.

### 13. May lacked canonical referenced-Task state and narrow Task control

The stale wrapper incident exposed two coupled gaps. Command views stored exact
`taskRefs`, but a later May turn received only rendered text unless the adapter
was actively watching one Task. May therefore invented a relationship between
an old wrapper and unrelated repair work. It also had no structured way to
apply the human's simple request to remove the exact obsolete Task, so it
delegated another Host Operations Task.

Accepted direction:

1. Runtime resolves a bounded newest-first set of command/tool `taskRefs` into
   current canonical Task snapshots before calling May.
2. May may return a plain response plus cancellation of an exact Task already
   supplied as focused, recently referenced, or linked by the current Topic.
3. The Host validates direct human authority and exact identity, then uses the
   existing human Task service. May never receives persistence access.
4. Feedback and continuation remain typed input to the same owner Task.
5. Host Operations remains a separate App and receives only genuine Host code,
   configuration, deployment, or policy work.
6. A Task cannot wait for an action assigned back to its own App unless that
   operation was first durably submitted and the Condition names its real
   correlation.

## Proposed order

1. Stop duplicate metrics scheduling and measure the change.
2. Choose one Host Operations execution identity and align code, agent material,
   and documentation.
3. Remove or archive incident-specific App input contracts after checking live
   dependencies.
4. Complete Codex cancellation and real executor-input parity.
5. Prove resource authority and retire the legacy JSON Task path.
6. Remove dead inbox lifecycle/delivery APIs from the active path.
7. Perform one bounded migration of pre-cutover May wrapper Tasks.
8. Fix exact selected-Topic lookup and Console command ordering.
9. Consolidate accepted documentation and repair the complete App check.
10. Simplify queue ordering only after measurements and focused tests show which
    fairness controls remain necessary.

Each step should be independently reviewable, tested, and reversible. Do not
combine the sequence into one broad rewrite.

## Non-goals

This proposal does not propose:

- a replacement Event broker;
- a new Task type or tracking wrapper for every human Turn;
- a new guaranteed-delivery subsystem for Console or Telegram;
- a permanent cleanup reconciler for historical rows;
- broad deletion or rebuilding of the production database;
- treating sessions, Topics, workflows, or Codex threads as work ownership; or
- hiding current concepts behind new vocabulary.

## Review questions

1. Is Cron the selected single authority for Host metrics snapshots?
2. Should `tech-lead` become the default Host Operations executor, keeping May
   only as human deputy?
3. Which incident-specific input kinds still have unfinished live dependencies?
4. Is mechanical cancellation required before any further Codex rollout?
5. What proof is sufficient to remove the legacy JSON Task runtime path?
6. Which queue-ordering mechanisms have demonstrated starvation cases that
   justify retaining them?

## Acceptance criteria

The proposal is ready to move from review to an implementation plan when:

- the six review questions have explicit decisions;
- every migration step has a bounded verification and rollback;
- no step requires broad DB cleanup;
- May, App, Task, executor, Event, Conversation, and Topic retain the simple
  responsibilities stated above; and
- documentation describes the implementation that actually runs.
