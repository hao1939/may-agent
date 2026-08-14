# Canonical Agent App Migration

**Status:** Accepted; Evaluation and May/platform migrated, AKS and runtime
deletion remain
**Decision owner:** Hao
**Last reviewed:** 2026-08-15
**Supersedes:** the ownership, routing, and App-hosting parts of the legacy
Project App and owner-inbox designs
**Preserves:** the proven task-resource reconciliation semantics, migrated
behind the canonical App host

## Decision

May-agent will have one App model and one durable ownership rule:

```text
addressed request -> App inbox -> bounded owner disposition
durable outcome   -> App task  -> repeated reconciliation
changed fact      -> event     -> subscribed request, TaskIntent, exact wake, or observation
execution         -> session   -> bounded result
```

An App is the only durable asynchronous address. An inbox item is the authority
for an addressed request. A task is the authority for a durable desired
outcome. An event is a persisted fact and wake signal, never an alternate work
queue. A session is bounded execution, never durable ownership.

Every canonical App is declared once with `defineApp(...)`, loaded once by the
process-wide `AppRegistry`, and hosted by one runtime. The existing Project App
task reconciler is not discarded; its useful mechanics become the optional
task capability of that host. The `defineProjectApp` contract, duplicate
`app.ts`/`inbox.ts` declarations, `@may-agent/sdk/legacy`, generic owner-inbox
fallback, and arbitrary event-driven App execution are removed after their
consumers migrate.

This is a deletion migration, not a task-engine rewrite.

## Why this migration is necessary

The first App-host migration established a clean addressed-work core, but the
repository still exposes two application architectures:

```text
inbox.ts -> defineApp -> AppRegistry -> AppInboxHost

app.ts   -> defineProjectApp -> project-app-loader -> event/task controllers
```

At migration start, Apps such as `aks-rp-e2e` and `evaluation` had both
definitions in the same directory. The inbox definition identified the durable
address while the Project App definition owned schedules, event selectors,
actions, task correlation, local agents, workspace policy, and task execution.
Evaluation has now removed that split; AKS is the remaining external App with
the duplicate architecture.

The result works, but it leaves several questions with two answers:

- Which file defines an App?
- Is an actionable event owned by an inbox item, an event pair, or a task?
- Does an event invoke `onEvent`, create a task, or enter an App inbox?
- Is the public SDK the root package or the legacy package?
- Does reload publish one App snapshot or coordinate two partially committed
  snapshots?
- Is May an App or a bridge outside the App model?

The canonical design gives every question one answer.

## Current-state inventory

The inventory is intentionally recorded by responsibility rather than a
volatile line count.

### Canonical core already implemented

- `AppRegistry` loads durable App addresses unconditionally.
- `AppInboxStore` persists `pending -> handling -> done` independently of event
  retention.
- `AppInboxHost` validates input, fences claims, invokes the owner, and admits
  `complete`, `delegate`, or `task` dispositions.
- The App runtime provides fair scheduling, restart recovery, explicit
  dependency wakes, and an outbox for human and agent delivery.
- May human input is admitted to the `may` App.
- The root `@may-agent/sdk` entry point is capability-scoped and does not expose
  raw database or task-store mutation.

### Legacy implementation still active

The runtime still has production imports from `@may-agent/sdk/legacy` for:

- loading and hosting `defineProjectApp` definitions;
- task tree storage and projection;
- task action admission and reconciliation;
- Condition tracking and review;
- task workspace preparation and cleanup;
- task recovery and controller startup;
- HTTP/read-model compatibility;
- process identity and older workflow helpers.

The May conversation App, platform App, and Evaluation App now use one
canonical manifest and the root authoring SDK. Evaluation session aftermath
also emits `evaluation.recorded` instead of writing the runtime database or
host-owned session paths.

The remaining external legacy production consumers are in
`aks-rp-e2e.app`: its `app.ts`, watchers, workflows, task helpers, and
maintenance scripts still use the legacy declaration and authoring boundary.

Many imports are only names from the old barrel. Others are real capability
violations, especially direct task-store reads/writes, raw SQL observer access,
and arbitrary `onEvent` execution.

### Legacy behavior to delete

- `defineProjectApp` as a second App declaration.
- A second Project App descriptor registry.
- Top-level `events` plus imperative `onEvent` as an actionable-work path.
- New owner-inbox/event-pair creation for addressed App messages.
- Generic owner fallback that treats visibility as handling.
- Direct App task-state mutation from ordinary workflows.
- Public access to runtime filesystem layout, SQLite, claims, leases, recovery,
  controller, and persistence helpers.
