# Infrastructure, Runtime, And App Boundary

**Design status:** Accepted.
**Implementation status:** Implemented. The canonical App host and scoped SDK
replace Project App declarations, the legacy SDK, and owner-inbox work
authority; remaining internal handlers are runtime adapters, not App hosts.

This document defines the stable split:

```text
Infrastructure preserves obligations and moves facts.
Runtime hosts bounded execution and reconciliation.
Apps own meaning, policy, and desired outcomes.
```

The split keeps infrastructure small and stable while Apps evolve without
copying delivery, scheduling, storage, retry, or recovery mechanics.

## Core model

```text
addressed input -> App inbox -> direct result, delegation, or task attachment
changed fact    -> event     -> App request, TaskIntent, exact wake, or observation
durable outcome -> App task  -> repeated bounded reconciliation
bounded action  -> session/workflow -> evidence
```

An App inbox item is the authority for one addressed result. A task is the
authority for one durable desired outcome. An event is a fact/wake. A session or
workflow is one execution attempt. No other record may become a parallel work
lifecycle.

## Responsibility split

### Infrastructure

Infrastructure owns stable, mechanically enforceable primitives:

| Primitive | Responsibility |
| --- | --- |
| App registry | Validate and atomically publish one generation of App definitions |
| Inbox runtime | Admission, idempotency, claims, fencing, dependencies, results, and restart recovery |
| Event runtime | Persist facts, match declared consumers, record delivery, and retain causal evidence |
| Scheduler | Timer cadence, jitter, restart policy, event publication, and observer cadence |
| Task runtime | Desired-state persistence, generations, queues, attempts, Conditions, result admission, and recovery |
| Execution runtime | Prepare agents/workflows, enforce timeout/concurrency/tool policy, persist results and lineage |
| Delivery | Correlate App results with App/human/channel delivery and handle uncertainty safely |
| Metrics | Record samples and generic threshold/dedup/hysteresis/runtime health mechanics |
| Workspace runtime | Allocate bounded workspaces, record lineage, and recover/clean them |
| Control/adapters | Normalize ingress, expose bounded status, and translate external transports |

Infrastructure does not decide domain strategy, task decomposition, whether a
domain outcome is good enough, which workflow represents project experience,
or whether a human preference should change.

### Runtime SDK

The runtime SDK is the narrow semantic membrane between Apps and
infrastructure. It exposes:

- `defineApp` and typed App policy;
- typed input, request, disposition, result, fact, and task contracts;
- bounded workflow execution and exact read projections;
- scoped fact publication, metric recording, workspace paths, and logging; and
- validated task reconciliation/verification results.

It hides SQL, task files/locks, scheduler and event-bus handles, queue/lease
state, global paths, delivery internals, process recovery, and session-manager
control.

The SDK is stable when Apps extend because App growth normally adds schemas,
pure policy, observers, workflows, and domain projections—not new runtime
mechanics.

### Apps

Each App owns:

- one durable address and accountable owner;
- typed input meaning and pure request routing;
- explicit fact-to-request subscriptions;
- explicit fact-to-TaskIntent policy;
- input/event schedule meaning;
- observer interpretation of external state;
- actions, workflows, task validation, and terminal domain evidence;
- domain workspace and project posture; and
- domain metric definitions and interpretation.

Apps do not implement their own inbox lifecycle, retry daemon, scheduler,
event queue, task store, recovery pass, delivery mechanism, or process-wide
registry.

## App runtime shape

```text
Adapters
CLI / Web UI / Telegram / App delegation / provider callbacks
        |
        v
Typed ingress
App admission / deterministic control / fact publication
        |
        v
Canonical App host
registry + inbox + subscriptions + schedules + observers + task capability
        |
        v
Bounded execution
owner agent / agent-owned workflow / deterministic helper
        |
        v
Validated result admission + facts + metrics + delivery
```

There is no generic bridge from an event directly to an agent. A fact first
reaches an explicitly declared App subscription, task subscription, or exact
target. Only a durable App request or task reconciliation may start judgment.

## Request boundary

Addressed work enters an App as typed `AppInput`. The host persists it before
waking the App owner. A pure `route(request)` policy may complete, delegate, or
attach it to a task without model judgment; returning `null` asks the owner for
one bounded disposition.

The owner sees only:

- request identity, source, parent, and typed input; and
- an exact bounded observation of the dependency it previously established.

The owner never sees or mutates inbox rows, claims, leases, retries, channel
operations, or task storage. The host applies the disposition with fencing and
idempotency.

