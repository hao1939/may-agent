# App-Owned Runtime Simplification

**Historical context:** [App Contract](../../2a-design/agent-app.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Superseded and completed by `canonical-agent-app-migration.md`
**Scope:** Simplify the autonomous infrastructure by making an Agent App the
durable owner of addressed work

## Implementation checkpoint — 2026-08-14

The core addressed-work path now follows this proposal:

- one unconditional process-wide App registry loads canonical `app.ts`
  definitions;
- the durable App host and Project App adapter consume the same atomic
  registry snapshot;
- `/reload` validates and applies a prospective snapshot before publishing it,
  and refuses to remove an App that still owns unfinished inbox work;
- human May input is admitted only to the `may` App; the command router only
  normalizes ingress, applies deterministic controls, and performs App
  admission;
- structured May turns, May break-glass recovery, generic owner-inbox delivery
  fallback, and new owner-inbox pair creation are removed; and
- the App registry, host, store, and owner adapter depend only on the stable
  public `@may-agent/sdk` authoring contract;
- the task reconciler is an optional internal App capability; and
- the Project App declaration, legacy SDK, duplicate routes, and owner-inbox
  work lifecycle have been removed.

## Proposal

Treat every Agent App as a durable agent service:

```text
App = inbox + owner agent + app state
```

The long-running process becomes a generic App host:

```text
input -> App inbox -> owner agent -> result
                ^                    |
                +------ wake --------+
```

The host keeps work moving. The App decides what the work means. The agent
performs one bounded piece of judgment or execution.

This is a responsibility merge, not an implementation copy. Apps do not each
implement a daemon, queue, retry loop, database, or recovery worker. One shared
runtime provides those mechanics for every App.

## Why change

The current runtime represents one human or agent request through overlapping
mechanisms: event delivery, owner-inbox pairs, May turns, May bridge runs,
project-owner requests, task reconciliation, traces, and result
follow-through. Recovery then reconstructs whether the original request was
handled by joining those records.

This complexity comes from treating an App as a package around work while the
daemon separately owns addressed messages. Both are trying to answer the same
question: who is responsible for moving this input forward?

Give that responsibility to the addressed App. The runtime only hosts the
contract reliably.

## Compact mental model

| Concept        | Responsibility                                  |
| -------------- | ----------------------------------------------- |
| Infrastructure | Preserve state, execute, transport, and observe |
| App runtime    | Persist, claim, invoke, recover, and deliver    |
| App            | Own addressed input and its domain meaning      |
| Owner agent    | Judge and perform one bounded move              |
| App task       | Optionally preserve long-running desired work   |
| Event          | Wake an App or task because something changed   |
| Metric         | Observe the system and emit a signal            |

In short: infrastructure preserves work, the runtime keeps it moving, the App
decides what it means, and an Agent performs one bounded move.

May becomes the conversation App. A project App remains the owner of its
domain work.

An Agent is bounded execution, not a durable address. An App is the durable
address. `agents.call` and `agents.fork` remain valid execution operations, but
durable asynchronous input targets an App or resolves an agent to its owning
App.

```text
Hao -> may App -> May
                 | answer ----------------------> Hao
                 |
                 +-> project App -> owner -> result
                         ^                    |
                         +-- optional task ---+
                                      |
                         May reviews <-+
                              |
                              +----------------> Hao
```

## The shared App inbox

Every App automatically receives one durable inbox. One row represents one
actionable addressed input.

The lifecycle stays small:

```text
pending -> handling -> done
```

`handling` may reference one current agent session, child App message, or App
task. The referenced object keeps its own detailed state; the inbox does not
copy session, workflow, or task phases.

The minimum record is:

```ts
type AppResult = {
  summary: string;
  response?: string;
  evidence?: string[];
};

type AppInboxItem = {
  id: string;
  appId: string;
  parentId?: string;
  source: { kind: "human" | "app" | "system"; id: string };
  input: AppInput;
  status: "pending" | "handling" | "done";
  sessionId?: string;
  waitingOn?: { kind: "app" | "task" | "session"; id: string };
  result?: AppResult;
  lease?: { generation: number; owner: string; expiresAt: string };
};
```

`AppInput` is a canonical envelope with a `kind` and App-validated payload. A
human message, child result, metric observation, and task wake are not encoded
as indistinguishable prose. The owner receives the typed input, but does not
receive lease or storage fields.

The host validates input against the target App's registered schema before
creating an inbox item. The same rule applies to delegation: an unknown App or
invalid child input rejects that disposition at the parent admission boundary,
creates no child, and leaves the parent available for a corrected owner move.

The exact storage schema is an implementation decision. The required property
is one directly queryable authority for whether an App still owes handling of
an input.

## App owner result

The owner handles one or more claimed inbox items and returns one bounded
disposition for every item:

```text
complete  -> record the result and finish the item
delegate  -> create one child item in another App and wait
task      -> create or link durable App work and wait
```

An answer, clarification, rejection, or evidence-backed no-op is `complete`.
Those are semantic differences in the result, not runtime lifecycle branches.

Delegation carries the desired outcome, constraints, and required proof. It
does not select the target App's internal agent, workflow, task shape, retry
policy, or schedule.

When a child or task finishes, the runtime wakes the parent item. Its owner
then reviews the result and either completes, delegates again, or links the
next durable work. No trace search or special follow-through subscriber is
needed.

One owner session may handle a small batch of items for the same App. Batching
is a host optimization, not a change of identity: every item keeps its own
status and receives its own admitted disposition. Human input is ordered by
conversation before dispatch. Independent project signals may be batched only
when the App declares that they can share one owner pass.

Admission is atomic per item, not per batch. If a host admits three of five
results before failing, those three remain committed and the other two are
reclaimed from `handling`. If the owner attempt fails before returning a
usable batch result, none of its items advance. Each disposition is validated
and fenced against its own item generation.

For May, every accepted human input is persisted immediately with a monotonic
conversation sequence. Only one owner attempt runs for a conversation at a
time, and attempts are dispatched in sequence; an item waiting on delegated
work does not block a later message indefinitely. May does not batch unrelated
conversation turns. Typed controls such as cancellation may bypass ordinary
dispatch ordering while retaining a durable linked result.

## Reconciliation model

The App runtime applies the Kubernetes controller pattern to addressed work:

```text
wake -> claim -> observe current state -> invoke owner -> admit disposition
  ^                                                        |
  +--------------- dependency change or review time -------+
```

The runtime is the reconciliation loop. The owner agent is the semantic
decision function invoked by that loop; it is not itself a daemon.

| Kubernetes concept | App model                                     |
| ------------------ | --------------------------------------------- |
| Resource spec      | App input or task desired outcome             |
| Resource status    | Inbox result/wait reference or task status    |
| Controller runtime | Generic App host                              |
| Reconcile function | One bounded owner invocation                  |
| Child resource     | Delegated App item or attached task           |
| Watch/resync       | Event wake plus periodic unfinished-item scan |
| `requeueAfter`     | Delegation review time or Condition review    |
| Generation/fence   | Conditional claim and admitted-result version |

Most requests converge in one pass:

```text
inbox -> owner -> complete
```

When the outcome must survive multiple attempts, an external wait, restart,
delegation, or repeated verification, the owner attaches durable work:

```text
inbox -> owner -> task -> observe -> act -> verify
                   ^                         |
                   +--------- repeat --------+
```

Difficulty alone is not the criterion. A hard analysis may finish in one
bounded attempt; a simple deployment waiting on a pipeline needs durable
reconciliation. The decision is: can the App finish and prove the outcome
now? If not, preserve the desired outcome and its acceptance criteria in a
task.

Reconciliation may repeat, so externally visible effects require stable
operation IDs or receipts. The owner proposes typed intent; only the current
claim generation may apply inbox or task state.

## Infrastructure boundary

Infrastructure provides reusable substrate:

- transactional persistence and filesystem/workspace primitives;
- process, session, agent, and workflow execution;
- event and timer transport;
- channel transport and delivery receipts; and
- logs, metrics storage, and operational telemetry.

It does not know what an App request means or whether a domain outcome is
correct.

## Runtime boundary

The shared App host owns only reusable mechanics:

- durable inbox writes before acknowledgement;
- idempotent ingress and parent-child creation;
- claims, leases, fencing, concurrency, and backoff;
- bounded agent and workflow invocation over the execution substrate;
- session and task result correlation by explicit ID;
- restart recovery and periodic rescan of unfinished items;
- bounded per-App batching with a disposition for every claimed item;
- channel delivery and delivery evidence;
- event persistence and wake delivery;
- read projections, metrics, and operational diagnostics; and
- atomic application of an admitted owner result.

The host must not interpret message prose, choose domain work, infer project
completion, or invent a task.

Claims are conditional on the current status and lease generation. A lease is
renewed while its owner attempt runs. A duplicate wake cannot dispatch another
attempt while that lease remains valid. After expiry, a replacement may run,
but fencing ensures that only the current generation can admit results or
effects.

## App boundary

Apps own semantic policy that is currently scattered through runtime
handlers:

- which inputs belong to the App;
- what current domain context the owner needs;
- whether to answer, reject, delegate, reuse work, or create work;
- which workflow expresses a learned process;
- what task outcome and acceptance proof are required;
- which exact Condition represents a durable external wait;
- what result is safe to return to the caller; and
- which domain events should wake existing work.

This policy lives in the App declaration, its owner instructions, app-owned
workflows, and optional task resolver. It does not live in generic command,
event-delivery, orphan-recovery, or metric handlers.

Apps do **not** own database access, lease repair, retries, process recovery,
or delivery bookkeeping. Moving those mechanics into Apps would reproduce the
current complexity once per App.

Apps also do not define new inbox phases or owner-result vocabularies. The
shared host admits the same `complete`, `delegate`, and `task` dispositions for
every App. Apps decide their semantic contents, not their lifecycle mechanics.

## App contract refinement

Keep the public declaration small:

```ts
defineApp({
  id: "aks-rp-e2e",
  owner: "owner",
  subscriptions: [
    /* facts translated into independently correlated App requests */
  ],
  inbox: { batch: "coalesce-compatible" },
  tasks: {
    subscriptions: [
      /* facts that deterministically resolve to durable desired work */
    ],
    resolve: resolveTaskIntent,
  },
});
```

The routing rule is about durable obligation, not merely whether a human is
waiting synchronously:

```text
addressed input requiring a distinct result -> App inbox
changed fact with deterministic desired work -> task resolver
fact with no actionable obligation          -> event only
```

An App subscription is intentionally rare: it translates a fact into a typed
request for which the App owes one independently correlated disposition. A
task subscription maps a fact directly to `TaskIntent`; queue coalescing occurs
only after the latest desired intent and trigger are persisted. The same event
may reach both paths only when the App explicitly needs two distinct durable
obligations.

Schedules declare the same distinction. An input schedule creates an App inbox
obligation. An event schedule publishes a typed fact that may wake a task
subscription without manufacturing a callerless inbox item. Both use shared
runtime scheduling mechanics.

An App automatically gets:

- an address;
- a durable inbox;
- owner-agent dispatch;
- parent-child delegation;
- restart recovery; and
- optional task integration.

Batching defaults to one item. An App may opt into bounded batching only when
its owner can return one result per item. Coalescing may share context and one
owner session, but it must never replace several input identities with one
uncorrelated result.

Subscription translation and task resolution remain deterministic. They must
not become app-specific schedulers, retry loops, or direct agent launchers. An
actionable translation creates an App request or returns desired task intent
for the shared host to observe. Semantic judgment that cannot be expressed as
pure policy remains with the owner.

## Runtime SDK simplification

The current `@may-agent/sdk` root is not one stable contract. It combines App
authoring, workflow execution, raw SQLite, cron handlers, heartbeat and
evaluator queries, task-file storage and locking, recovery guards, project
parsing, caches, metrics, and testing helpers. Its root barrel is more than one
thousand lines, while the package contains several thousand lines of runtime
and pattern implementations.

Replace that broad surface with a small authoring contract. The SDK describes
an App and the bounded work it may request. It is not the runtime's utility
library.

```text
App code -> @may-agent/sdk contracts -> App host
                                      -> private runtime implementation
```

This gives the package one rule: if an ordinary App or workflow does not need
a concept to declare behavior, that concept is not in the public SDK.

### Public root

The root exposes only App declarations, authored inputs/results, and the two
contexts passed to App code:

```ts
import {
  defineApp,
  Type,
  type AppDefinition,
  type AppInput,
  type AppRequest,
  type AppEvent,
  type AppDisposition,
  type EventSelector,
  type TaskIntent,
  type Condition,
  type ObserverContext,
  type WorkflowContext,
  type ExecutionResult,
} from "@may-agent/sdk";
```

The author-visible request deliberately omits host lifecycle fields:

```ts
type AppInput<T = unknown> = { kind: string; data: T };

type AppRequest<T = unknown> = {
  id: string;
  source: { kind: "human" | "app" | "system"; id: string };
  parentId?: string;
  input: AppInput<T>;
  dependency?: AppDependencyObservation;
};
```

`defineApp` supplies the schema that validates each App's input union. The
generic envelope carries correlation; the App owns the payload vocabulary.
When a linked child, task, or session wakes an item, `dependency` contains the
read-only observation of that exact stored link (status plus bounded result
evidence). It is not a general query capability and exposes no lease or storage
fields. This gives the owner enough evidence to review the dependency after a
restart without reaching into runtime internals.

`AppInboxItem`, leases, database rows, task actions, and host services are not
authoring types. Testing fakes live at `@may-agent/sdk/testing`. Existing code
may temporarily use `@may-agent/sdk/legacy`, but new App code cannot import it.
Runtime implementation moves to a runtime-owned package rather than another
public SDK subpath.

### Capability-scoped contexts

Do not replace one monolithic `AgentSDK` with the same object split into many
nested namespaces. Use two contexts based on the call site:

```ts
type ObserverContext = {
  read: AppRead;
  log: Logger;
};

type AppRead = {
  appResult(itemId: string): Promise<AppResult | null>;
  task(taskId: string): Promise<TaskView | null>;
  execution(executionId: string): Promise<ExecutionView | null>;
  metric(metricId: string): Promise<MetricView | null>;
};

type WorkflowContext = {
  input: WorkflowInput;
  read: AppRead;
  agents: { call(agent: string, task: string): Promise<ExecutionResult> };
  workflows: { run(name: string, input: unknown): Promise<ExecutionResult> };
  events: { emit(event: AppEvent): Promise<void> };
  metrics: { record(id: string, value: number, note?: string): Promise<void> };
  workspace?: { root: string; output: string };
  log: Logger;
  done<T>(summary: string, output?: T): ExecutionResult<T>;
  blocked(reason: string, evidence?: unknown): ExecutionResult;
};
```

An observer reads stable projections and returns declared reactions for the
host to persist. It cannot start execution or mutate an inbox/task. A workflow
may perform bounded execution and publish facts, but also cannot mutate
inbox/task storage. The owner does not receive either SDK context: the host
gives it one or more `AppRequest` values and admits its returned
`AppDisposition` values.

The host supplies the canonical `AppDisposition` structured-output schema to
the owner agent. Deterministic controls and event translations stay in their
typed adapters; a second deterministic owner interface is not part of this
proposal. If one is later needed, ordinary code can return the already
exported `AppDisposition` type without adding another lifecycle vocabulary.

The important constraints are:

- reads are projections, never SQL or database tables;
- filesystem access, when needed, is scoped to the current workspace;
- App-to-App delegation occurs through an owner disposition, not a hidden
  `apps.send` side effect; and
- task and inbox lifecycle mutations exist only at the host admission boundary.

`AppRead` starts with bounded ID lookups over stable runtime projections. It
does not provide arbitrary list, history, or SQL access. Domain reads belong
to App-owned adapters; additional shared projections graduate into `AppRead`
only after their contract is stable.

### One result vocabulary

Remove the overlapping `SDKTaskResult`, `TaskResult`, internal
`WorkflowResult`, external `SDKWorkflowResult`, and execution-view result
shapes. Bounded execution has one terminal result:

```ts
type ExecutionResult<T = unknown> = {
  id: string;
  kind: "agent" | "workflow";
  status: "done" | "blocked" | "error" | "interrupted";
  summary: string;
  output?: T;
  evidence?: unknown;
};
```

`running` belongs to an execution read view, not a terminal result.
Compatibility normalization stays at the host boundary.

App handling has its separate, equally small result vocabulary:

```ts
type TaskAttachment =
  | { kind: "existing"; taskId: string }
  | { kind: "desired"; intent: TaskIntent };

type AppDisposition =
  | {
      type: "complete";
      summary: string;
      response?: string;
      evidence?: string[];
    }
  | {
      type: "delegate";
      appId: string;
      input: AppInput;
      reviewAfterMs?: number;
    }
  | { type: "task"; task: TaskAttachment };
```

The task form deliberately carries no `TaskAction[]`. `existing` links work
already owned by the App. `desired` hands declarative desired state to the
task engine, which creates or reconciles it according to the task contract.
The host validates the attachment and atomically links it to the inbox item.
Later task changes remain task reconciliation, not inbox commands.

This restriction applies to the inbox owner disposition. It does not replace
the existing task-controller admission contract in this proposal: task
handlers may continue returning admitted `TaskAction[]` while the current task
engine remains. Moving that specialized contract out of the SDK root, or
replacing it with a fully declarative task API, is a separate migration.

`reviewAfterMs` is not an App schedule. It asks the generic host to wake the
parent owner if a child remains unfinished, so May can report or reconsider a
stuck delegation without becoming a background project App.

Apps cannot add a fourth disposition or directly perform the storage update
represented by one of these results.

### Target package layout

Keep the physical package as plain as the public model:

```text
packages/sdk/src/
  index.ts       explicit public exports only
  app.ts         App declaration, input, request, disposition
  event.ts       event and selector contracts
  task.ts        TaskIntent and Condition contracts
  workflow.ts    WorkflowContext and ExecutionResult
  testing.ts     public test fakes
```

Host implementations stay with the runtime. App-specific parsers, context
builders, and queries stay with the owning App or a domain library. A
temporary `legacy` entry point is migration scaffolding, not a permanent home
for everything removed from `index.ts`.

### Remove host internals from the SDK

The following are not public App SDK concepts:

- `getDb()`, SQLite statement types, and unrestricted `query.sql`;
- owner-inbox review/expiry commands;
- task-state file reads, writes, locks, migrations, and projections;
- circuit-breaker, dispatch-dedup, and lease implementations;
- cron handler and digest internals;
- heartbeat context loaders and evaluator-specific query methods;
- project Markdown parsers and workflow file caches;
- session/workflow database-row normalization; and
- global `agents`, `shared`, `projects`, and persistence paths.

Host mechanics move into the runtime. Domain-specific context builders and
portable parsers move into their owning App or domain library. Migration tools
may use the temporary legacy entry point until they are retired.

### Remove ambiguous methods

- `message(target, content)` becomes an App `delegate` disposition for durable
  asynchronous ownership. Direct bounded execution remains `agents.call` in a
  workflow.
- `emit(type, data, envelope)` becomes one canonical `events.emit(event)`
  shape. Compatibility flattening remains at external ingress only.
- `escalate(...)` becomes an explicit App delegation or task/human Condition,
  rather than a second generic work path.
- `metrics.alert`, `evaluate`, and `resolveAlert` remain internal metric-service
  operations. App code declares metrics and records observations; a metric
  cannot control work.
- `eventData`, `eventDetails`, and alternate event payload readers disappear
  after canonical event migration; App code reads `event.data`.

### SDK stability rules

1. The public SDK contains contracts and small constructors, not runtime
   implementations.
2. The runtime may implement SDK contracts but may not expose host internals
   merely because its own code needs them.
3. The root exports no database, queue, lease, scheduler, task-store, or global
   path API.
4. App-specific reads belong to the App; only stable cross-App projections
   enter `AppRead`.
5. App-specific capabilities remain provisional during a canary and require
   two independent App consumers before graduating as stable public API.
6. Public types have explicit fields; open-ended index signatures are avoided.
7. One import-boundary test records the supported root exports.
8. Deprecated compatibility has a removal owner and deadline.

## Event and metric refinement

Events are edge-triggered wakes and audit facts:

```text
state changes -> event(appId, itemId) -> App host reconciles current state
```

Correctness comes from inbox/task state, so duplicate and missed events are
safe. The periodic scan repairs missed wakes rather than reconstructing work
from the event graph.

Metrics are observation, not a second controller:

```text
state -> sample -> threshold evaluation -> breach/recovery event -> App/task wake
```

Infrastructure stores samples and runs shared threshold, deduplication, and
hysteresis mechanics. The runtime automatically records generic lifecycle
health. Apps declare domain metric meaning and thresholds, record samples, and
choose which metric events they observe. Pure App policy may resolve a metric
fact directly to desired task work; otherwise a correlated App request lets
the owner decide whether the current state needs an answer, delegation, or
durable task.

Runtime metrics include inbox age, claim and handling latency, lease reclaim,
execution failure, dependency wait, and delivery health. App metrics describe
domain outcomes such as test pass rate, specification coverage, pull-request
health, or deployment convergence. Adding an App metric does not change the
runtime.

A metric event is never authoritative task state. Because a sample may be
duplicated, delayed, or stale, it only wakes an App or task. A deterministic
resolver returns desired intent for the host to persist before coalescing the
wake, and the reconciler must still observe current state before acting.
Inbox/task state remains the authority for whether work is complete.

The inbox store becomes the source for request-health signals: pending count
and age, claim latency, handling duration, lease reclaim rate, disposition
count, and delivery wait. During migration these projections are compared with
the old owner-inbox/event-pair dashboard before that path is removed.

Not every event becomes work, and most actionable facts do not become inbox
work. Lifecycle facts, logs, and observations remain facts. Only explicitly
addressed input or an App subscription creates an inbox obligation; task
subscriptions wake durable desired work directly.

## May as an App

The May App owns human conversation:

- every ordinary human message enters the May inbox;
- May answers directly or delegates to one App;
- delegated work is an explicit child link;
- the May item remains `handling` while the child owns the domain work;
- child completion wakes May for one bounded result review; and
- May completes only after the final human response is delivered.

The May App has no schedules, watchers, or task attachment. This prevents the
conversation owner from becoming a background project owner. One bounded
break-glass child execution remains possible, but it cannot create a May-owned
loop.

Explicit low-level controls such as cancel or shutdown may remain deterministic
runtime commands. They still produce a durable result for the originating May
item when they came from a human message.

This replaces the current rule that May is deliberately not an App. May is not
a project App with a task tree or background strategy; it is the conversation
App using the same inbox and owner-dispatch contract.

## Existing control semantics

The simplification does not move every human action through an LLM:

- cancellation, reload, restart, and shutdown remain typed runtime controls;
- an explicit approval remains a typed response that updates its owning task
  Condition;
- expiry remains optional ingress metadata rather than an age-based guess;
- uncertain channel delivery remains shared infrastructure and is never
  retried blindly; and
- escalation remains an explicit ownership-boundary request.

When one of these originates from an App inbox item, its typed result is linked
back to that item and wakes it. These capabilities must be proven on the new
path before their old handlers are removed.

## App tasks remain optional

An inbox item always preserves addressed responsibility; it does not make
every request a task. When one bounded owner pass can finish and prove the
outcome, the item completes directly. Otherwise the App uses its existing task
mechanism to preserve desired work:

```text
inbox item -> owner creates or links task -> item waits on task ID
task event -> task reconciles current state
task result -> item wakes -> owner completes response
```

Task resources continue to own desired outcome, Conditions, task attempts,
acceptance, and receipts. Inbox items do not become a second task tree.

## Expected runtime simplification

The new path can replace:

- separate structured-May-turn and May-bridge scheduling;
- owner-inbox event pairs as message state;
- trace-based human-result reconstruction;
- fresh result-follow-through inference;
- broad owner fallback that treats inbox visibility as handling; and
- message orphan recovery based on SQL joins over event evidence.

The existing command router becomes a thin input/control adapter. EventBus
persists and publishes signals without owning message completion. The project
App loader registers Apps and subscriptions. The existing task controller is
retained behind the optional task attachment.

## Reviewed trade-offs

The design review identified three real constraints:

1. **Preserve batching.** Every message needs a result, but several compatible
   project messages may share one owner session.
2. **Keep May conversational.** The May App cannot declare schedules, watchers,
   or tasks.
3. **Make durable ownership explicit.** A standalone Agent remains directly
   callable, but durable asynchronous input belongs to an App.

Other suspected regressions are boundary violations rather than accepted
trade-offs. Inbox state must not copy task phases; Apps must not invent
lifecycle rules; and delivery, approval, cancellation, expiry, and escalation
remain shared contracts.

## Migration

SDK migration is split at the canary boundary. Steps 1–2 must provide the new
App/request/disposition contracts, scoped contexts, one execution result, test
fakes, and host adapters; the canary may not use raw database or global-path
escape hatches. Moving every legacy consumer and host helper, then deleting
the legacy entry point, deliberately trails the runtime migration and finishes
in step 10.

1. Freeze and inventory the current SDK exports and consumers. Publish a
   production/test and public/legacy/host-internal triage with a migration
   estimate; do not hard-code the volatile import count into this proposal.
2. Introduce the small public SDK, capability-scoped contexts, and temporary
   legacy entry point without changing existing execution.
3. Add the shared App inbox store and App host beside existing routing.
4. Make one canary App and one workflow use the new SDK and inbox path.
5. Add explicit child-App and task-completion wake links, then prove claim,
   batching, delegation, task wait, duplicate wake, and restart behavior on the
   canary.
6. Register May as the conversation App and route new human input through it.
7. Prove direct answer, typed control/approval, delegation review timeout, and
   uncertain channel delivery end to end.
8. Stop creating owner-inbox event pairs for migrated App messages.
9. Remove the May bridge, result-follow-through, and message-specific orphan
   reconstruction paths.
10. Move remaining host helpers out of the SDK, remove the legacy entry point,
    and rewrite the accepted contracts after the canary proves the model.

Do not perform a flag-day rewrite. During migration, one input is owned by
exactly one path; dual-write may support comparison, but dual-consumption is
forbidden.

## Acceptance criteria

- Every accepted App input is directly queryable as `pending`, `handling`, or
  `done` without interpreting events or traces.
- Restarting the host resumes or safely reclaims every unfinished item.
- Duplicate wake delivery cannot start another owner attempt under a valid
  lease; after reclaim, stale generations cannot apply effects or results.
- A bounded owner batch produces one independently fenced disposition per
  claimed item; partial admission never rolls back other items.
- Delegation and task waiting use explicit IDs and wake the original parent.
- Invalid App input or delegation is rejected before an inbox/child item is
  created.
- May and project Apps use the same host and inbox behavior.
- The May App has no schedules, watchers, or task attachment.
- May persists human input in conversation order and runs at most one owner
  attempt per conversation at a time.
- Durable asynchronous input targets an App; direct Agent execution remains
  available for bounded calls and forks.
- The public SDK exposes one execution result and one App disposition
  vocabulary.
- The public SDK contains no raw database, task-store, scheduler, recovery, or
  global-path capability.
- App-specific code contains domain policy but no retry, lease, recovery, or
  delivery loop.
- Bounded requests complete without creating a task; durable outcomes retain
  desired state and acceptance criteria until they converge.
- Events can be pruned without losing current App work.
- Metrics remain observations; they may wake declared App/task policy but
  cannot authoritatively complete or mutate inbox/task state.
- Inbox projections preserve pending-age, handling-duration, reclaim, and
  delivery-wait visibility before old event-pair metrics are removed.
- The old May bridge, owner-inbox message pairs, trace-inferred follow-through,
  and message orphan reconstruction are removable.

## Non-goals

- replacing the agent runner or session transcript model;
- replacing the task-resource engine;
- turning every event into work;
- embedding a daemon implementation in each App;
- making an inbox item a generic project task; or
- moving infrastructure reliability into prompts or workflows.

## Design documents affected

Acceptance would require coordinated updates to:

- [System Model](../../2a-design/system-model.md);
- [Architecture](../../2a-design/architecture.md);
- [Infra Surface Design](../../2a-design/system-boundary.md);
- [Agent App Contract](../../2a-design/agent-app.md);
- [SDK](../../2a-design/sdk.md);
- [Events](../../2a-design/events.md);
- [Escalation](../../2a-design/escalation.md);
- [Message Lifecycle](../../2a-design/message-lifecycle.md); and
- [Agent App External Interaction](agent-app-external-interaction-contract.md).

The task, workflow, session, and agent execution contracts should remain
largely unchanged.