- Duplicate reload/install/watcher paths for the same App.

### Behavior to preserve

- Task desired/observed state and generation fencing.
- Task attempts, leases, restart recovery, and stale-result rejection.
- Conditions and exact dependency wakes.
- Handler selection, workflow execution, verification, and owner fallback
  inside a task reconciliation attempt.
- Task workspace isolation and conservative cleanup.
- Global and per-App concurrency limits.
- Schedules, deterministic observers/watchers, typed actions, and metrics.
- Existing task state and task IDs without destructive migration.
- Read models and operational evidence needed to diagnose live work.

## Canonical mental model

### App

An App is a durable service boundary:

```text
App = address + inbox + owner + optional task capability + domain policy
```

The App owns the meaning of its input. It does not own persistence, leases,
delivery retries, session recovery, or scheduler mechanics.

### Inbox item

An inbox item answers:

> Which addressed request is this App responsible for handling eventually?

Its lifecycle remains deliberately small:

```text
pending -> handling -> done
```

While handling, it may link to exactly one current owner session, child App
item, or task. Detailed session/task phases remain in their own records.

### Task

A task answers:

> Which durable desired outcome must this App repeatedly reconcile until its
> acceptance criteria hold?

Tasks are optional. A bounded request should complete directly. The owner
creates or attaches a task only when the outcome must survive multiple attempts,
external waits, or changing observations.

### Event

An event answers:

> What fact crossed a boundary?

An event can:

- be projected for observation;
- match an App subscription and durably create an inbox item;
- target an exact task and wake it;
- match an App task rule and create/update a task intent; or
- remain a non-actionable lifecycle fact.

Event delivery metadata records whether a consumer accepted the fact. It does
not become the source of truth for whether an App request or task is finished.

### Session

A session is one bounded execution attempt. A session may be associated with an
inbox claim or task attempt, but restart recovery always returns to the inbox or
task authority. A running session does not become the durable owner.

### Metric

A metric observes. Threshold logic may publish a breach or recovery event, but
only durable App/task state moves work forward. Metrics never mutate inbox or
task lifecycle directly.

## Responsibility boundaries

| Layer | Owns | Must not own |
| --- | --- | --- |
| Infrastructure | event persistence, database, timers, transports, process lifecycle, execution engine, metrics storage | domain judgment or desired outcomes |
| App host | definition loading, admission, claims, leases, bounded invocation, recovery, task-capability attachment, delivery | App-specific policy |
| App | input meaning, subscriptions, task correlation, schedules, actions, owner identity, workspace policy | generic retry/recovery/delivery loops |
| Owner agent | one bounded judgment/execution move and a typed disposition | durable polling or hidden background ownership |
| Task reconciler | desired/observed task state, Conditions, attempts, verification, convergence | human conversation or arbitrary message routing |
| Observer | collect current facts and emit observations | create hidden durable ownership |
| Workflow | reusable bounded execution | direct inbox/claim mutation or global task-store mutation |

## Canonical App declaration

Each App directory exposes exactly one manifest:

```text
projects/<id>.app/
  app.ts                 # the only App definition
  agents/                # optional local agents and workflows
  observers/             # optional deterministic observation adapters
  domain/                # App-owned pure policy and schemas
  scripts/               # explicit maintenance tools, not runtime imports
  .state/                # host-managed runtime state
```

The target authoring shape is:

```ts
export default defineApp({
  id: "aks-rp-e2e",
  version: 1,
  owner: "app-ops",
  description: "...",

  inputSchema,
  inbox: { batch: "single" },

  subscriptions: [
    {
      id: "human-project-comment",
      event: { type: "project.comment.created", project: "aks-rp-e2e" },
      toInput(event) {
        return { kind: "message", data: { message: event.data.comment } };
      },
    },
  ],

  schedules: [
    {
      id: "master-validation-cycle",
      intervalMs: 21_600_000,
      event: {
        type: "aks.master-validation.check",
        data: { reason: "scheduled" },
        target: { appId: "aks-rp-e2e", project: "aks-rp-e2e" },
      },
    },
  ],

  observers: [repoRefObserver, pipelineObserver],

  tasks: {
    attach: true,
    subscriptions: taskSelectors,
    resolve: resolveTaskIntent,
    validateAction,
    maxConcurrent: 8,
    resyncIntervalMs: 60_000,
  },

  actions: {
    "advance-project": {
      description: "Ask the App to review and advance current work.",
      inputSchema: actionSchema,
      toInput: (data) => ({ kind: "request", data }),
    },
  },

  workspace: { kind: "git", localPath: "../aks-rp-e2e" },
});
```

