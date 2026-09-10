# Host source map

The Host contains stable mechanics and replaceable capabilities. Start at
`app-runtime.ts` for process composition, then follow the responsibility below.
External means outside the core; it can live in the same repository and process.

The canonical [architecture](../../../may-agent.app/docs/2a-design/architecture.md),
[core principles](../../../may-agent.app/docs/1-principles/core-principles.md), and
[Host/App boundary](../../../may-agent.app/docs/2a-design/system-boundary.md)
live in the sibling App tree. This page maps source, not another system design.
For a standalone checkout, obtain those cited contracts before changing behavior.

## Reading order

```text
app-runtime.ts                         startup, reload, shutdown
  core/apps/registry.ts                validated App generation
  core/events/interface.ts -> bus.ts   input admission and observations
  app-inbox-runtime.ts                 routing and input dispatch
    app-inbox-host.ts                  claims, cancellation, selected handler
    composition/conversation-inbox.ts  conversational handling
    app-task-capability.ts             durable Task handoff
  core/tasks/controller.ts             queue and bounded dispatch
    app-task-runtime.ts                attempt orchestration
    app-task-reconciler.ts             state transitions and result admission
    app-task-resource-store.ts         canonical SQLite Task records
```

Input handling ends independently of an accepted Request or background Task.
A Task attempt proposes a result; only fenced state admission accepts it.
See [Conversation handling](conversations/README.md) for the interactive path.

## Ownership and extension starting points

Paths are relative to this directory unless otherwise noted. Colocated tests
own detailed behavior; [integration coverage](../../test/README.md) protects
cross-component and process boundaries.

| Responsibility | Contract and implementation | Wiring and owning tests |
| --- | --- | --- |
| App registration | `core/apps/registry.ts`: `AppDefinitionSource`; validation in `core/apps/definition-validation.ts`; file discovery in `adapters/discovery/app-definitions.ts` | `app-runtime.ts`; `core/apps/registry.test.ts` covers rejected/serialized publication |
| Events | `core/events/interface.ts` for ingress/reads; `core/events/bus.ts` for persisted admission and bounded observation | `app-runtime.ts` creates the interface; `daemon-events.ts` attaches persistence/subscribers; colocated interface/bus tests and `event-delivery.test.ts` |
| Input admission | `app-inbox-host.ts`, `app-inbox-store.ts`, `app-event-admission-store.ts`; frozen routes and durable claims | `app-inbox-runtime.ts`; inbox runtime, ownership and failure tests |
| Conversation | `core/inbox/input-handler.ts`; `conversations/context.ts`, `conversations/turn-handler.ts`, `conversations/turn-agent.ts` | `composition/conversation-inbox.ts`; turn-agent and inbox tests; [guide](conversations/README.md) |
| Conversation state | `core/state/conversations.ts`, `core/state/conversation-requests.ts`, `core/state/conversation-turns.ts`, `core/state/conversation-outcomes.ts` | Shared database; colocated state tests plus inbox integration tests |
| Atomic Task attachment | `core/state/inbox.ts`: `attachRequestToTask()` | `app-task-capability.ts`; `core/state/inbox.test.ts` |
| Atomic input completion | `core/state/inbox.ts`: `completeInboxInput()` commits the input result, accepted-Request closure and dependent wakes | `app-inbox-host.ts`; `core/state/conversation-requests.test.ts` and `app-inbox-host.test.ts` |
| Task dispatch | `core/tasks/controller.ts`, `core/tasks/queue.ts`; `host-capacity.ts`; `app-task-recovery.ts` | `app-task-runtime.ts`; controller/queue/recovery tests |
| Task transitions | `app-task-reconciler.ts`, `app-task-state.ts`, `app-task-resource-store.ts` | `app-task-runtime.ts`; reconciler/resource-store, cancellation and restart tests |
| Agent/workflow/session backend | `core/tasks/execution.ts`; `adapters/executors/` | `composition/task-execution.ts`; adapter and Task runtime tests |
| Named executor | SDK `TaskExecutor` / `TaskAttempt`; `codex-goal-executor.ts` | Executor map in `daemon-agents.ts`; executor and Task runtime tests |
| Task workspace | `core/tasks/workspace.ts`; `adapters/workspaces/git.ts` | `composition/task-execution.ts`; workspace and Task runtime tests |
| Timing and observations | `core/scheduling/timer.ts`; `adapters/producers/app-schedules.ts`, `app-observer-runtime.ts` | `app-inbox-runtime.ts`; timer, schedule and observer tests |
| Canonical reads and optional reports | `core/reads/app-read.ts`, `core/reads/reporting.ts`; `adapters/reporting/` | `composition/reporting.ts`; read/reporting and runtime tests |
| Host maintenance | `adapters/maintenance/` | `composition/maintenance*.ts`; [maintenance guide](adapters/maintenance/README.md) and colocated tests |
| Human interfaces | `transport/`, `http/`; root `packages/control`, `packages/terminal`, `packages/webui` | `interface-startup.ts`; transport and process/browser tests; [control guide](../../packages/control/README.md) |
| Agent/tool loading | `agent-loader.ts`, `loader/`; bounded execution under `../lib/` | `daemon-agents.ts`; loader and agent-execution tests |

`app-source-release.ts` captures the source used by a generation. Private workers
enter through `task-admission-process.ts` and `task-attempt-process.ts`.
Task context is assembled in `app-task-context.ts`; shared App summaries live in
`app-dependency-catalog.ts`. Runtime persistence primitives are under `../lib/db/`;
transcripts/artifacts are handled by `../lib/persistence.ts` and `../lib/artifacts.ts`.
The still-flat Task/inbox files retain the responsibilities shown above.

## Adding a capability

1. Start with its existing contract and one implementation in the table.
2. Add the implementation and focused tests beside that capability family.
3. Select it with an ordinary import in composition; own activation and cleanup.
4. Verify its failure or absence leaves unrelated work and accepted state correct.

Core imports contracts and foundational helpers; composition selects concrete
adapters and conversational handlers. ESLint protects this direction. Internal
loaders import owning modules directly: `../lib/index.ts` also exports the loader,
so importing back through it creates a cycle. The public SDK and control exports
remain the App/client boundaries. New database callers prefer focused `../lib/db/`
modules over the historical `../lib/requests.ts` compatibility facade.

Use typed calls for local reads, execution and atomic transitions. Use events
for meaningful inputs/changes and independent observers. App-owned prompts,
workflows, observers, schedules and acceptance stay in the owning App.
A new implementation does not require a universal adapter, manifest or lifecycle.

## Contract references

Keep behavioral detail and change status with their owners:

- [Runtime](../../../may-agent.app/docs/2a-design/runtime.md): startup, readiness,
  recovery, reload and shutdown.
- [Task engine](../../../may-agent.app/docs/2a-design/task-resource-engine.md):
  claims, waits, result admission, parent review, unavailable handlers and stop.
- [Workflows](../../../may-agent.app/docs/2a-design/workflows.md): bounded
  execution, repair and acceptance.
- [Storage](../../../may-agent.app/docs/2a-design/storage.md): authoritative
  records and transaction boundaries.
- [Events](../../../may-agent.app/docs/2a-design/events.md) and
  [scheduling](../../../may-agent.app/docs/2a-design/cron.md): admission, wakes,
  observations and timing.
- [Message lifecycle](../../../may-agent.app/docs/2a-design/message-lifecycle.md):
  Turn, Request, Topic, Task and follow-through semantics.
- [Simplification review](../../../may-agent.app/docs/proposals/authority-boundary-simplification.md):
  conditional feature reductions and remaining organization work.
