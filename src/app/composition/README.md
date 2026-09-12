# Host composition

Composition selects concrete capabilities and owns their activation and cleanup.
The process entry remains [`app-runtime.ts`](../app-runtime.ts). Follow its calls
into this directory before reading the relevant core state machine.

| Module | Wires |
| --- | --- |
| `app-inbox-runtime.ts` | Event routes, direct input admission, Task handoff, Conversation notifications, schedules, observers and reload |
| `conversation-task-turn.ts` | Conversation context and judgment inside a Task attempt |
| `task-execution.ts` | Shipped agent/workflow/session and workspace implementations |
| `background-startup.ts` | Startup/recovery order |
| `reporting.ts` | Optional report implementations |
| `maintenance*.ts` | Bounded maintenance selection, activation and cleanup |
| `workers/task-admission-process.ts` | Isolated broad Task admission |
| `workers/task-attempt-process.ts` | Isolated attempt execution and session recovery |

Workers enter through the existing CLI modes in `may.ts`, using the same binary
entrypoint as before. They construct concrete registries, execution and
persistence. Their subprocess protocol and lifetime limits remain unchanged.
Input routing belongs here because it selects concrete behavior.
[`core/inbox`](../core/inbox/README.md) owns admission and correlation;
[`core/tasks`](../core/tasks/README.md) owns execution claims and transitions.

`app-inbox-runtime.test.ts` covers routing and reload;
`app-inbox-containment.test.ts` covers admission and reporting failure without losing saved input.
Worker tests execute committed subprocess probes, with integration fixtures in
`test/integration/fixtures/`. Startup, reporting and maintenance tests live beside
the corresponding wiring. No module should start background work just by import.