This example is illustrative; the implementation may split large domain
policies into imported modules. The invariant is one exported App definition,
not one physical source file containing all logic.

### Definition semantics

#### `inputSchema`

Defines all explicitly addressed inputs accepted by the App. Admission validates
before persistence. Unknown or invalid input is rejected; it is never silently
routed to an agent or generic owner queue.

#### `route`

`route(request)` is pure deterministic policy for requests that do not need
owner judgment. It may complete the request, delegate it to another App, or
attach it to a task. Returning `null` is the only way to request one bounded
owner decision. The host applies `route` independently to every claimed item,
then invokes the owner only with the unresolved subset; mixed batches do not
force deterministic work through an agent.

The request passed to policy is the immutable author-visible `AppRequest`, not
an inbox row. When policy attaches a task, that exact request object—including
its source, parent, input, and dependency observation—is recorded in the
host-private task trigger. Claim generations, leases, channels, and delivery
metadata never cross the authoring boundary.

#### `subscriptions`

Subscriptions replace legacy top-level `events` and imperative `onEvent`.

Each subscription has:

- a stable ID;
- a declarative event selector; and
- a pure `toInput(event)` translator returning one typed `AppInput` or `null`.

The translator receives a frozen normalized event and no mutation context. It
cannot run an agent, start a workflow, write task state, emit another event, or
access SQL. The host validates the translated input, derives an idempotency key
from `(appId, subscriptionId, eventId)`, writes the inbox row, and only then
acknowledges durable delivery.

There is no `inbox.accepts` selector or implicit fallback from task events into
the inbox. App `subscriptions` explicitly create correlated requests;
`tasks.subscriptions` explicitly resolve desired task work.

Facts that only refresh desired task work belong in `tasks.subscriptions`, not
in App `subscriptions`. An event carrying an explicit task target bypasses
broad resolution and wakes only that task; neither path creates inbox work.

#### `schedules`

A schedule declares exactly one typed destination:

- an input schedule creates an independently correlated App inbox obligation;
  its idempotency key includes App ID, schedule ID, and time slot, and its
  declared catch-up policy may admit at most the latest missed slot; or
- an event schedule publishes a fact through the shared event runtime; it may
  wake a task subscription without manufacturing a callerless inbox item and
  does not replay missed facts.

Periodic collection of external state belongs to an observer. The observer
publishes what it observed; the resulting fact is then classified by the same
subscription, task-subscription, or observation-only rule as every other fact.

#### `observers`

Observers are bounded deterministic adapters. They receive capability-scoped
read and logging ports. They may observe the filesystem or external provider
through an explicitly configured adapter and return facts for the host to
publish only after the run succeeds. They cannot mutate inbox or task state or
publish through a second side-effect path.

An observer failure is operational evidence and retryable observation work; it
does not create a second ownership lifecycle.

#### `tasks`

The task capability is optional. `attach: true` allows an owner disposition to
attach an existing task or declare a desired `TaskIntent`.

Every App-to-task attachment has a stable admission key derived from the inbox
item and attachment identity. The task engine persists that admission before
waking work. Redelivery of the same admission neither installs a second trigger
nor starts a second attempt; a new inbox admission may wake the same standing
`maintain` task with its own exact request. Reusing an admission key for a
different task specification is rejected. The inbox links its durable wait
before using a post-link completion check, and that check cannot report
completion while the admission trigger is still pending.

Task subscriptions and `resolve` retain the useful part of the current Project
App contract: deterministic event-to-desired-task correlation. A targeted task
event bypasses broad resolution and wakes only that exact task. Untargeted
domain facts may resolve to one stable task intent.

Task storage, generations, attempts, leases, queues, workspace mechanics,
verification, recovery, and projections are host-private. App code supplies
only policy and typed results.

#### `actions`

Actions are discoverable typed ingress. An action translates validated input
parameters into an App input and uses the same inbox admission path as every
other addressed request. An action cannot emit arbitrary actionable events to
bypass App admission.

#### `workspace`

Workspace policy declares where bounded execution is allowed. The host owns
worktree creation, lineage recording, cleanup, and recovery. Workflows receive
only the workspace allocated to their attempt.

## Public authoring contracts