The `may` App owns ordinary human input and final response delivery. Domain
Apps own project meaning. May delegates and reviews; it does not become a
fallback project controller.

## Fact boundary

Events cross boundaries as facts:

```text
fact -> App subscription  -> toInput -> correlated App request
     -> task subscription -> resolve -> persisted TaskIntent/trigger
     -> exact task target -> exact wake
     -> no route          -> observation/unhandled evidence
```

App/task selectors and translators are pure. They cannot execute a workflow,
write state, emit another fact, or access runtime services.

The runtime never turns an unhandled fact into generic owner work. Unknown
addressed Apps fail admission visibly; unknown unaddressed facts remain
observable. The same fact reaches multiple actionable paths only when each path
is an explicitly distinct, tested obligation.

## Task boundary

The existing reconciler remains a valuable internal App capability:

```text
TaskIntent persisted
  -> stable task ID coalesced in queue
  -> fenced attempt receives bounded reconciliation context
  -> owner/workflow returns structured result
  -> runtime validates generation/actions/Conditions/evidence
  -> atomically apply result
  -> later exact fact or resync repeats until converged
```

Queue entries are scheduling pressure, never desired state. The newest intent
and trigger are durable before coalescing. Conditions name exact facts; resync
is a safety net, not a second planner.

App workflows receive bounded task facts and child views through
`ctx.reconciliation`. The host additionally supplies a capped live-task
snapshot only for App-wide frontier-health workflows; it omits the reviewing
task and reports truncation. Workflows cannot parse prompt packets, issue
arbitrary global task queries, read task persistence, or mutate task resources
directly.

## Schedule and observer boundary

A schedule declares exactly one destination:

- `{ input }` creates a correlated App inbox obligation; or
- `{ event }` publishes a fact that may wake task work.

An observer performs one bounded external read and returns facts. It cannot run
an agent or mutate durable work. Internal runtime maintenance may use the same
scheduler mechanics but is not App-authored policy.

No timer, metric breach, provider completion, or lifecycle event may directly
dispatch an owner session.

## Execution boundary

One prepared execution kernel serves direct, Gym, App-owner, and workflow
execution:

```text
prepared agent + typed task/context + scoped tools
  -> bounded model loop
  -> ExecutionResult + transcript/evidence
```

The kernel has no App inbox, task, event-bus, scheduler, database, or recovery
authority. The caller supplies the bounded context and decides how to admit the
result.

Canonical workflow capabilities are:

```ts
ctx.input
ctx.reconciliation?
ctx.read.appResult/task/execution/metric
ctx.agents.call(...)
ctx.workflows.run(...)
ctx.events.emit(...)
ctx.metrics.record(...)
ctx.workspace
ctx.log
ctx.done(...) / ctx.blocked(...)
```

Workflows are bounded synchronous controllers even when their TypeScript uses
`await`. Durable waits end the run and continue later through App dependencies
or task Conditions.

## Metrics and guards

Metrics observe runtime or domain state. Infrastructure owns storage,
thresholds, deduplication, hysteresis, and generic health. Apps own domain
metric meaning and samples.

A breach/recovery is a fact. It may wake a task subscription or, when a distinct
disposition is truly required, an App subscription. It never becomes desired
state or launches judgment directly.

Guards are mechanical detectors around tools/execution. They record durable
risk evidence and may warn, repair, or block only under explicit policy. A
guard event follows normal fact routing. Guards do not decide project strategy
or become retry planners.

## External control boundary

CLI, Web UI, Telegram, and other adapters share one small control protocol:

```text
admit App input
publish fact
invoke typed App action
apply deterministic runtime control
subscribe/read bounded projections
```

Adapters do not run agents/workflows, mutate internal tables, select task
storage, or implement project policy. They normalize transport identity,
authenticate where required, and preserve correlation to the canonical App or
control operation.

The browser and Telegram may present different experiences, but they cannot
create separate routing or lifecycle semantics.

## Agent tools

Model-facing tools are task-oriented capability grants, not the runtime SDK.
Examples include bounded file/shell/edit, exact query, agent call, workflow
run, fact publication, and finish/result tools.

An agent tool may share implementation with a workflow capability, but its
permission and interaction contract are explicit. Agents must not open runtime
SQLite or mutate task/inbox files through shell. Durable cross-owner work uses
App delegation; agent messages remain notifications only.

## Loading and reload

The loader pipeline is mechanical:

```text
discover -> import -> validate -> prepare complete generation
         -> atomically publish registry/routes/schedules/controllers
```

