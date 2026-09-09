# Host App loading and admission

Start with `runAppRuntime()` in `app-runtime.ts`. It connects definitions,
admission, Task execution, and interfaces. These files implement the Host;
installed Apps supply domain meaning through `@may-agent/sdk`.

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

Code navigation lives here; the canonical design remains
[Host and App Boundary](../../../may-agent.app/docs/2a-design/system-boundary.md)
and [Events and Task Admission](../../../may-agent.app/docs/2a-design/events.md).