The root `@may-agent/sdk` remains the only runtime authoring entry point.

It exposes four small semantic result families because they answer different
questions:

| Contract | Question |
| --- | --- |
| `AppDisposition` | What should happen to this addressed inbox request? |
| `TaskReconcileResult` | What observed result and next state applies to this desired task? |
| `ExecutionResult` | How did this bounded agent/workflow execution end? |
| `AppEvent` | Which fact should observers and owners be able to react to? |

The root package may expose:

- `defineApp`, schemas, and canonical definition types;
- `AppInput`, `AppRequest`, `AppDisposition`, and dependency observations;
- `TaskIntent`, `Condition`, task actions, task views, reconcile/verification
  results, and pure validation helpers;
- capability-scoped observer and workflow contexts;
- canonical event/selector types and pure matching helpers;
- test fakes for those public contexts.

It must not expose:

- SQLite interfaces or raw SQL;
- absolute global runtime paths;
- inbox rows, claims, generations, or leases;
- task state files or general read/write functions;
- controller, queue, scheduler, recovery, delivery, or process identity APIs;
- unrestricted cross-project query or mutation;
- host-only session association and attempt mutation.

### Task handler contract

Legacy task handler types are renamed without changing proven semantics:

```text
ProjectAppTaskIntent              -> TaskIntent
ProjectAppConditionSpec           -> Condition
ProjectAppTaskAction              -> TaskAction
ProjectAppTaskHandlerResult       -> TaskReconcileResult
ProjectAppTaskVerificationContext -> TaskVerificationContext
ProjectAppTaskVerificationResult  -> TaskVerificationResult
```

Compatibility type aliases may exist inside the runtime during migration, but
they are not exported from the canonical package root and are deleted with the
legacy entry point.

### Workflow context

A task workflow receives the exact task, generation, trigger, child summary,
workspace, and permitted reads required for that attempt. It returns a typed
`TaskReconcileResult`; it does not read or write the global task tree.

If a workflow genuinely needs a projection not available in its input, add one
bounded read capability by domain meaning. Do not restore a raw SQL or arbitrary
path escape hatch.

Maintenance scripts that intentionally migrate stored state are not ordinary
workflows. They use a versioned runtime maintenance CLI, run offline or under a
project lock, produce a receipt, and never import author SDK persistence
helpers.

## Host-internal architecture

The target host has four cohesive modules behind one facade:

```text
AppRegistry
  -> AppAdmission       # explicit inputs, actions, subscriptions, schedules
  -> AppReconciler      # fair scheduling, claims, owner dispositions, recovery
  -> AppTaskRuntime     # optional task capability and existing task engine
  -> AppDelivery        # durable outbox and channel receipts
```

`runAppRuntime` assembles those modules and transports. It does not implement
domain routing.

### AppRegistry

The registry loads only canonical `app.ts` manifests. It validates the complete
prospective snapshot before publication:

- unique App IDs;
- registered owner agents;
- input and action schemas;
- unique subscription, schedule, observer, and action IDs;
- selector validity;
- task capability consistency;
- workspace configuration;
- removal safety for unfinished inbox items and active tasks.

The published snapshot is immutable. Every runtime component consumes the same
generation.

### Transactional reload

Reload follows prepare/commit/abort:

```text
load modules
  -> build prospective registry generation
  -> prepare agents, subscriptions, schedules, observers, and task controllers
  -> validate removal and state compatibility
  -> atomically publish one generation
  -> retire previous generation after in-flight leases drain
```

Any prepare failure leaves the previous generation fully active. Commit does
not publish the App registry before task controllers and routes are ready.
In-flight attempts retain their old generation fence; their effects are admitted
only against the compatible stored task/inbox generation.

### AppAdmission

Admission owns all ways actionable App input enters:

- human/API/control-socket requests;
- App-to-App delegation;
- typed actions;
- event subscriptions;
- schedules.

Every path produces the same validated `AdmitAppInput` command and durable row.
Transport events can remain the persistence boundary initially, but successful
delivery means the inbox row exists, not merely that a subscriber returned.

### AppReconciler

The reconciler owns:

- per-App fair scheduling;
- per-conversation serialization;
- claim fencing and lease renewal;
- bounded owner invocation;
- disposition validation/admission;
- dependency observation and wakeup;
- restart recovery.

Scheduling concurrency is across Apps and, when explicitly enabled, across
independent conversations within one App. Default `single` batching does not
mean the whole App must be globally serialized forever; the declared App budget
and conversation key define safe concurrency.

