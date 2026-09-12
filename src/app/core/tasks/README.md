# Task lifecycle

This directory owns one execution lifecycle for every Task: queue work, claim a
bounded attempt, check its proposed result, commit evidence and release execution.
Conversation is a Task's human-facing role. Apps define meaning and acceptance;
composition supplies handlers. The assigning App, parent or human owns closure.
An accepted outcome leaves the Task open for later relevant input. Unfinished
work retains its input and evidence and retries with backoff or an exact wait.

Read in this order:

1. `app-task-capability.ts` is the private entry point used by Host composition.
2. `controller.ts` and `queue.ts` select ready work under shared capacity.
3. `app-task-runtime.ts` coordinates claim, execution, verification and settlement.
   `runtime-definition.ts` prepares App descriptors, seed authority and project
   read models; installation/publication and rollback stay in the runtime.
4. `app-task-reconciler.ts` checks identity/revisions and applies state transitions
   through [`core/state`](../state/README.md).
5. `app-task-recovery.ts` schedules recovery; `startup-recovery.ts` checks
   retained session eligibility. `adapters/executors/session-recovery.ts`
   preserves session evidence and drains orphaned execution before safe redo.

`app-task-state.ts` defines persisted Task facts. `app-task-store.ts` provides
snapshot/mutation helpers, not another database authority. Context, Conditions,
event emission and output-path helpers live beside their lifecycle callers.
`execution.ts` and `workspace.ts` are private contracts; concrete implementations
live in `adapters/` and are selected in `composition/task-execution.ts`.

## Trace one Task

```text
admitted input -> stored Task -> queue hint -> capacity -> fenced claim
  -> bounded executor -> result/evidence checks -> fenced settlement
  -> accepted outcome and rest, exact wait, or retained input with paced retry

authorized owner -> close Task -> fence running execution and future wakes
```

| Stage | Follow in source | Durable authority |
| --- | --- | --- |
| Admit | `attachLoadedAppTask()` -> `core/state/inbox.ts: admitTaskRequest()`; declared event routes use `admitResolvedAppTaskEvent()` -> `observeAppTaskIntent()` | Atomic inbox attachment or idempotent event admission retains the owning Task |
| Dispatch | `controller.ts` -> `reconcileTask()` (or the composition-supplied worker) -> `claimObservedAppTask()` | Capacity limits local execution; the SQLite claim decides who owns this Task attempt |
| Execute | `reconcileTask()` -> selected handler via `execution.ts`; human context is prepared by `composition/conversation-task-turn.ts` | Every handler uses the same Task claim. It proposes a result without acquiring closure authority |
| Settle | `establishTaskAcceptance()` -> `completeAppTask()`, `deferAppTask()` or `markAppTaskAttention()`; human-facing effects use `core/state/conversation-task-turns.ts`; exceptions use `failAppTaskAttempt()` | The reconciler fences acceptance. Replies, Request updates and authorized effects commit with the Task result; unfinished input survives failure |
| Close or stop an attempt | `cancelLoadedAppTask()` -> `cancelAppTask()` closes the assignment; `stopLoadedConversationTurn()` stops the observed human Turn | Closure fences future work. Turn Stop preserves newer input. The legacy-named `stopAppTask()` records a worker failure report and retries; it does not close the Task |
| Restart | `recoverInstalledAppTasks()` -> `recoverInterruptedAppTasks()`; `app-task-recovery.ts` restores queue hints | Accepted Task results survive. Uncommitted execution retries the same input after ownership/cleanup checks; session output remains evidence for normal execution and validation |

These entry points are in `app-task-runtime.ts` or `app-task-reconciler.ts`
unless a path is given. Result rejection retains unfinished work and paces its
next attempt. Queues and events help discover work, while stored Tasks, attempts
and Conditions retain it. A timer rediscovers eligible work; it does not create
a separate maintenance lifecycle.

## Read the retained names correctly

| Name in code | Meaning in this lifecycle |
| --- | --- |
| `achieve` / `maintain` | Retained App intent labels; neither selects a different lifetime |
| `converged` / SDK `done` | An accepted outcome; later input can run the same open Task |
| Worker result `stopped` / `stopAppTask()` | Unsuccessful attempt evidence; unfinished work retries with backoff |
| Turn Stop / `stopAppTaskAttempt()` | Stop the observed attempt; keep the Task and accepted Requests |
| `cancelAppTask()` / SDK `closed` | Authorized owner ends the assignment; retained evidence remains readable |

Task attempt failures persist their retry deadline, backing off from 250 ms to
15 minutes during prolonged failure. Fresh human input still permits one new
attempt. Dispatch or storage errors before that write use `controller.ts`'s local
timer (250 ms to 30 seconds). Neither path has a failure-count stop. These timers
pace different work: a dispatch may only retry a storage operation; an attempt
may spend model tokens or perform effects. Backoff limits frequency, not lifetime
spending. The owner can revise, pause or close the assignment.

New dependencies add work; stored waits survive omission from later results.
The agent need not repeat old requests to add another one for the same App.
Exact request reuse, duplicate detection and stale-effect fences remain; the
Host does not infer that a differently worded request replaces earlier work.

Definition preparation does not publish a generation. The runtime still owns
one publication/rollback boundary and pins execution definitions for attempts.
There is no second registry, recovery controller or state writer.

Start tests at `controller.test.ts`, `app-task-reconciler.test.ts` and
`app-task-runtime.test.ts`. Policy/context tests cover pure projections; recovery
and session tests cover restart ownership. Store transaction and reopen tests
live in [`core/state`](../state/README.md); real worker tests live in
[`composition/workers`](../../composition/workers/).
