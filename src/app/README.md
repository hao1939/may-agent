# Host code boundaries

The Host contains both stable mechanics and replaceable implementations.
"External" means outside the core, not necessarily another package or process.

| Home | Responsibility | Current entrypoint |
| --- | --- | --- |
| `core/` | Identity, authority, and recovery rules shared by every capability | `apps/registry.ts` validates and publishes generations; `tasks/startup-recovery.ts` keeps Task-bound sessions under Task recovery |
| `adapters/` | Concrete capability implementations | `discovery/app-definitions.ts` reads conventional App files; `producers/agent-triggers.ts` attaches legacy event handlers and optional timers |
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
waiting for the queue.

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