### AppTaskRuntime

The task runtime owns the current task-resource engine after extraction from
`project-app-loader.ts`:

- state store and projections;
- task intent admission;
- controller/queue and capacity;
- attempt claims, leases, and session association;
- handler/workflow/owner invocation;
- Conditions and dependency tracking;
- verification and result admission;
- workspace allocation and cleanup;
- recovery and repair;
- task views and health.

It accepts a canonical App definition plus host services. It does not load a
second manifest or subscribe independently through an App-specific event router.

### AppDelivery

Delivery owns the outbox, transport dispatch, correlation, retry safety, and
receipts. The App host stages completion and delivery atomically. Ambiguous
external sends become `uncertain`; they are never blindly repeated as though
nothing happened.

Agent-to-Agent durable replies are App-to-App messages when the recipient has an
App address. Direct agent calls remain bounded execution inside the current
owner attempt.

## May and may-agent are distinct Apps

The name collision is resolved explicitly:

- `may` is the conversation App. It owns human requests and has no schedules,
  observers, or task capability.
- `may-agent` is the platform-maintenance App. It owns runtime/platform desired
  work and may have schedules, observers, actions, and tasks.

They must not be two definitions hidden in one directory. The canonical layout
is:

```text
projects/may.app/app.ts          # conversation address, owner may
projects/may-agent.app/app.ts    # platform App, owner tech-lead
```

The `may` App may delegate platform work to `may-agent`. The platform App returns
a child result; May reviews and communicates it. Human-channel policy remains
with May, while platform convergence remains with `may-agent`.

## Event and routing migration

Every legacy event path is classified before migration:

| Current behavior | Canonical behavior |
| --- | --- |
| Human/App addressed message | App inbox admission |
| Typed action emits an actionable event | Action creates App input |
| Schedule represents a distinct review obligation | Input schedule creates App input |
| Schedule wakes deterministic desired work | Event schedule publishes fact to task subscription |
| Schedule polls provider and emits facts | Scheduled observer emits facts |
| Event `onEvent` performs bounded domain action | Subscription creates App input; owner handles it |
| Event deterministically resolves desired task | Task subscription resolves task intent |
| Event targets exact task/Condition | Exact task wake, no App inbox item |
| Lifecycle/log/projection event | Persist/observe only |
| Unknown addressed App | reject and retain visible admission failure |
| Unknown unaddressed event | unhandled observation; no owner work synthesized |

The route is exclusive per App obligation. An event must not create both an
inbox item and task work for the same App. Canonical App `subscriptions`
translate addressed event work into inbox input; `tasks.subscriptions` resolve
deterministic desired work directly; an explicit canonical `(appId, taskId)`
task wake address persists a trigger and wakes only that task; stored Conditions
wake only their exact matching task IDs; and facts with no obligation remain
observations. A resolved intent and matching Conditions may be admitted together
as one task-family route. No second `inbox.accepts` selector surface is
introduced.

`target.taskId` is reserved for delivery to a task. A task ID that identifies
the subject or correlation of a lifecycle fact belongs in event data and does
not imply a wake. Legacy lifecycle producers that still overload the target are
classified explicitly during migration and normalized before the compatibility
classifier is removed.

Task routing is durable admission, not an in-memory queue handoff. The host
persists the resolved `TaskIntent` and event-derived trigger before it
acknowledges delivery, then coalesces/enqueues execution. Recovery scans durable
task state, so a crash between persistence and enqueue cannot lose the wake.
One event may select routes in several Apps. Every selected continuation must
be durably admitted before composite acknowledgment; partial success is retried
idempotently. A durable route failure, missing exact target, or target/resolver
mismatch remains pending and cannot be masked by another App, an ordinary
subscriber, or observation fallback.

No event is allowed to be consumed by both legacy and canonical actionable
paths. During migration, route ownership is selected per App and per route with
a tested compatibility flag; there is never dual consumption.

## Persistence and state migration

### Inbox state

The existing `app_inbox_items` and delivery tables remain canonical. No rewrite
is required. Schema changes are additive and versioned.

### Task state

Existing `.state/tasks/state.json`, task IDs, generations, attempts, Conditions,
and projections remain valid. Extraction moves the code boundary, not the
stored meaning.

Each App migration runs a read-only compatibility audit:

- state parses under the canonical task types;
- root and parent links are valid;
- active attempts have recoverable leases/session evidence;
- open Conditions reference valid tasks;
- workflow bindings resolve;
- no canonical App ID change would orphan state.

