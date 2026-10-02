# Canonical Agent App Migration

**Historical context:** [App Contract](../../2a-design/agent-app.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Implemented; staged rollout completed 2026-08-16
**Decision owner:** Hao
**Last reviewed:** 2026-08-16
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

## Target implementation outcome

- Every App has one `defineApp(...)` declaration and one registry/host path.
- App Inbox is the only authority for addressed work.
- The optional App task capability is the only authority for durable desired
  work and wakes attached requests through `app.dependency.completed`.
- `defineProjectApp`, `@may-agent/sdk/legacy`, duplicate App loaders/routes, and
  live owner-inbox/event-pair work authority are removed.
- Applications use typed App inputs, subscriptions, schedules, observers,
  actions, task policy, and capability-scoped workflows.

## Rollout outcome

The source migration and the production rollout temporarily diverged on
2026-08-16. The canonical Runtime commit removed the legacy SDK before the
canonical Apps branch was merged. The deployed Apps still imported
`@may-agent/sdk/legacy`, so an automated `app-ops` recovery task correctly
restored a staged compatibility boundary to recover service operation. That
repair was operationally valid, but it does not change the accepted target.

The compatibility restoration was a rollout bridge, not completed architecture.
The migration completed through three independently reviewed releases in this
order:

1. a transition Runtime that supports both already-canonical Apps and the
   remaining deployed legacy declarations;
2. the canonical Apps cutover, after every App passes against the exact
   transition Runtime artifact;
3. a Runtime deletion release that removed the bridge after deployed canaries
   proved that production had no legacy consumers.

Permanent restart recovery, task routing, and attempt-recovery fixes discovered
during the staged rollout remain part of the canonical Runtime. Compatibility
exports, declaration adapters, and legacy action/schedule branches were removed
in Release C.

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
Evaluation, May, and AKS now use the single declaration and host. No external
App retains the duplicate architecture.

The result works, but it leaves several questions with two answers:

- Which file defines an App?
- Is an actionable event owned by an inbox item, an event pair, or a task?
- Does an event invoke `onEvent`, create a task, or enter an App inbox?
- Is the public SDK the root package or the legacy package?
- Does reload publish one App snapshot or coordinate two partially committed
  snapshots?
- Is May an App or a bridge outside the App model?

The canonical design gives every question one answer.

## Migration baseline (historical)

The inventory is intentionally recorded by responsibility rather than a
volatile line count.

### Canonical core present at migration start

- `AppRegistry` loads durable App addresses unconditionally.
- `AppInboxStore` persists `pending -> handling -> done` independently of event
  retention.
- `AppInboxHost` validates input, fences claims, invokes the owner, and admits
  `complete`, `delegate`, or `task` dispositions.
- The App runtime provides fair scheduling, restart recovery, explicit
  dependency wakes, and an outbox for human and agent delivery.
- Human input and explicit human-decision events are admitted to the separate
  canonical `may` App.
- The root `@may-agent/sdk` entry point is capability-scoped and does not expose
  raw database or task-store mutation.

### Legacy implementation active at migration start

The runtime had production imports from `@may-agent/sdk/legacy` for:

- loading and hosting `defineProjectApp` definitions;
- task tree storage and projection;
- task action admission and reconciliation;
- Condition tracking and review;
- task workspace preparation and cleanup;
- task recovery and controller startup;
- HTTP/read-model compatibility;
- process identity and older workflow helpers.

At migration start, the May conversation App, may-agent platform App, and
Evaluation App used one canonical manifest and the root authoring SDK.
Evaluation session aftermath emitted `evaluation.recorded` instead of writing
the runtime database or host-owned session paths. The separate `may.app/app.ts` translated
`evaluation.human_decision.requested` into one validated May inbox obligation
without merging conversation policy into the platform App.

The remaining external legacy production consumers were in `aks-rp-e2e.app`:
its `app.ts`, watchers, workflows, task helpers, and maintenance scripts used
the legacy declaration and authoring boundary.

Many imports are only names from the old barrel. Others are real capability
violations, especially direct task-store reads/writes, raw SQL observer access,
and arbitrary `onEvent` execution.

### Legacy behavior selected for deletion

- `defineProjectApp` as a second App declaration.
- A second Project App descriptor registry.
- Top-level `events` plus imperative `onEvent` as an actionable-work path.
- New owner-inbox/event-pair creation for addressed App messages.
- Generic owner fallback that treats visibility as handling.
- Direct App task-state mutation from ordinary workflows.
- Public access to runtime filesystem layout, SQLite, claims, leases, recovery,
  controller, and persistence helpers.
- Duplicate reload/install/watcher paths for the same App.

### Behavior selected for preservation

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

| Layer           | Owns                                                                                                              | Must not own                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Infrastructure  | event persistence, database, timers, transports, process lifecycle, execution engine, metrics storage             | domain judgment or desired outcomes                       |
| App host        | definition loading, admission, claims, leases, bounded invocation, recovery, task-capability attachment, delivery | App-specific policy                                       |
| App             | input meaning, subscriptions, task correlation, schedules, actions, owner identity, workspace policy              | generic retry/recovery/delivery loops                     |
| Owner agent     | one bounded judgment/execution move and a typed disposition                                                       | durable polling or hidden background ownership            |
| Task reconciler | desired/observed task state, Conditions, attempts, verification, convergence                                      | human conversation or arbitrary message routing           |
| Observer        | collect current facts and emit observations                                                                       | create hidden durable ownership                           |
| Workflow        | reusable bounded execution                                                                                        | direct inbox/claim mutation or global task-store mutation |

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

  observations: ["project.task.reconciled"],

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
in App `subscriptions`. An event carrying an explicit task target does not call
`tasks.resolve`: it records a trigger against the existing exact task and wakes
only that task. Neither path creates inbox work.

#### `observations`

`observations` is the reviewed exact selector catalog for facts that
intentionally create no App inbox item or task. The host evaluates every
actionable route first, then records a durable `noop` receipt when a selector
matches and zero work routes were selected. This keeps application event names
in App definitions rather than in the core EventBus. It is diagnostic
classification, not another subscriber or work authority.

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

| Contract              | Question                                                          |
| --------------------- | ----------------------------------------------------------------- |
| `AppDisposition`      | What should happen to this addressed inbox request?               |
| `TaskReconcileResult` | What observed result and next state applies to this desired task? |
| `ExecutionResult`     | How did this bounded agent/workflow execution end?                |
| `AppEvent`            | Which fact should observers and owners be able to react to?       |

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
generation. A boot-unique snapshot ID accompanies the process-local generation
whenever the identity is persisted; generation numbers alone restart at one and
cannot identify a historical selector snapshot.

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

Event delivery uses the same fence. Before admitting any selected continuation,
the host durably records the complete set of validated per-App admission
commands chosen by that registry snapshot. A partially admitted event is
replayed from those commands, not reclassified by a newer manifest. This record
is the durable delivery obligation until admission finishes, not a domain-work
authority; durable work ownership still begins only in the destination inbox
item or task. It carries the boot-unique snapshot ID, diagnostic generation,
and a versioned payload interpreted by stable host-owned admission primitives.
Explicit migration may supersede a pending command, but ordinary reload cannot
change inbox work into task work, silently drop an App obligation, or create
both for one source event.

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

| Current behavior                                 | Canonical behavior                                 |
| ------------------------------------------------ | -------------------------------------------------- |
| Human/App addressed message                      | App inbox admission                                |
| Typed action emits an actionable event           | Action creates App input                           |
| Schedule represents a distinct review obligation | Input schedule creates App input                   |
| Schedule wakes deterministic desired work        | Event schedule publishes fact to task subscription |
| Schedule polls provider and emits facts          | Scheduled observer emits facts                     |
| Event `onEvent` performs bounded domain action   | Subscription creates App input; owner handles it   |
| Event deterministically resolves desired task    | Task subscription resolves task intent             |
| Event targets exact task/Condition               | Exact task wake, no App inbox item                 |
| Lifecycle/log/projection event                   | Persist/observe only                               |
| Unknown addressed App                            | reject and retain visible admission failure        |
| Unknown unaddressed event                        | unhandled observation; no owner work synthesized   |

The route is exclusive per newly created App obligation. Canonical App
`subscriptions` translate addressed work into an inbox input, while
`tasks.subscriptions` resolve deterministic desired work directly; one event
must not select both for the same App. Stored Conditions are additive exact
wakes for already-authoritative tasks, so they may accompany either an inbox
admission or a resolved task intent without creating dual ownership. An
explicit canonical `(appId, taskId)` wake address bypasses broad inbox and task
resolution, persists a trigger, and wakes only that task, including a matching
Condition on that task. Facts with no obligation remain observations. No second
`inbox.accepts` selector surface is introduced.

Observation-only is a terminal delivery disposition, not missing ownership.
Reviewed exact selectors live in App `observations`, never in a core EventBus
catalog. After all actionable routes succeed, a matching fact with no selected
work receives a durable no-op receipt containing the registry snapshot and
creates no inbox or task. A task resolver returning `null` removes only that
App's deterministic task obligation; it does not globally acknowledge a fact
unless an installed observation contract matches. This never masks an
addressed-input failure, exact-target failure, or resolver failure.

At closeout, persistence and route admission are separate statuses. An ordinary
unaddressed fact records that a registry snapshot selected zero routes, while
an addressed input, exact target, or contract-declared expected route must be
durably admitted. Reviewed contracts may declare required delivery, but core
event persistence has no application event catalog and application event names
do not accumulate in runtime source.

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
idempotently. A durable route failure, missing exact target, or invalid task
admission remains pending and cannot be masked by another App, an ordinary
subscriber, or observation fallback.

One delivery attempt evaluates one installed immutable App-registry snapshot
and persists its validated per-App admission commands before dispatch. Replay
completes those commands even after reload. The commands are delivery fences,
not a second domain-work authority; inbox items and tasks remain the only work
authorities. A boot-unique snapshot ID prevents a process-local generation from
being confused with a later process's generation, and a payload version keeps
the host replay contract explicit. An intentional migration must explicitly
supersede a still-pending command and record its replacement. Reload and
delivery diagnostics expose snapshot identity, generation, route identity,
admission state, and any supersession.

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

## Executable rollout plan

The rollout is one migration with three release PRs. The PRs are ordered by
artifact compatibility, not by which branch was authored first.

### Release A — Transition Runtime

Purpose: publish the complete canonical host while retaining the smallest
temporary boundary needed to load the currently deployed Apps.

The release keeps these rollout-discovered fixes permanently:

| Commit     | Disposition | Reason                                                             |
| ---------- | ----------- | ------------------------------------------------------------------ |
| `78c04869` | keep        | Requeues late workflow results after restart.                      |
| `9ff2f6ac` | keep        | Routes an unbound App task owner to the App root.                  |
| `0ffb8fa6` | keep        | Recovers expired attempts whose owner session is already terminal. |

The following work is explicitly temporary:

| Commit or hunk                                | Disposition after Release B | Reason                                                                        |
| --------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| `6c52c8f3`                                    | delete                      | Restores `@may-agent/sdk/legacy` and retired public SDK modules.              |
| `9c17ac0b`                                    | delete                      | Adapts `ProjectApp` declarations at the canonical loader boundary.            |
| legacy portions of `ce175615`                 | delete                      | Resolves legacy SDK imports and retains legacy schedule projection.           |
| generic import-option support from `ce175615` | keep                        | Enables exact-artifact App loading in verification.                           |
| `9fa73355` and `bb0cb08a`                     | delete                      | Emit events for adapted legacy actions; canonical actions admit typed inputs. |

Entry gate:

- the Runtime branch is clean and based on current Runtime `main`;
- all compatibility code is labeled as a transition boundary in source and
  has a deletion test/issue tied to Release C;
- no compatibility change weakens validation for canonical declarations.

Exit gate:

- Runtime and SDK type checks and complete tests pass;
- every currently deployed App loads through the real loader from the exact
  staged SDK artifact;
- restart, reload, task recovery, and action/schedule compatibility tests pass;
- one correlated deployment loads the requested artifact, remains healthy,
  and preserves current App/task state.

Rollback: redeploy the preceding Runtime artifact. App route ownership is not
changed in this release.

### Release B — Canonical Apps

Purpose: move all production consumers to `defineApp(...)` and the root,
capability-scoped SDK while the transition Runtime can still load the preceding
Apps artifact during rollback.

Before integration, current operational App changes are committed and reviewed
on their own branch. The migration is reconciled with those commits in a clean
worktree; the dirty live checkout is never rebased, reset, or used as an
integration surface.

Entry gate:

- Release A is deployed and healthy;
- the canonical Apps branch contains all accepted operational fixes made since
  its merge base, without silently dropping current dirty work;
- every previous event route has a reviewed canonical owner.

Exit gate:

- repository-wide production and test search finds no
  `@may-agent/sdk/legacy` or `defineProjectApp` consumer;
- all Apps load through canonical validation against the exact deployed
  Release A SDK bytes;
- each App's local type check and complete test suite passes;
- route-ownership, task-state compatibility, restart/reload, direct answer,
  delegation, task convergence, and safe-delivery canaries pass;
- deployed observations prove one authority per actionable route and no
  duplicate schedules, observers, inbox items, or task workers.

Rollback: restore the preceding Apps artifact as one unit while Release A still
provides compatibility. Do not enable legacy and canonical route consumption
simultaneously.

### Release C — Runtime deletion

Purpose: make the accepted architecture true in source after the canonical Apps
have completed their canary window.

Deliverables:

- remove the `./legacy` SDK export and all modules restored only for it;
- remove the legacy declaration adapter and loader branch;
- remove legacy schedule projection and runtime import resolution;
- remove the legacy action emission branch and compatibility-only host APIs;
- retain exact-artifact canonical App loading as a release gate;
- add a cross-repository guard that fails if a legacy import, export, adapter,
  or `defineProjectApp` declaration returns.

Entry gate:

- Release B is deployed and has passed restart and reload canaries using live
  retained state;
- runtime telemetry reports zero legacy declarations loaded and zero legacy
  action/schedule invocations for the agreed canary window;
- the Release A artifact remains available for rollback.

Exit gate:

- full Runtime, SDK, Apps, integration, and fault-injection suites pass against
  exact Release C bytes;
- source and built artifacts contain no legacy App authoring boundary;
- accepted design documents describe the code that is actually deployed.

Rollback: redeploy the retained Release A transition artifact. Never restore
individual compatibility branches into Release C source during an incident;
diagnose against the known transition release and prepare a bounded repair.

### Ownership and branch discipline

- the migration coordinator owns release ordering and the integration branches;
- the `may-agent` platform owner owns Runtime compatibility, Runtime deployment,
  and Release C deletion;
- each App owner owns its canonical declaration, routes, and canary evidence;
- project-local `app-ops` may diagnose a Runtime compatibility failure and
  create a platform repair request, but does not commit to the Runtime migration
  branch or broaden its own project task into a sibling-repository migration;
- every implementation task uses a dedicated clean worktree and branch;
- deployment consumes an immutable reviewed commit, never whatever branch is
  currently checked out in a shared operational workspace;
- a temporary bridge must name its deletion release and measurable removal
  condition when introduced.

### Stop conditions

The migration pauses rather than improvising another compatibility layer when:

- an App cannot express required behavior through the accepted canonical
  contracts;
- route ownership is ambiguous or a test observes dual consumption;
- current operational changes have not been reconciled into Release B;
- the exact staged artifact differs from the reviewed commit;
- state compatibility, restart recovery, or rollback cannot be proven.

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
- durable per-event/App admission commands fence route kind and validated
  payload across partial admission, restart, and registry reload;
- `AppAdmission`, `AppReconciler`, `AppTaskRuntime`, and `AppDelivery` boundaries
  exist behind the current runtime facade;
- compatibility Project Apps are adapted during prepare, not installed through
  a second independent registry.

Exit gate:

- reload failure leaves the complete old generation active;
- no component observes a split App/task registry;
- partial event admission followed by reload completes the originally selected
  commands without inbox/task dual ownership or a dropped App obligation;
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

- create `may.app/app.ts` from the former May inbox definition and add explicit
  subscriptions for human-decision requests such as
  `evaluation.human_decision.requested`;
- migrate `may-agent.app/app.ts` to canonical platform App;
- convert platform schedules, metric subscriptions, actions, and tasks;
- make May-to-platform work an explicit delegation;
- remove project-comment filesystem mutation from the command router and admit
  it through the target App.

Exit gate:

- every ordinary human request has one May inbox item;
- Evaluation human-decision events produce one May inbox item and retain their
  dedupe and response lineage;
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
- replace ordinary workflow reads of raw task persistence with direct-child
  reconciliation facts or the bounded App live-task health snapshot;
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
- replace the hand-maintained core observation-event list with distinct
  persisted-versus-routed status or a generated reviewed contract catalog;

Exit gate:

- repository-wide search finds no production or test legacy SDK import;
- no second App loader, descriptor registry, or event router exists;
- core runtime source has no growing application-owned observation-event list;
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
- partial multi-App admission followed by reload completes the frozen route
  commands and cannot change one App from inbox to task ownership;
- prepare failure does not partially publish routes/controllers;
- in-flight old-generation results are safely admitted or rejected by fences;
- the process-scoped durable App event route and schedule scan loop do not
  duplicate across successful or failed reload;
- late observer results from a superseded generation remain fenced.

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

## Implementation and merge criteria

The migration is complete only when all of the following are true:

- every App has exactly one canonical `app.ts` definition;
- no second service/plugin loader, cross-App live service registry, or generic
  runtime capability injection exists beside that definition;
- `may` and `may-agent` are explicit separate Apps;
- one registry generation owns definitions, routes, schedules, observers, and
  task controllers;
- every addressed request is authoritative in an App inbox;
- every durable desired outcome is authoritative in an App task;
- events and metrics are facts/wakes, not alternate work authorities;
- every App subscription, schedule, and action admits through the canonical
  host;
- the task engine is host-private and consumes canonical App definitions;
- ordinary App workflows do not read task persistence; direct-child decisions
  use child/receipt facts and App-wide health review uses the capped,
  truncation-aware live snapshot;
- no application or runtime file imports `@may-agent/sdk/legacy`;
- `defineProjectApp`, the legacy SDK export, duplicate App loaders, generic
  owner-inbox request handling, and legacy event-driven App execution are
  deleted;
- restart/reload and route-ownership suites pass;
- accepted design documents and manuals describe the implemented canonical
  model only;
- runtime subsystem composition is host-private and explicitly wired; every
  long-lived effect has a process or registry-generation owner, repeated
  reload does not duplicate process-scoped adapters, and genuinely
  generation-scoped attachments have deterministic teardown;
- direct answer, delegation, task convergence, restart recovery, and safe
  delivery paths have deterministic integration or end-to-end coverage.

## Post-merge rollout gate

Production rollout is complete only after deployed canaries demonstrate direct
answer, delegation, task convergence, restart recovery, reload, and safe
delivery against retained live state. This is a deployment gate, not a reason
to retain a second App model in source.

## Pre-reconciliation evidence (2026-08-16)

The following evidence established functional parity before staged deployment,
but it is not current merge-readiness evidence. Later operational recovery
restored the legacy SDK, loader adapter, and legacy action/schedule branches on
the Runtime migration branch, while current operational App fixes diverged from
the canonical Apps branch. Releases A, B, and C must regenerate their own
artifact-specific evidence.

- The paired runtime worktree passes both TypeScript gates and 2,196 tests with
  `MAY_AGENT_APP_ROOT` bound to this Apps worktree.
- The six migrated Apps pass their complete local checks. AKS passes 633 tests,
  its two workflow-input tests, and current-bundle verification.
- Repository-wide Apps typecheck, the 350-test default App health suite, and
  May design integrity all pass.
- Live source contains no `defineProjectApp`, `@may-agent/sdk/legacy`, parallel
  `inbox.ts`, retired App loader, or task-tree CLI authoring guidance.
- Both migration branches contain their current integration bases and pass
  `git diff --check`.

## Completed rollout evidence (2026-08-16)

All source, artifact, deployment, and live-canary gates completed in release
order. The hashes below identify the immutable evidence; no shared dirty
checkout was used as a build or integration source.

### Release A — transition Runtime

- Runtime PR 48 merged the transition host at merge commit `13d0225a`; the
  reviewed transition source ended at `ca172fcc`.
- Runtime PR 49 then merged the permanent typed-action admission fix at
  `96c299b9`; its reviewed source commit was `5eb507ef`.
- The retained immutable Runtime source is
  `/app/.state/releases/runtime/5eb507efedff9709e35a8d3386964ae275763703`.
  Its deployed image was `localhost/may-agent:runtime-5eb507ef`, image ID
  `sha256:886ac2aabff3c5bb922cbe4c4e39d70f0de4234d924547dea5bd2c551aecfdc8`.
- The transition SDK tree SHA-256 was
  `afc424fc18b839ae15221ea89671d5342279e9b6bbd6a856e22a40c908f212f1`.
  The exact-artifact loader accepted all seven canonical Apps.

### Release B — canonical Apps

- Canonical Apps merged at
  `0d311f9f27718ac431b51caabf53d77e1caabb16`. The immutable Apps source is
  `/app/.state/releases/apps/0d311f9f27718ac431b51caabf53d77e1caabb16`.
- The deployment mounted these seven App definitions read-only, with nested
  writable state mounts: `aks-rp-e2e`, `evaluation`,
  `evaluation-canary-worker`, `gym`, `may`, `may-agent`, and
  `scout-knowledge-lib`. The sibling Gym catalog was also mounted read-only.
- The exact SDK path was pinned with `MAY_AGENT_SDK_ROOT`; it was never resolved
  from a mutable checkout. Shared App/task concurrency was set to four because
  two long AKS attempts at the default of two prevented the independent May and
  Evaluation canaries from making progress.
- Reload and multiple recreate/restart checks retained authoritative inbox and
  task state and returned healthy.
- Direct May item `app_82d46d95-2720-41f3-8860-8b5722d0f04a` returned
  `RELEASE_B_MAY_DIRECT_OK`.
- Delegation parent `app_54942b03-5830-4558-b51f-f8903366404a` created child
  `app_e10870b4-3cbe-4c96-8591-ddbcb43123af`; the child result woke the parent,
  which returned `RELEASE_B_DELEGATION_OK`.
- Safe-delivery item `app_fb1add31-9087-4c32-a543-159808202561` returned
  `RELEASE_B_SAFE_DELIVERY_OK`; delivery acknowledgment was persisted as event
  `5704665`.
- Task event `5704890` reconciled
  `ops/repair-review-project-app-typed-action-routing-20260816` to `converged`.
- Repeated canary observations reported zero loaded legacy declarations and no
  legacy-action inbox inputs. Event `5704577` remains as truthful evidence that
  malformed delivery metadata was rejected; the successful retry used a new
  idempotency key rather than editing history.

### Release C — deletion Runtime

- Runtime PR 50 merged the deletion release at
  `ac469750fb7eb91155c3115290256db302520638`; reviewed source commit
  `d0f0171a` removed the legacy SDK entry point, declaration adapter, loader
  provenance, action/schedule branch, import resolver, and transition metric.
- Runtime and SDK TypeScript checks passed. Complete Runtime CI passed 2,324
  tests in 235 files with zero failures while bound to the exact Release B Apps
  artifact. The cross-repository canonical boundary gate reported zero errors.
- The immutable Runtime source is
  `/app/.state/releases/runtime/ac469750fb7eb91155c3115290256db302520638`.
  The deployed image is `localhost/may-agent:runtime-ac469750`, image ID
  `sha256:669bef16381771bcfe331d25b2d1e757fb4886299e0a01be7b325a2cb35a995d`.
  The deployment override is
  `/app/.state/releases/deploy/canonical-agent-app-release-c-ac469750/compose.release-c.yml`.
- Exact post-merge loading reports `authoringBoundary: canonical`, seven Apps,
  and SDK tree SHA-256
  `df3aed63ca86fcce14543e188fdb317a5de0917b5d110e87b0807c9c7d222018`.
  The SDK has no `./legacy` export or `legacy.ts`, and the Runtime has no legacy
  declaration adapter.
- Reload request event `5705459` preserved the completed canary item. An
  explicit container restart preserved the same item and all seven App action
  routes. Under the active four-worker recovery burst, five-second readiness
  probes briefly timed out and Docker marked the container unhealthy; the
  daemon then answered control traffic and returned healthy without data loss,
  rollback, or operator repair.
- Direct May item `app_b1230722-fdf5-4f19-8ebb-c8d6580bf63e` returned exactly
  `RELEASE_C_MAY_DIRECT_OK`.
- Delegation parent `app_9d770ef5-25dc-4cce-866c-b01e51c9e732` created child
  `app_96818215-e63e-4da0-a116-d4fafe9fa282`; the child result woke the parent,
  which returned exactly `RELEASE_C_DELEGATION_OK`.
- Safe-delivery item `app_944b9f18-e5dd-4636-9ac5-3d8fbe920ee5` remained
  incomplete until its exact Web delivery was acknowledged. It then completed
  with `RELEASE_C_SAFE_DELIVERY_OK`; acknowledgment event `5705709` is linked to
  operation `app-delivery:app_944b9f18-e5dd-4636-9ac5-3d8fbe920ee5:1`.
- Natural task event `5705561` reconciled AKS task
  `domain/reconcile-direct-scenario-quality-app-routing-tests-app-routing-custom-domain-ingress-d2730241`
  to `converged` after the Release C cutover.

Operational reconciliation intentionally did not copy three obsolete legacy
mechanisms: task-action validation remains pure; Evaluation does not fall back
to host-private identities; and the workspace observer does not read a removed
preflight ledger or host-private task state.

### Post-rollout workflow compatibility repair

A post-rollout design-versus-code audit found that Release C loaded all App
manifests but did not compile every discoverable workflow against the exact
deployed SDK. The live `runtime/platform-owner-review` task therefore reached
`HandlerUnavailable`: its module still imported removed task-tree helpers and
used the host-private workflow context. Eight other failures were disabled
heartbeat modules whose agent manifests already declared `heartbeat: false`.

Apps commit `c71552f0e3cc6d7736db801df73de0de1e6060cc` repaired the active workflow
to use only `reconciliation`, bounded reads, scoped workspace paths, and
`agents.call`; deleted the eight disabled heartbeat modules; and extended the
final-Runtime gate to bundle every discoverable App workflow against the exact
paired SDK. The immutable artifact at
`/app/.state/releases/apps/c71552f0e3cc6d7736db801df73de0de1e6060cc`
loaded all seven Apps and, under that artifact's then-current discovery rules,
bundled 50 workflow entrypoints with zero errors. This is historical deployment
evidence, not the inventory for the later authoring-boundary closeout below.

The Apps-only recreate retained the Release C Runtime image and SDK. After
restart recovery, task generation 149 ran workflow
`platform-owner-review` through workflow run `wr_1786890910520_awge` and owner
session `s_1786890911368_4`; the attempt completed without a handler failure,
the task entered `waiting` with its generation observed, and the reconciler
admitted the proposed direct child
`correct-unhandled-signal-metric-taxonomy-20260816`. The container returned
healthy and the active `may-agent.app` mount resolved to the new immutable
artifact.

The rollout is complete. Release C remains the deployed canonical Runtime, the
post-rollout Apps repair is the deployed canonical Apps artifact, and the
retained Release A artifact is the unit Runtime rollback boundary. Compatibility
branches must not be restored into current source piecemeal.

### Post-rollout authoring-boundary closeout (source follow-up)

A deeper audit found a second weakness in the compatibility repair: successful
bundling proves import/export resolution but does not prove TypeScript contract
compatibility. Several active May workflows still used private context members
that a transpile-only bundle could accept, and two SQL-heavy operational
observers had been represented as workflows even though the canonical workflow
SDK intentionally has no unrestricted query or host-delivery capability.

The source follow-up closes that gap without widening the SDK:

- all active May workflows now use typed `ctx.input`, `ctx.reconciliation`,
  `ctx.agents.call`, `ctx.events.emit`, scoped workspaces, and
  `ExecutionResult`;
- operational health review and the daily operations digest are explicit
  host-private scheduled maintenance handlers, with their duplicate App
  schedules and task routes removed;
- handler source has a local structural host contract and test-only composition
  of Runtime-private query, metric, and SQLite services; and
- the completed one-time project-workflow fork generator and its pre-canonical
  seed are retired so no live script can manufacture workflows using the
  removed private context; and
- the final-Runtime gate mirrors Runtime workflow discovery, typechecks every
  discovered workflow and enabled handler against the exact paired SDK, then
  bundles every entrypoint.

Current source verification reports:

```text
Canonical Agent App integrity: 0 error(s); Apps + final Runtime
(48 workflows and 5 enabled handlers checked)

May App active suite: 102 pass, 0 fail, 389 expect() calls, 18 files
May App strict typecheck: pass
```

The verification above was pre-integration evidence. The immutable artifact
and live rollout evidence follows.

### Post-rollout authoring-boundary closeout deployment

The closeout was integrated on 2026-08-16 as Apps commit
`64bd497696b9e313d0ee937a3bfd75ffacf28862`. Its immutable Apps source is
`/app/.state/releases/apps/64bd497696b9e313d0ee937a3bfd75ffacf28862`;
tracked artifact files match that commit, and the artifact adds only installed
dependencies and empty nested `.state` mountpoints outside tracked source.

Artifact verification reproduced the pre-integration gates: the paired gate
checked 48 workflows and five enabled handlers with zero errors, the active May
suite passed 102 tests in 18 files with zero failures and 389 assertions, and
strict May and root TypeScript checks passed. The Release C exact-artifact
loader reported `authoringBoundary: canonical`, all seven Apps, and SDK tree
SHA-256 `df3aed63ca86fcce14543e188fdb317a5de0917b5d110e87b0807c9c7d222018`.
Two stale validation-only SDK paths discovered during this check were moved out
of the Runtime artifact, restoring the reviewed Release C SDK digest before
the rollout was closed.

The Apps-only deployment retained Runtime image
`localhost/may-agent:runtime-ac469750`, image ID
`sha256:669bef16381771bcfe331d25b2d1e757fb4886299e0a01be7b325a2cb35a995d`,
and the exact Release C SDK. Its compose override is
`/app/.state/releases/deploy/canonical-authoring-boundary-64bd4976/compose.apps-64bd4976.yml`.
All seven App definitions and the Gym catalog are mounted from the closeout
artifact read-only while their existing writable state mounts are retained.
The first create attempt stopped before process start because a Git archive
does not preserve ignored empty `.state` mountpoints; adding those empty
artifact-scaffold directories allowed the same reviewed bytes and compose
definition to start without changing persistent state.

Reload event `5716734` was accepted by the explicit runtime reload route with
no post-cutover `handler.load-failed` events. An explicit container restart at
`2026-08-16T15:40:59Z` retained completed and delivered May item
`app_944b9f18-e5dd-4636-9ac5-3d8fbe920ee5` and its exact
`RELEASE_C_SAFE_DELIVERY_OK` result. After restart, the newly host-private daily
operations digest completed as handler event `5716796`, and session recovery
completed as events `5716788` and `5716820`. Concurrent four-worker AKS
recovery again caused intermittent readiness timeouts without process exit,
state loss, handler load failure, or rollback.

### Post-rollout legacy-residue cleanup

A final active-source audit found two non-executing artifacts that the earlier
authoring-boundary gate did not reject: an unused
`may-agent.app/types/project-app.ts` shim re-exported the retired Project App
types outside that package's TypeScript include set, and an unreferenced
`ui.root-stale-20260710165437` snapshot remained in the live App root. The AKS
observer collectors also called a local accumulator `emit`, even though the
canonical adapter correctly returned the accumulated facts for host publication
only after a successful observer run.

Apps commit `8aaf03b514009b98b6a593509328c1b42ca12c9f` deleted both dead
artifacts, renamed the collector-local operation to `record`, and extended the
canonical integrity gate to reject retired `ProjectApp`,
`ProjectAppAction`, and `ProjectAppContext` authoring types. No runtime
contract, event shape, cadence, state path, or deployment image changed.

Source and immutable-artifact verification observed:

- zero design-integrity or canonical-boundary errors, with 48 workflows and
  five enabled host handlers checked against the exact final Runtime;
- 102 passing May App tests with 389 assertions;
- 661 passing AKS App tests with 2,236 assertions, plus 58 focused observer
  tests with 158 assertions;
- strict root, May App, and AKS App typechecks and AKS formatting; and
- exact-artifact loading of all seven canonical Apps against SDK tree SHA-256
  `df3aed63ca86fcce14543e188fdb317a5de0917b5d110e87b0807c9c7d222018`.

The immutable Apps source is
`/app/.state/releases/apps/8aaf03b514009b98b6a593509328c1b42ca12c9f`.
The Apps-only deployment kept Runtime image
`localhost/may-agent:runtime-ac469750` and uses
`/app/.state/releases/deploy/canonical-authoring-cleanup-8aaf03b5/compose.apps-8aaf03b5.yml`.
After the recreate at `2026-08-16T16:20:53Z`, Docker returned healthy with a
zero failing streak and the readiness endpoint returned `ready: true`.

Retained item `app_944b9f18-e5dd-4636-9ac5-3d8fbe920ee5` remained done with
the exact `RELEASE_C_SAFE_DELIVERY_OK` result. No post-cutover
`handler.load-failed` event was recorded. The renamed observer boundary
executed naturally after startup: workspace-integrity event `5717555`,
repo-ref events `5717556` and `5717557`, and scenario-inventory event
`5717561` were persisted from the new artifact.

While this evidence was being recorded, an autonomous repair committed
`f9824eb793304c801ce514bfb40e19677f1813fb`. It made the workspace observer
read `.state/tasks/tree.json` to infer live workspace ownership. The change was
not deployed: review found that it bypassed the bounded observer SDK and made a
runtime-owned projection App policy input. Corrective commit
`8a46aa1dd7` restored the deployed watcher implementation byte-for-byte,
clarified the accepted observer boundary, and added an integrity failure for
raw task-persistence reads from App watchers. The post-correction AKS suite is
the 661-test result above; production therefore already runs the corrected
behavior from artifact `8aaf03b514`.

### Post-rollout task-authoring simplification

The final design-versus-code audit found one remaining authority convention in
the Runtime rather than another durable store: handler actions could not create
or mutate IDs beginning with `runtime/`, although resolver- and action-authored
specifications otherwise use the same state lock, generation fence, and atomic
admission path. The separate proposal to persist an immutable task
specification manager would have added a second lifecycle distinction and an
ambiguous migration without removing a controller or storage authority.

Runtime commit `804b8a7a` removed the prefix exception and proved that
runtime-prefixed identities use the same self-update and child-creation rules
as every other task. The selected change, terminal direct-owner result
recovery, and human-recipient routing repair were integrated on Runtime `main`
at `d537af6b`. Runtime typecheck, the focused reconciler suite, the broader
Runtime/SDK tests, Apps design and root typechecks, and the exact paired gate
for 48 workflows and five enabled host handlers passed.

During integration review, unpublished commit `8a020aab` was deliberately
excluded. It translated a `metric.definition_changed` fact carrying arbitrary
`sourceQuery` text into a database mutation, recreating a generic query/control
escape hatch with no current caller. Metric definition changes remain explicit
host-owned configuration or bounded maintenance, not an App-emitted raw SQL
surface.
