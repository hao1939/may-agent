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
| Settle | `establishTaskAcceptance()` -> `completeAppTask()`, `deferAppTask()` or `markAppTaskAttention()`; human-facing effects use `core/state/conversation-task-turns.ts`; execution failures and the diagnostic wrapper share `failAppTaskAttempt()` | The reconciler fences acceptance. Replies, Request updates and authorized effects commit with the Task result; unfinished input survives failure |
| Close or stop an attempt | `cancelLoadedAppTask()` -> `cancelAppTask()` closes the assignment; `stopLoadedConversationTurn()` stops the observed human Turn | Closure fences future work. Turn Stop preserves newer input. The legacy-named `stopAppTask()` records a worker failure report and retries; it does not close the Task |
| Restart | `recoverInstalledAppTasks()` -> `recoverInterruptedAppTasks()`; `app-task-recovery.ts` restores queue hints | Accepted Task results survive. Uncommitted execution retries the same input after ownership/cleanup checks; session output remains evidence for normal execution and validation |

These entry points are in `app-task-runtime.ts` or `app-task-reconciler.ts`
unless a path is given. Result rejection retains unfinished work and paces its
next attempt. Queues and events help discover work, while stored Tasks, attempts
and Conditions retain it. A timer rediscovers eligible work; it does not create
a separate maintenance lifecycle. `recoverTaskConditions()` reads exact input
answers and selected reports, then replays them and retained external Events
through the same Condition transition. Feedback survives a missed notification;
no extra delivery queue is needed.

`project.task.reconciled` and `app.task.cancelled` also notify result readers.
Composition refreshes exact input feedback and linked Conversation observations
from those facts. `core/inbox/input-result.ts` builds `app.dependency.updated`
for both live delivery and recovery: `blocked` returns the input's selected
report; `done` returns its answer or owner closure. A report may be accepted
`stopped`/`waiting` evidence or a factual failed-attempt reference, never an
invented answer. `failAppTaskAttempt()` saves the first failure report in the
same transaction as retry state; its diagnostic wrapper shares that path.
Internal workflow-to-agent handoff does not select a failure report.
`app-task-condition-tracker.ts` wakes the caller once per selected report
revision while keeping the wait unsatisfied. Automatic retries remain quiet.
An agent may deliberately select new feedback with `waiting.report: true`;
omitting the flag keeps an ordinary wait quiet. Delayed older reports cannot
replace the latest selection. This does not guarantee every intermediate update.
The later answer satisfies the wait, even if the caller is retrying its own work.
Conversation uses the same saved selection; answer or closure suppresses newly
admitting obsolete reports without erasing inputs already admitted as history.
This is not a general progress stream. Apps can still declare relevant event routes.

## Read the retained names correctly

| Name in code | Meaning in this lifecycle |
| --- | --- |
| `achieve` / `maintain` | Retained App intent labels; neither selects a different lifetime |
| `converged` / SDK `done` | An accepted outcome; later input can run the same open Task. Owner closure preserves this outcome status; read `closed` separately |
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
A missed Condition checkpoint reports which waits are due. It carries no "final
review" count: repeated reviews keep the declared timing, and the owner decides
whether the assignment should continue.

New work is requested through `TaskReconcileResult.dependencies`: the destination
App validates `input` and chooses its Task specification and executor. Workers
cannot return raw `create-task` actions. `update-task` and `unblock-task` target
existing assignments and require their current generation. `admitTaskAppDependencies()`
in `app-task-runtime.ts` publishes delegated input; `app-task-inputs.ts` resumes
the caller's exact saved input when feedback arrives through its retained wait.

Parent links organize work and scope reads/actions. They neither wait for nor
subscribe to child outcomes. Typed dependencies return exact input answers;
Conditions await facts. `dependsOn` remains a static execution gate, not a return
link. Workflow reconciliation receives the same saved waits as registered
executors.

Before adopting this breaking change, retire saved implicit waits offline using
`migrateTaskCoordination()` in `core/state` (also included by `migrateOpenTaskState`).
It replays original unfinished inputs for one review without inventing answers
from current child status. Missing input aborts conversion; accepted answers and
owner closure are retained. The old workers must be stopped.

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

Task-owned workflows can return `TaskReconcileResult` directly, like registered
executors. Standalone helpers retain execution results. The workflow adapter
records bounded execution; normal Task admission still rejects invalid results.
A completed workflow call alone never establishes an accepted Task outcome.

`app-task-emitter.ts` exposes scoped publication and exact publication reads.
A workflow can read its original fact from `core/state/task-emissions.ts` after
losing result acceptance, then propose the same outcome from that evidence.
The local effect key follows admitted work, not attempt or mode. It remains
App-owned; a new input on the same open Task may need a distinct key. A read
proves publication only, and same-key/different-payload writes still fail.

Publication keys encode an unambiguous tuple. Existing receipts remain readable
and reusable only when their indexed App/Task identity matches the caller.
Reads use the shared integrity-checked event loader, including artifact bodies;
a missing or corrupt known body fails visibly rather than permitting blind redo.
The fact's stored emission scope is verified before data crosses the capability.

Failure notifications use `retrying` for retained work. `retryAt` is the stored
backoff deadline, or `null` when fresh human input permits an immediate attempt.
Agent handoff remains distinct; no new retry state or scheduling policy is added.

A new rejection or handoff diagnostic replaces the current evidence links;
omitting them clears that list. An execution failure alone retains prior links.
Neither transition changes the evidence in historical accepted attempts.