Only an explicit versioned migration command may mutate stored task schema. It
writes an atomic backup, new state, projection, and migration receipt.

### Event and event-pair state

Historical events and pairs remain readable until retention removes them. No
backfill makes them authoritative App work. New canonical requests never create
owner-inbox pairs. Read models mark historical owner-inbox records as legacy.

After the last live legacy pair is resolved or expired, owner-inbox commands,
queries, GC, graph special cases, and dashboard counters are deleted.

## Observability

Canonical health comes directly from App/task authorities.

### App inbox metrics

- pending and ready count;
- oldest pending age;
- claim latency;
- active and expired leases;
- handling duration;
- attempt success/failure/interruption;
- disposition count by type;
- reclaim count and rate;
- dependency wait age;
- delivery pending/uncertain/failure age.

### Task metrics

- runnable/running/waiting/attention task count;
- queue and reconciliation latency;
- attempt duration and failure reason;
- stale-result rejection;
- lease reclaim and repair;
- Condition age and review wake;
- workflow/owner fallback frequency;
- convergence duration.

Metrics are projections. Alerts emit facts that can wake an App/task through a
declared route; metrics never mutate work directly.

### Required diagnostic identity

Every App input, owner attempt, child delegation, task attachment, task attempt,
workflow run, delivery operation, and external receipt carries stable parent
identity. Traces help explain causality but are not required to reconstruct
current ownership.

## Migration strategy

The migration is incremental by App and route, but the destination is not
optional compatibility. Every phase has an entry gate, an exit gate, and a
deletion.

### Phase 0 — Freeze the target and inventory

Deliverables:

- accept this proposal;
- classify every legacy SDK export and consumer as public authoring,
  host-internal, maintenance-only, or delete;
- classify every legacy App event as inbox input, task correlation, exact task
  wake, observer fact, or non-actionable lifecycle fact;
- record current state/read-model compatibility fixtures.

Exit gate:

- no unresolved ownership semantics;
- every production legacy import has a target contract;
- no implementation phase needs a new generic escape hatch.

Deletion:

- obsolete accepted design claims are replaced or explicitly marked
  superseded.

Rollback:

- documentation/inventory only.

### Phase 1 — Canonical SDK and definition validation

Deliverables:

- complete `AppDefinition` with subscriptions, schedules, observers, actions,
  workspace, and optional tasks;
- canonical task authoring/result names and pure helpers;
- capability-scoped observer/workflow contexts;
- public contract tests and compile-time forbidden-export tests;
- a compatibility converter from `ProjectApp` to an internal prepared canonical
  definition, used only by the host.

Exit gate:

- a canonical App can express all preserved behavior without importing
  persistence or controller mechanics;
- root SDK remains small and stable;
- existing runtime behavior is unchanged.

Deletion:

- duplicate public event/selector types and aliases that no consumer needs.

Rollback:

- remove additive contracts; no live route changes.

### Phase 2 — One registry generation and prepared host

Deliverables:

- canonical loader reads `app.ts` only for migrated Apps;
- prospective snapshot validation and transactional prepare/commit reload;
- task controller preparation consumes the same registry generation;
- `AppAdmission`, `AppReconciler`, `AppTaskRuntime`, and `AppDelivery` boundaries
  exist behind the current runtime facade;
- compatibility Project Apps are adapted during prepare, not installed through
  a second independent registry.

Exit gate:

- reload failure leaves the complete old generation active;
- no component observes a split App/task registry;
- startup and shutdown ordering tests pass.

Deletion:

- independent Project App descriptor publication and duplicate watcher reload.

Rollback:

- select the previous registry generation implementation; stored state remains
  compatible.

### Phase 3 — Canary and evaluation migration

Order:

1. `evaluation-canary-worker` proves subscription, batching, delegation, and
   delivery semantics.
2. `evaluation.app` migrates because its routes are rich enough to prove the
   design but smaller than AKS.

Deliverables:

- merge `evaluation.app/inbox.ts` into its canonical `app.ts`;
- classify schedules as correlated App inputs, task-wake events, or scheduled
  observers;
- convert task events to task subscriptions and exact wakes;
- convert imperative `onEvent` paths to pure subscription translation or
  observers;
- migrate workflows to canonical task/execution results and scoped reads;
- migrate maintenance scripts to the maintenance CLI.

Exit gate:

