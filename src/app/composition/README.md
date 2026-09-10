# Host composition

Composition selects concrete capabilities and owns their activation and cleanup.
The process entry remains [`app-runtime.ts`](../app-runtime.ts). Follow its calls
into this directory before reading the relevant core state machine.

| Module | Wires |
| --- | --- |
| `app-inbox-runtime.ts` | Event routes, input dispatch, Task handoff, Conversation notifications, schedules, observers and reload |
| `conversation-inbox.ts` | Generic inbox Host with the Conversation handler |
| `task-execution.ts` | Shipped agent/workflow/session and workspace implementations |
| `background-startup.ts` | Startup/recovery order |
| `reporting.ts` | Optional report implementations |
| `maintenance*.ts` | Bounded maintenance selection, activation and cleanup |
| `workers/task-admission-process.ts` | Isolated broad Task admission |
| `workers/task-attempt-process.ts` | Isolated attempt execution and session recovery |

Workers enter through the existing CLI modes in `may.ts`, using the same binary
entrypoint as before. They construct concrete registries, execution and
persistence. Their subprocess protocol and lifetime limits remain unchanged.
Mixed inbox orchestration belongs here because it selects concrete behavior;
claims and transitions remain in [`core/inbox`](../core/inbox/README.md) and
[`core/tasks`](../core/tasks/README.md).

`app-inbox-runtime.test.ts` covers routing and reload;
`app-inbox-containment.test.ts` covers dispatch failure and shutdown cleanup.
Worker tests execute committed subprocess probes, with integration fixtures in
`test/integration/fixtures/`. Startup, reporting and maintenance tests live beside
the corresponding wiring. No module should start background work just by import.
