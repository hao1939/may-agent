# Host source map

The Host contains stable mechanics and replaceable capabilities. Start at
`app-runtime.ts` for process composition, then follow the responsibility below.
External means outside the core; it can live in the same repository and process.

The Host persists work, runs bounded attempts, enforces generic controls and
exposes results. Apps and agents judge desired outcomes, acceptance and useful
next actions. Installation composition selects trusted scope and destinations.
Keep these responsibilities separate: an App's name or directory must not
select a privileged behavior in generic infrastructure.

This page maps the owning source and tests. App-specific designs belong to the
App and may be supplied as context for a change; they are not a prerequisite
for working on this repository.

## Reading order

```text
app-runtime.ts                              startup, reload, shutdown
  core/apps/registry.ts                     validated App generation
  core/events/interface.ts -> bus.ts        input admission and observations
  composition/app-inbox-runtime.ts          routing and admission recovery
    core/inbox/app-inbox-host.ts            validation, Task mapping, input results
    core/tasks/app-task-capability.ts       durable Task handoff
  core/tasks/controller.ts                  queue and bounded dispatch
    core/tasks/app-task-runtime.ts          attempt orchestration
    core/tasks/app-task-reconciler.ts       state transitions and result admission
    core/state/app-task-resource-store.ts   canonical SQLite Task records
```