- every evaluation actionable event has exactly one canonical authority;
- restart, reload, task recovery, and human/agent delivery canaries pass;
- no evaluation production import uses `@may-agent/sdk/legacy`.

Deletion:

- evaluation compatibility descriptor and legacy event router entries.

Rollback:

- restore the App's route ownership to the compatibility adapter before any
  canonical consumption; do not dual-consume.

### Phase 4 — May conversation and platform migration

Deliverables:

- move conversation definition to `may.app/app.ts`;
- migrate `may-agent.app/app.ts` to canonical platform App;
- convert platform schedules, metric subscriptions, actions, and tasks;
- make May-to-platform work an explicit delegation;
- remove project-comment filesystem mutation from the command router and admit
  it through the target App.

Exit gate:

- every ordinary human request has one May inbox item;
- platform work has a `may-agent` inbox item or task;
- no May bridge, break-glass, generic owner fallback, or platform
  `defineProjectApp` path remains;
- conversation ordering and restart delivery tests pass.

Deletion:

- `may-agent.app/inbox.ts`, legacy May/platform routing, and command-router
  project mutation.

Rollback:

- canonical May inbox remains authoritative; only platform route ownership may
  return to the compatibility adapter.

### Phase 5 — AKS RP E2E migration

This is last because it has the broadest event/task policy and active workspace
changes.

Deliverables:

- reconcile current uncommitted AKS work before touching overlapping files;
- merge `aks-rp-e2e.app/inbox.ts` into canonical `app.ts`;
- classify every event selector and `routeAksEvent` branch;
- migrate schedules, observers, actions, and task correlation;
- move task authoring types and workflow results to the canonical SDK;
- replace direct task-tree mutation in ordinary workflows with returned task
  actions or scoped host reads;
- migrate explicit maintenance scripts to the maintenance CLI;
- preserve task IDs, task state, workspace lineage, and concurrency policy.

Exit gate:

- state compatibility audit passes against the live AKS task tree;
- focused watcher, workflow, task-reconciler, reload, recovery, and integration
  suites pass;
- no AKS production import uses `@may-agent/sdk/legacy`;
- event-route coverage proves exactly one owner for every previous branch.

Deletion:

- AKS compatibility descriptor and legacy event-router branches.

Rollback:

- roll route ownership back as one unit before canonical consumption; preserve
  task state and generation fences.

### Phase 6 — Runtime and SDK deletion

Deliverables:

- migrate remaining host imports from the legacy barrel to private runtime
  modules;
- move task persistence/runtime modules out of the public SDK package surface;
- delete `defineProjectApp` and legacy Project App context;
- delete `@may-agent/sdk/legacy` export;
- delete owner-inbox creation/review/expiry, event-pair request lifecycle, old
  read-model branches, and orphan GC that only serves that path;
- rename remaining internal `ProjectApp*` task mechanics to `AppTask*` where the
  name describes the canonical capability;
- simplify command router and runtime facade after old paths disappear.

Exit gate:

- repository-wide search finds no production or test legacy SDK import;
- no second App loader, descriptor registry, or event router exists;
- full tests, type checking, restart/reload fault injection, and deployed
  canaries pass;
- historical read-only compatibility is either unnecessary or isolated in one
  archival projection.

Deletion:

- all compatibility code and flags.

Rollback:

- none after deletion is merged; the preceding release must remain deployable
  until the post-migration canary window closes.

### Phase 7 — Canonical documentation and closeout

Deliverables:

- rewrite System Model, Architecture, Runtime, Agent App, SDK, Events,
  Escalation, Message Lifecycle, manual authoring, and operations documents;
- archive superseded alternatives and migration trackers;
- publish one App-author quickstart and one operational recovery guide;
- record final before/after inventory and remove temporary migration metrics.

Exit gate:

- accepted documents describe only implemented behavior;
- a new App author needs one manifest, one SDK entry point, and one mental model.

## Test strategy

### Contract tests

- canonical definition validation;
- selector matching and pure translation;
- action/schedule input validation;
- forbidden SDK exports/imports;
- compatibility conversion during migration only.

### Inbox tests

- idempotent admission for every ingress kind;
- conversation ordering and concurrency;
- batching compatibility;
- lease renew/reclaim and stale-generation rejection;
- partial batch disposition admission;
- delegation and child wake;
- task attachment race closure;
- restart recovery;
- delivery completed, failed, uncertain, and retry paths.

### Task tests

