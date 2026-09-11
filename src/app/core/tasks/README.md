# Task lifecycle

This directory owns durable Task execution: queue work, claim one bounded attempt,
check its proposed result, and settle it or wait for another wake. Apps define
outcomes and acceptance; concrete executors are supplied by composition.

Read in this order:

1. `app-task-capability.ts` is the private entry point used by Host composition.
2. `controller.ts` and `queue.ts` select ready work under shared capacity.
3. `app-task-runtime.ts` coordinates claim, execution, verification and settlement.
   `runtime-definition.ts` prepares App descriptors, seed authority and project
   read models; installation/publication and rollback stay in the runtime.
4. `app-task-reconciler.ts` checks identity/revisions and applies state transitions
   through [`core/state`](../state/README.md).
5. `app-task-recovery.ts` schedules recovery; `startup-recovery.ts` and the
   handler/session helpers decide which retained work can safely run again.

`app-task-state.ts` defines persisted Task facts. `app-task-store.ts` provides
snapshot/mutation helpers, not another database authority. Context, Conditions,
event emission and output-path helpers live beside their lifecycle callers.
`execution.ts` and `workspace.ts` are private contracts; concrete implementations
live in `adapters/` and are selected in `composition/task-execution.ts`.

## Trace one Task

```text
admitted input -> stored Task -> queue hint -> capacity -> fenced claim
  -> bounded executor -> result/evidence checks -> fenced settlement
  -> accepted result, exact wait, another attempt, attention, or stop
```

| Stage | Follow in source | Durable authority |
| --- | --- | --- |
| Admit | `attachLoadedAppTask()` -> `core/state/inbox.ts: attachRequestToTask()` or `admitTaskRequest()`; declared event routes use `admitResolvedAppTaskEvent()` -> `observeAppTaskIntent()` | Atomic inbox attachment or idempotent event admission retains the owning Task |
| Dispatch | `controller.ts` -> `reconcileTask()` (or the composition-supplied worker) -> `claimObservedAppTask()` | Capacity limits local execution; the SQLite claim decides who owns this Task attempt |
| Execute | `reconcileTask()` -> agent/workflow/registered executor via `execution.ts` | The executor proposes a result; it cannot accept Task completion |
| Settle | `establishTaskAcceptance()` -> `completeAppTask()`, `deferAppTask()` or `markAppTaskAttention()`; execution exceptions use `failAppTaskAttempt()` | The reconciler checks current identity/evidence; `commitTaskMutation()` -> resource-store `commit()` fences and commits the write set |
| Cancel or stop | `cancelLoadedAppTask()` -> `cancelAppTask()`; an App stop result uses `stopAppTask()` | Cancellation ends the exact owned attempt; a late result cannot revive it. Stop does not claim success |
| Restart | `recoverInstalledAppTasks()` -> `recoverInterruptedAppTasks()`; `app-task-recovery.ts` restores queue hints | Recover the same Task; retained terminal agent output uses existing result admission. Missing output permits safe redo, not a completion claim |

These entry points are in `app-task-runtime.ts` or `app-task-reconciler.ts`
unless a path is given. New evidence can require another attempt; an unchanged
invalid result/verifier rejection stays visible for review. Queues and events
help discover work, while stored Tasks, attempts and Conditions retain it.

Definition preparation does not publish a generation. The runtime still owns
one publication/rollback boundary and pins execution definitions for attempts.
There is no second registry, recovery controller or state writer.

Start tests at `controller.test.ts`, `app-task-reconciler.test.ts` and
`app-task-runtime.test.ts`. Policy/context tests cover pure projections; recovery
and session tests cover restart ownership. Store transaction and reopen tests
live in [`core/state`](../state/README.md); real worker tests live in
[`composition/workers`](../../composition/workers/).
