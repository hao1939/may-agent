# Host code boundaries

The Host contains both stable mechanics and replaceable implementations.
"External" means outside the core, not necessarily another package or process.

The governing design lives in the sibling App tree, not this navigation guide:

- [Core Principles — Apps own meaning; the Host owns mechanics](../../../may-agent.app/docs/1-principles/core-principles.md#apps-own-meaning-the-host-owns-mechanics)
  assigns validation, persistence, scheduling, and recovery to the Host.
- [Core Principles — Convention over configuration](../../../may-agent.app/docs/1-principles/core-principles.md#convention-over-configuration)
  requires “one `app.ts`, one `defineApp`, and one atomic App generation.”
- [System Boundary — Host](../../../may-agent.app/docs/2a-design/system-boundary.md#host)
  says “Reload either publishes a complete replacement or keeps the previous
  definition active.” [Extension rule](../../../may-agent.app/docs/2a-design/system-boundary.md#extension-rule)
  keeps stable mechanics in the Host and policy in the App.
- [Core proposal — Step 2](../../../may-agent.app/docs/proposals/task-runtime-organization.md#step-2-separate-app-source-discovery-from-core-registration)
  applies these accepted rules to discovery and registration. The rest of that
  proposal remains incremental work, not implemented behavior.

These links require the sibling `may-agent.app` design tree. A standalone Host
checkout does not contain it; request the cited sections when reviewing a
behavior change rather than treating this guide as replacement design.

| Home | Responsibility | Current entrypoint |
| --- | --- | --- |
| `core/` | Identity, authority, and recovery rules shared by every capability | `apps/registry.ts` validates and publishes generations; `tasks/startup-recovery.ts` keeps Task-bound sessions under Task recovery |
| `adapters/` | Concrete capability implementations | `discovery/app-definitions.ts` reads conventional App files; `maintenance/` contains named Host duties and their configuration |
| `composition/` | Select implementations and wire process startup/lifecycle | `background-startup.ts` starts recovery independently of optional schedules |

This layout is being applied incrementally. `app-runtime.ts` remains the main
composition root; Task stores/controllers, event admission, and concrete
executors still have mixed/flat locations. Do not mistake those remaining files
for completed separation or move the whole Cron engine into core.

Core depends on contracts and foundational utilities, not concrete adapters.
Composition may import both sides. Adapters receive the narrow capabilities
they need; they do not become another Task state or recovery authority.

Loading prepares definitions and handlers without activating producers.
`app-runtime.ts` activates the prepared generation after ingress opens and each
replacement during reload. Process role selects background ownership; `--cron`
selects optional timers. There is no separate loader activation setting.

To extend a supported capability:

1. Read its existing SDK/control or Host-private contract.
2. Add a focused implementation and colocated tests in its capability family.
3. Register it explicitly in composition, including activation and cleanup.
4. Test behavior when it fails or is absent; leave core correctness rules alone.

App-owned policy, observers, and schedules stay in the owning App declaration.
Public App contracts live in `packages/sdk`; client contracts in
`packages/control`. Do not add a plugin loader, a second manifest, or a universal
component interface. Add subdirectories as real boundaries are separated, not
as empty placeholders.

## Shared timing

`core/scheduling/timer.ts` owns timer replacement, cancellation, and shutdown.
It dispatches private callbacks and contains synchronous failures; it does not
accept work, publish events, or decide whether a slot succeeded. Asynchronous
callbacks retain their own rejection handling. Sharing these mechanics does
not require one physical timer or a scheduler registry.

`adapters/producers/app-schedules.ts` interprets App schedule declarations:
input slots publish ordinary `app.input.requested` events; fact slots publish
record-only events. It retains the existing latest/none catch-up and successful
publication checks. Reload keeps unchanged slots and restores the exact previous
activation records if publication is rejected. It never runs a model.

`app-inbox-runtime.ts` composes independent schedule, observer, and request
recovery cadence after startup readiness. A failed request read cannot prevent
schedule/observer dispatch. `app-task-recovery.ts` uses the same timer mechanics
for its indexed nearest-due and bounded safety passes. Each owner closes its
registrations; disabling App schedules does not stop observers or recovery.

See [Scheduling and Observation](../../../may-agent.app/docs/2a-design/cron.md)
and [Shared timing, intentional events](../../../may-agent.app/docs/proposals/task-runtime-organization.md#shared-timing-intentional-events).
Host maintenance uses those same timer mechanics. See the private
[maintenance guide](adapters/maintenance/README.md) for preparation, activation,
failure behavior, and the retired standalone-work boundary.

## App discovery and registration

`adapters/discovery/app-definitions.ts` supplies a deferred file source. It scans
`projects/<name>.app/app.ts` (or `app.js`), refreshes imported code when invoked,
and preserves canonical App directories when loading a source release.

`core/apps/registry.ts` accepts that source as a typed function:

```ts
const registry = new AppRegistry(discoverAppDefinitions(sourceRoot, canonicalRoot));
await registry.reload();
```

Discovery returns declarations, not live registrations. The registry validates
every definition and duplicate identity, normalizes agent selection, and calls
the existing consumer preparation/publication callback. Discovery and publication
share one serialized transaction. A replacement source becomes the default only
after publication succeeds; a rejected replacement retains the current generation.
Consumer rollback captures that generation inside the transaction, not before
waiting for the queue. Composition ties each staged source to its prepared agent
generation and restores the prior source before releasing that transaction.
Schedule rollback restores activation records, including due-slot history,
rather than restarting the old schedule at rollback time.

Sources must not mutate declarations they have returned, including nested
schemas, schedules, and policy function bindings. Return fresh declarations for
replacements; unchanged declarations may be reused. The registry freezes its
snapshot envelope and normalized top-level definitions, not the executable
object graph. It does not deep-clone closures or sandbox source code.

`app-runtime.ts` wires the file source at startup and reload. The private Task
worker entrypoints wire the same source for their selected release. To supply
another source, provide an `AppDefinitionSource` function in composition; no core
registration change, plugin manifest, or additional configuration is required.
Sources remain trusted Host code, not a sandbox for untrusted executable Apps.
Task removal checks and route/observer/schedule publication retain their existing
owners; the registry does not take over their lifecycle.

## Reading order

| Question                                         | Entry point                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| Which source files are active?                   | `app-source-release.ts`: `DefinitionSourceReleaseStore`                        |
| How is an App discovered and validated?          | `adapters/discovery/app-definitions.ts`; `core/apps/definition-validation.ts` |
| How does reload publish a generation?            | `core/apps/registry.ts`: `reload()`; `app-runtime.ts` coordinates consumers    |
| What may an external caller publish or read?     | `packages/control/src/events.ts` and `client.ts` in the repository root        |
| How does the Host admit an event?                | `event-interface.ts`: `createEventInterface()`                                 |
| How are declared routes selected and remembered? | `app-inbox-runtime.ts`; `app-event-admission-store.ts`                         |
| How is one request handled?                      | `app-inbox-host.ts`: `reconcileOnce()` and `#handleRequest()`                  |
| Where are requests claimed and settled?          | `app-inbox-store.ts`                                                           |
| How are messages and Topics read?                | `conversations/store.ts`: `readAppConversationResource()`                      |
| Where does admission hand off durable work?      | `app-task-capability.ts`: `attach()`                                           |

## Two entry paths

```text
typed input -> persist request -> deferred request handler -> attach Task
fact        -> select and persist routes -> request admission or Task admission
```

An App's `task(input)` maps a typed request to an existing or desired Task.
Its `subscriptions[].toInput(event)` translates a fact into typed input;
`tasks.resolve(event)` can map a subscribed fact directly to Task intent.
These are pure mappings. The Task runtime owns execution after admission.

The request handler has three branches: handle a declared conversational input,
return the observed result of linked work, or attach the request to a Task.
Conversation handling uses `app-request-agent.ts`; Task attachment uses the
supplied Task capability. Dependency waiting is durable state, so it releases
the request handler's execution slot.

## Unavailable Task handlers

`core/tasks/handler-recovery.ts` runs one bounded pass over retained
`HandlerUnavailable` attempts. It asks an availability function about the exact
binding; only core may release attention and requeue that same Task. The
generation, resource version, attempt, cancellation and pause checks remain in
`app-task-reconciler.ts`. Recovery also requires active App lifecycle inside
the resource commit transaction, so a concurrent pause cannot release work.

The pass advances a cursor in the existing resource-store metadata before it
awaits inspection. Pages use the existing phase index and wrap after the last
row. Repeated startup/reload passes therefore reach later Tasks even when older
bindings stay missing or a recovery process exits. This is a recovery hint,
not a Task revision, new retry queue, or new timer.

`core/tasks/handler-availability.ts` checks the supplied agent, executor and
workflow bindings without executing them. Workflow inspection comes from the
selected runner; its lookup cache lasts one pass. An agent handoff still needs
its originating workflow's verification capability before it can recover.

Attempt workers load their selected agents only. Recovery workers load the
active validated agent catalog, including non-default agents named or inherited
by retained Tasks. This uses ordinary generation loading rather than a second
agent-selection index; it constructs definitions but never executes agents.

`app-task-runtime.ts` supplies the selected bindings, fences checks against the installed
definition, and queues recovered IDs through the existing controller. Neither
an old reload nor a slow check may release a newer Task attempt. Missing
bindings remain visible without repeated execution; restoring a binding is
rechecked through ordinary startup/reload recovery.

The isolated recovery process has no controllers. It still repairs durable
readiness and emits the existing recovery observation; the parent's recovery
pass finds the pending Task and owns execution. Repair must not require a local
controller or start an attempt in the recovery process.

Its definition fence rereads the durable active-release link after each
availability check; a child-local registry alone cannot observe a parent
reload. A superseded check leaves the exact Task and failed attempt intact.
Normal attempt workers keep their pinned source and are not stopped by this
availability fence.

The governing design is [System Boundary — Recovery](../../../may-agent.app/docs/2a-design/system-boundary.md#recovery)
and [Task Resource Engine — Pause, reload, and recovery](../../../may-agent.app/docs/2a-design/task-resource-engine.md#pause-reload-and-recovery)
and [Execution isolation](../../../may-agent.app/docs/2a-design/task-resource-engine.md#execution-isolation).
They require recovery to continue the same identity, keep state changes fenced,
and run execution outside the interface process; the worker is not another
Task owner. These exact references require the sibling design tree, not this
standalone Host checkout. The [core proposal's Step 3](../../../may-agent.app/docs/proposals/task-runtime-organization.md#step-3-finish-the-taskexecutor-boundary)
describes the incremental extraction, not an additional lifecycle authority.

## Task execution backends

Core claims work, constructs the fenced Task interface, maintains its lease and
cancellation signal, owns deadlines and workspace lineage, validates results,
and commits accepted state. It does not construct a model manager, load a
workflow, inspect transcripts, or repair a managed-agent session.

| Contract / implementation | Responsibility |
| --- | --- |
| SDK `TaskExecutor(attempt)` | One bounded custom executor call and proposed result; unchanged public contract |
| `core/tasks/execution.ts` | Private agent, workflow and session operations needed by existing Host backends |
| `adapters/executors/managed-agent.ts` | Agent preparation, role/prompt construction and managed execution |
| `adapters/executors/workflow.ts` | Workflow inspection, workspace requirements, bounded execution and verifier lookup |
| `adapters/executors/session-recovery.ts` | Session liveness, results, checkpoint context and safe process cleanup; never Task settlement |
| `adapters/executors/agent-workspace.ts` | Existing managed-agent canonical-workspace guard and deployment evidence |
| `composition/task-execution.ts` | Select the shipped backends; used by daemon and isolated-worker preparation |

These are ordinary private operations, not an SDK lifecycle or plugin system.
Composition may supply an executor map with no managed-agent or workflow
runner. App declarations and accepted Tasks remain installed when an agent is
unavailable. Work requiring it records exact unavailability; unrelated native
executors remain usable. Restoring a binding uses the same recovery pass.

At publication, the shipped runners snapshot their agent definitions. Active
attempts keep those definitions; new attempts use the replacement. Source roots
are the release chosen by composition, not an inferred checkout. Session
recovery uses the configured persistence directory, never a guessed `.state`
folder beside an App. Its optional checkpoint context is evidence for a new
attempt, not a requirement to resume a workflow stack.

Removing a session-recovery implementation cannot prove a retained session has
stopped. Drain managed sessions before omitting it, or restore that capability
to recover them. Core refuses replacement ownership without that proof.
Basic reads and work without retained managed sessions remain available.

`executeAttempt` remains the separate process-dispatch boundary; it is not a
backend's execution function. Stores, claims, result admission, cancellation,
Conditions and workspace finalization remain under the Task engine. No extra
timer, queue, persisted lifecycle, or live installation operation was added.

## State and process boundaries

### Basic reads and optional reports

`core/reads/app-read.ts` exposes canonical Task list/get, request results and
execution results. It neither constructs metrics nor reads outcome manifests.
Absent metric/outcome callbacks throw an explicit unavailable error; a missing
record from an installed capability can still return null.

`adapters/reporting/` owns metric-definition installation, metric views and
outcome grouping. The outcome reader receives only App directory plus canonical
list/get callbacks, never a private Task store. `composition/reporting.ts`
selects shipped reports; the CLI supplies them to runtime and private workers
select their outcome reader. No service is created just to prepare a read
context. Workflow/maintenance metric services are created on first use.

Metric-definition refresh observes a committed App generation outside its
publication transaction. Failure is reported to process diagnostics and cannot
reject that generation or rewrite accepted work. Interfaces are selected at
composition; a fixture runs real Task attempts with every human transport and
reporting omitted. Another fixture fails reporting through reload and verifies
old accepted results and new execution remain intact.

These boundaries implement Step 5 of the sibling core proposal; they do not
add a reporting registry, lifecycle, queue, or alternative state authority.

`app-inbox-store.ts` owns durable requests and their claims; the word inbox is
the implementation name for those requests. `conversations/store.ts` reads
that evidence and owns Topic links. Both use the same Host database.
`app-event-admission-store.ts` remembers the selected route payloads so retries
apply the recorded decision. None of these stores is an additional work owner.

`app-inbox-runtime.ts` still coordinates routes, request scheduling,
Conversation notifications, schedules, observers, and reload. It is the
integration point, not a new public API. Broad Task-intent admission runs in
`task-admission-process.ts`; exact wakes and request admission have bounded
in-process paths. Task execution uses `task-attempt-process.ts` separately.

Canonical design remains in the sibling `may-agent.app/docs`: start with
`2a-design/system-boundary.md` and `proposals/task-runtime-organization.md`.
This file is a source navigation guide, not a second system design.