- state compatibility with existing fixtures;
- intent observation and stable IDs;
- targeted wake isolation;
- queue fairness and capacity;
- attempt/session fencing;
- Condition observation and timeout review;
- handler/workflow/owner resolution;
- verification and stale result handling;
- workspace recovery and cleanup;
- restart repair.

### Registry/reload tests

- prospective invalid definition leaves old generation active;
- missing owner/workflow leaves old generation active;
- removal with unfinished inbox/task work is rejected;
- prepare failure does not partially publish routes/controllers;
- in-flight old-generation results are safely admitted or rejected by fences;
- schedule/observer subscriptions do not duplicate across reload.

### Route-ownership tests

For every migrated App, maintain a table-driven fixture of representative
events. Each fixture must assert exactly one outcome:

- App inbox admission;
- task intent admission;
- exact task wake;
- observation only; or
- explicit rejection/unhandled status.

Zero and multiple actionable consumers are failures.

### End-to-end canaries

- Hao -> May -> direct answer -> delivery receipt;
- Hao -> May -> project App -> child result -> May review -> delivery;
- App -> App -> reply;
- scheduled App input and scheduled task-wake event;
- observer fact -> task wake;
- task workflow -> Condition -> external fact -> convergence;
- restart during inbox owner attempt;
- restart during task attempt;
- reload with active work;
- uncertain external delivery.

## Safety and rollback rules

1. Never dual-consume one actionable event.
2. Never acknowledge durable admission before its inbox/task state exists.
3. Never change an App ID or task ID as an incidental code migration.
4. Never rewrite task state without backup, lock, validation, and receipt.
5. Never publish a partial registry generation.
6. Never delete compatibility until production imports are zero and canaries
   have passed through restart/reload.
7. Prefer additive adapters before route movement and deletion immediately
   after the route proves stable.
8. A rollback switches route ownership as a unit; it does not enable both
   owners.

## Risks and mitigations

### Canonical definition becomes too large

Mitigation: one manifest may import domain modules. “One definition” means one
identity and load boundary, not one monolithic file.

### Task engine rewrite introduces regressions

Mitigation: extract it behind `AppTaskRuntime` without changing storage or
reconciliation semantics first. Rename and simplify only after parity.

### Subscriptions become hidden application execution

Mitigation: translators are pure, capability-free, schema-validated, and
idempotently admitted. Judgment occurs only in the owner attempt.

### Observer capabilities recreate raw SDK access

Mitigation: adapters receive named bounded ports. Raw SQL and global mutation
remain host-private. Add a projection only when a concrete observer requires
it.

### Reload splits App and task configuration

Mitigation: prepare and atomically publish one immutable registry generation;
task controllers and routes are part of that generation.

### Migration stalls with permanent compatibility

Mitigation: every phase includes a deletion, production legacy-import count is
a release metric, and the legacy package has no new exports.

### Active AKS changes conflict with migration

Mitigation: migrate AKS last, first reconcile its current worktree, and avoid
mechanical import churn until its canonical route table is reviewed.

## Completion criteria

The migration is complete only when all of the following are true:

- every App has exactly one canonical `app.ts` definition;
- `may` and `may-agent` are explicit separate Apps;
- one registry generation owns definitions, routes, schedules, observers, and
  task controllers;
- every addressed request is authoritative in an App inbox;
- every durable desired outcome is authoritative in an App task;
- events and metrics are facts/wakes, not alternate work authorities;
- every App subscription, schedule, and action admits through the canonical
  host;
- the task engine is host-private and consumes canonical App definitions;
- no application or runtime file imports `@may-agent/sdk/legacy`;
- `defineProjectApp`, the legacy SDK export, duplicate App loaders, generic
  owner-inbox request handling, and legacy event-driven App execution are
  deleted;
- restart/reload and route-ownership suites pass;
- accepted design documents and manuals describe the implemented canonical
  model only;
- deployed canaries demonstrate direct answer, delegation, task convergence,
  restart recovery, and safe delivery.

## Immediate implementation slice

The first reviewable implementation slice is intentionally narrow:

1. add canonical definition types for subscription translation, schedules,
   actions, workspace, and task policy without changing live routing;
2. add validation and contract tests;
3. introduce a prepared immutable registry generation shared by App inbox and
   task compatibility adapter;
4. prove transactional reload failure leaves the old generation active;
5. migrate the evaluation canary to `app.ts` and delete its duplicate
   definition;
6. review the resulting boundary before moving production evaluation routes.

This slice proves the architecture while preserving all existing live App and
task state.
