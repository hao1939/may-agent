# Host code boundaries

The Host contains both stable mechanics and replaceable implementations.
"External" means outside the core, not necessarily another package or process.

| Home | Responsibility | Current entrypoint |
| --- | --- | --- |
| `core/` | Identity, authority, and recovery rules shared by every capability | `tasks/startup-recovery.ts` keeps Task-bound sessions under Task recovery |
| `adapters/` | Concrete capability implementations | `producers/agent-triggers.ts` attaches legacy event handlers and optional timers |
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

## Reading order

| Question                                         | Entry point                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| Which source files are active?                   | `app-source-release.ts`: `DefinitionSourceReleaseStore`                        |
| How is an App discovered and validated?          | `loader/app-loader.ts`: `loadAppDefinitions()`; `app-definition-validation.ts` |
| How does reload publish a generation?            | `app-registry.ts`: `reload()`; `app-runtime.ts` coordinates consumers          |
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
`app-task-reconciler.ts`.

The pass advances a cursor in the existing resource-store metadata before it
awaits inspection. Pages use the existing phase index and wrap after the last
row. Repeated startup/reload passes therefore reach later Tasks even when older
bindings stay missing or a recovery process exits. This is a recovery hint,
not a Task revision, new retry queue, or new timer.

`adapters/executors/handler-availability.ts` looks up registered executors and
inspects conventional workflow modules without executing them. Its lookup cache
lasts one pass. It does not own Task state or retries.

`app-task-runtime.ts` still contains transitional composition: it supplies the
selected executor map and workflow paths, fences checks against the installed
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

This separates recovery availability, not the entire execution system. Managed
agent preparation, workflow execution, and backend-specific session recovery
remain in the mixed runtime until their own boundary is extracted. Keep the
SDK's `TaskExecutor(attempt)` contract; no public lifecycle hooks, extra timer,
or replacement queue are needed for this recovery pass.

## State and process boundaries

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