Input handling ends independently of an accepted Request or background Task.
A Task attempt proposes a result; only fenced state admission accepts it.
See [Conversation handling](conversations/README.md) for the interactive path.
The console loop reports input failures locally and remains available for the
next input; a rejected admission must not terminate unrelated background work.
Reporting does not retry the input or claim it was accepted.
CLI argument parsing captures one human-interface binding before choosing a
mode. Runtime, web, send and maintenance wiring carry that selection forward;
the [control guide](../../packages/control/README.md#selecting-a-human-interface)
defines precedence and the distinction between interface identity and recipient.

## Ownership and extension starting points

Paths are relative to this directory unless otherwise noted. Colocated tests
own detailed behavior; [integration coverage](../../test/README.md) protects
cross-component and process boundaries.

| Responsibility | Contract and implementation | Wiring and owning tests |
| --- | --- | --- |
| App registration | `core/apps/registry.ts`: `AppDefinitionSource`; validation in `core/apps/definition-validation.ts`; file discovery in `adapters/discovery/app-definitions.ts` | `app-runtime.ts`; `core/apps/registry.test.ts` covers rejected/serialized publication |
| Events | `core/events/interface.ts` for ingress/reads; `core/events/bus.ts` for persisted admission and bounded observation | `app-runtime.ts` creates the interface; `daemon-events.ts` attaches persistence/subscribers; colocated interface/bus tests and `event-delivery.test.ts` |
| Input admission | `core/inbox/app-inbox-host.ts`, `core/state/app-inbox-store.ts`, `core/state/app-event-admission-store.ts`; frozen routes and durable input identities | `composition/app-inbox-runtime.ts`; inbox admission, routing and failure tests |
| Conversation | `conversations/context.ts`, `conversations/turn-agent.ts` | `composition/conversation-task-turn.ts`; turn-agent and Task runtime tests; [guide](conversations/README.md) |
| Conversation state | `core/state/conversations.ts`, `core/state/conversation-requests.ts`, `core/state/conversation-task-turns.ts`, `core/state/conversation-outcomes.ts` | Shared database; colocated state tests plus inbox integration tests |
| Atomic Task attachment | `core/state/inbox.ts`: `admitTaskInput()` | `core/tasks/app-task-capability.ts`; `core/state/inbox.test.ts` |
| Atomic input completion | `core/state/inbox.ts`: `completeTaskInput()` projects an exact Task answer; Conversation Request closure belongs to fenced Turn settlement | `core/inbox/app-inbox-host.ts`; `core/state/conversation-requests.test.ts` and `core/inbox/app-inbox-host.test.ts` |
| Task definition preparation | `core/tasks/runtime-definition.ts`: descriptors, seed authority and project read models | Publication/rollback stay in `core/tasks/app-task-runtime.ts`; [Task lifecycle reading path](core/tasks/README.md#trace-one-task) |
| Task dispatch | `core/tasks/controller.ts`, `core/tasks/queue.ts`; `core/scheduling/host-capacity.ts`; `core/tasks/app-task-recovery.ts` | `core/tasks/app-task-runtime.ts`; controller/queue/recovery tests |
| Task transitions | `core/tasks/app-task-reconciler.ts`, `core/tasks/app-task-state.ts`, `core/state/app-task-resource-store.ts` | `core/tasks/app-task-runtime.ts`; reconciler/resource-store, cancellation and restart tests |
| Agent/workflow/session backend | `core/tasks/execution.ts`; `adapters/executors/` | `composition/task-execution.ts`; adapter and Task runtime tests |
| Named executor | SDK `TaskExecutor` / `TaskAttempt`; [`Codex goal executor`](adapters/executors/codex/README.md) | Executor map in `daemon-agents.ts`; executor and Task runtime tests |
| Task workspace | `core/tasks/workspace.ts`; `adapters/workspaces/git.ts` | `composition/task-execution.ts`; workspace and Task runtime tests |
| Timing and observations | `core/scheduling/timer.ts`; [`App schedules and observers`](adapters/producers/README.md) | `composition/app-inbox-runtime.ts`; timer, schedule and observer tests |
| Canonical reads and optional reports | `core/reads/app-read.ts`, `core/reads/reporting.ts`; `adapters/reporting/` | `composition/reporting.ts`; read/reporting and runtime tests |
| Host maintenance | `adapters/maintenance/` | `composition/maintenance*.ts`; [maintenance guide](adapters/maintenance/README.md) and colocated tests |
| Human interfaces | `transport/`, `http/`; root `packages/control`, `packages/terminal`, `packages/webui` | `interface-startup.ts`; transport and process/browser tests; [control guide](../../packages/control/README.md) |
| Agent/tool loading | `agent-loader.ts`, `loader/`; bounded execution under `../lib/` | `daemon-agents.ts`; loader and agent-execution tests |

`app-source-release.ts` captures the source used by a generation. Private workers
enter through `composition/workers/task-admission-process.ts` and `composition/workers/task-attempt-process.ts`.
Task context is assembled in `core/tasks/app-task-context.ts`; shared App summaries live in
`app-dependency-catalog.ts`. Runtime persistence primitives are under `../lib/db/`;
transcripts/artifacts are handled by `../lib/persistence.ts` and `../lib/artifacts.ts`.
For hosted sessions, context preparation and workflow execution, follow the
[execution source map](../lib/README.md).
Component guides cover [inbox](core/inbox/README.md), [Tasks](core/tasks/README.md),
[state](core/state/README.md), [scheduling](core/scheduling/README.md), and
[composition](composition/README.md).

## Adding a capability

1. Start with its existing contract and one implementation in the table.
2. Add the implementation and focused tests beside that capability family.
3. Select it with an ordinary import in composition; own activation and cleanup.
4. Verify its failure or absence leaves unrelated work and accepted state correct.

Core imports contracts and foundational helpers; composition selects concrete
adapters and conversational handlers. ESLint protects this direction. Executor
adapters may import lifecycle types, but cannot import Task runtime or
store mutation implementations. The persisted executor/recovery identity lives
beside the small `core/tasks/session-binding.ts` contract. Task claims select their capacity lane from trusted input origin.
Input admission itself consumes no worker capacity.

Internal loaders import owning modules directly: `../lib/index.ts` also exports the loader,
so importing back through it creates a cycle. The public SDK and control exports
remain the App/client boundaries. New database callers prefer focused `../lib/db/`
modules over the historical `../lib/requests.ts` compatibility facade.

Use typed calls for local reads, execution and atomic transitions. Use events
for meaningful inputs/changes and independent observers. App-owned prompts,
workflows, observers, schedules and acceptance stay in the owning App.
A new implementation does not require a universal adapter, manifest or lifecycle.

## Contract references

Keep behavioral detail and change status with their owners:

- [App definitions](../../packages/sdk/src/app.ts): public registration, input,
  Task mapping, schedule and observer declarations.
- [Task and workflow results](../../packages/sdk/src/workflow.ts): the public
  execution context and returned decisions.
- [Control guide](../../packages/control/README.md): event admission, typed
  reads and resource controls.
- [Conversation handling](conversations/README.md): saved communication state
  and its relationship to Task execution.
- [Maintenance](adapters/maintenance/README.md): Host-owned upkeep and its limits.
- [Verification](../../test/README.md): portable contract coverage and explicit
  installation checks.

Use the source map above for the lifecycle and persistence owners. Include
external requirements in a work item's context when the change spans an App;
do not make these entry points depend on that App's name or manual location.

Routine Task checks increment bounded counters instead of publishing Task updates
or timing without an attempt. Private workers return those counts with their result;
the existing sampler records `task.skipped-check-count` every five minutes, with
the window, reason counts and total checks. Sampling creates no event. The metric
has no default alert; Apps can calibrate a rule using ordinary metric evaluation.
Unsampled counts may be lost on restart or worker loss; these are activity samples,
not an exact audit. Actual recovery transitions and attempt timing remain evidence.
Passive diagnostics use the Event bus record-only marker: interested subscribers
still receive them, but they do not require a new worker. The originating failed
publication keeps its own delivery status. Observer failure notifications track
changes within the current runtime; repeated failures refresh readable health,
success clears the episode, and failed publication retries on the normal cadence.
Resource observers also deliver unchanged values to new exact Conditions.