One `defineApp` export owns each App. A failed candidate leaves the previous
generation unchanged. Active executions retain their prepared definition and
source lineage; subsequent dispatch uses the new generation.

There is no second `services/` discovery graph or cross-App service registry.
Runtime subsystems may use host-private typed ports and explicit factory wiring,
but Apps receive only the bounded capabilities declared by the canonical SDK.
Long-lived route, schedule, observer, and controller registrations are owned
and torn down by the complete registry generation, never independently
hot-swapped as a dependency subgraph.

Agent definitions, prompts, tools, workflows, App definitions, schedules,
observers, and task routes each declare their reload boundary. Reload never
silently mutates an active session or duplicates schedule/subscription/task
controller ownership.

Only the long-running host attaches autonomous runtime capabilities. Direct,
Gym, status, and read-only processes may prepare agents and workflows but
cannot claim App work.

## Recovery boundary

Infrastructure may recover mechanically:

```text
stale claim/attempt/delivery
  -> fence old owner
  -> repair known mechanical state
  -> requeue the same persisted obligation
  -> attention when judgment is required
```

It cannot invent a new request, desired task, owner strategy, retry meaning, or
completion claim. App/task IDs, generation, input, intent, dependencies, and
evidence survive recovery unchanged unless admitted semantic policy revises
them.

Uncertain human delivery is never retried blindly. Recovery first observes the
delivery operation and preserves the originating May request.

## Failure model

| Failure | Owner |
| --- | --- |
| Invalid App definition or route | Registry/loader rejects candidate generation |
| Inbox claim/session interruption | Inbox runtime fences and retries same request |
| Invalid owner disposition | Host rejects result; request remains unfinished |
| Invalid TaskIntent/action/Condition/result | Task runtime rejects admission |
| Workflow/agent timeout or crash | Execution runtime records failure; owning App/task decides semantics |
| Observer/provider failure | Observer/runtime health; no automatic owner work |
| Event publication/delivery failure | Event runtime retries/surfaces without inventing work |
| Human delivery uncertainty | Delivery runtime preserves uncertainty and request correlation |
| Reload failure | Previous complete generation remains active |

Failures remain in their owning layer. A session failure does not imply task
failure; task attention does not imply project blocked; event acceptance does
not imply semantic completion.

## Public surfaces

There are three stable public boundaries:

1. **`@may-agent/sdk`** for App declarations and bounded App-owned workflows.
2. **Agent tools** for explicitly granted model capabilities.
3. **Control client/protocol** for external adapters and bounded read/steering.

Legacy handler contexts, `defineProjectApp`, `@may-agent/sdk/legacy`, raw
`AgentSDK`, `getDb`, global path bags, generic query/command facades, and direct
event-to-agent handlers are not stable public surfaces.

## What to avoid

- Do not add socket commands for domain actions that belong in App schemas.
- Do not turn events, queues, metrics, traces, or projections into work state.
- Do not create per-App schedulers, retry loops, recovery daemons, or delivery
  systems.
- Do not expose raw database/task/inbox mutation to Apps or agents.
- Do not run agents directly from event, timer, observer, or metric handlers.
- Do not create transport-specific ownership paths for Telegram, Web UI, or
  CLI.
- Do not add generic SDK escape hatches to make one migration easier.
- Do not preserve legacy and canonical actionable routes in parallel.

## Adopted migration

1. One `defineApp` declaration and atomic registry generation own each App.
2. Addressed input uses App Inbox admission; facts use explicit App/task
   subscriptions, exact wakes, or observation only.
3. Task reconciliation is an optional capability behind the canonical host.
4. Workflows receive typed input, narrow reads, and scoped workspace/metric
   capabilities.
5. Timers and external reads are App schedules/observers; shared maintenance
   remains internal runtime work or explicit offline tooling.
6. Owner-inbox/event-pair work authority, duplicate loaders/routes,
   `defineProjectApp`, and `@may-agent/sdk/legacy` are deleted.
7. Restart, reload, delivery, task recovery, and route uniqueness are covered by
   runtime and App verification.

## Integrity checklist

- One App model, one registry generation, and one host own all App capabilities.
- Every addressed request has one App inbox authority and correlated result.
- Every durable desired outcome has one App task authority.
- Every fact-to-work path is explicit, pure, and idempotent.
- No infrastructure callback directly runs project judgment.
- Apps receive semantic contracts and scoped capabilities only.
- Execution is bounded and has no durable ownership mechanics.
- Recovery preserves identity and cannot invent domain meaning.
- External adapters cannot bypass App/control admission.
- Legacy and canonical actionable routes never run together.
