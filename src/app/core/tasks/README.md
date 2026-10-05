# Task lifecycle

This directory owns one execution lifecycle for every Task: queue work, claim a
bounded attempt, check its proposed result, commit facts and release execution.
Conversation is a Task's human-facing role. Apps define meaning and acceptance;
composition supplies handlers. The assigning App, parent or human owns closure.
An accepted outcome leaves the Task open for later relevant input. Unfinished
work retains its input and facts and retries with backoff or an exact wait.

Read in this order:

1. `app-task-capability.ts` is the private entry point used by Host composition.
2. `controller.ts` and `queue.ts` select ready work under shared capacity.
3. `attempt-runner.ts: runTaskAttempt()` claims work; `runClaimedTask()` prepares
   its workspace, opens one attempt around `executeTaskHandler()`, then settles
   the returned report. `attempt-execution.ts: runTaskExecutorAttempt()` owns the
   shared Task context, lease renewal, event observation and cleanup. Agent,
   workflow, registered-executor and Conversation handlers use that open attempt.
   `dependency-admission.ts` admits typed delegation and recovers exact waits.
   `app-task-runtime.ts` installs controllers and wires routes; `runtime-definition.ts`
   prepares App descriptors and binds their existing state authority.
4. `app-task-reconciler.ts` checks identity/revisions and applies state transitions
   through [`core/state`](../state/README.md).
5. `app-task-recovery.ts` schedules recovery; `startup-recovery.ts` checks
   retained session eligibility. `adapters/executors/session-recovery.ts`
   preserves session facts and drains orphaned execution before safe redo.

`app-task-state.ts` defines persisted Task facts. `app-task-store.ts` provides
snapshot/mutation helpers, not another database authority. Context, Conditions,
event emission and output-path helpers live beside their lifecycle callers.
`execution.ts` and `workspace.ts` are private contracts; concrete implementations
live in `adapters/` and `conversations/`, selected in `composition/task-execution.ts`.

## Trace one Task

```text
admitted input -> stored Task -> queue hint -> capacity -> fenced claim
  -> bounded executor -> result/facts checks -> fenced settlement
  -> accepted outcome and rest, exact wait, or retained input with paced retry

authorized owner -> close Task -> fence running execution and future wakes
```

| Stage | Follow in source | Durable authority |
| --- | --- | --- |
| Admit | `attachLoadedAppTask()` -> `core/state/inbox.ts: admitTaskInput()`; declared event routes use `admitResolvedAppTaskEvent()` -> `observeAppTaskIntent()` | Atomic inbox attachment or idempotent event admission retains the owning Task |
| Dispatch | `controller.ts` -> `attempt-runner.ts: runTaskAttempt()` (locally or in the worker) -> `claimObservedAppTask()` | Capacity limits local execution; the SQLite claim decides who owns this Task attempt |
| Execute | `attempt-execution.ts` -> selected handler via `execution.ts`; human context comes from `conversations/context.ts` through composition | Every handler uses the same Task claim. It proposes a result without acquiring closure authority |
| Settle | `establishTaskAcceptance()` -> `completeAppTask()`, `deferAppTask()` or `failAppTaskAttempt()`; human-facing effects use `core/state/conversation-task-turns.ts` | The reconciler fences acceptance. Replies, Request updates and authorized effects commit with the Task result; unfinished input survives failure |
| Close or stop an attempt | `cancelLoadedAppTask()` -> `cancelAppTask()` closes the assignment; `stopLoadedConversationTurn()` stops the observed human Turn | Closure fences future work. Turn Stop preserves newer input. `reportAppTaskFailure()` records a worker failure report and retries; it does not close the Task |
| Restart | `recoverInstalledAppTasks()` -> `recoverInterruptedAppTasks()`; `app-task-recovery.ts` restores queue hints | Accepted Task results survive. Uncommitted execution retries the same input after ownership/cleanup checks; session output remains facts for normal execution and validation |

Waiting settlement follows one sequence in `runClaimedTask()`: fence and finalize
the workspace, validate/merge declared Conditions and admit dependencies, commit
through `deferAppTask()`, then recover already-saved feedback. Each rejection
returns through the existing unsuccessful-attempt settlement. The executor's
proposal is retained unchanged; settlement prepares its own observations.
Omitted Conditions remain the reconciler's responsibility, and a failed step
cannot accept proposed actions. Keep this ordering when extracting helpers.

Workspace preparation must succeed before any selected handler runs. Preparation
failure returns directly to unsuccessful-attempt settlement. Each result branch
then either commits that report or returns a separate rejection; it does not
rewrite the report's state and fall through to another branch. Failure diagnostics
and ordinary execution errors use `failAppTaskAttempt()`; its stored disposition
determines immediate handoff versus paced retry.

Task context reads also finish before attempt subscriptions are acquired. A
failed role or context read leaves no observer outside the cleanup boundary;
ordinary unsuccessful-attempt settlement retains the work for retry.

The Host supplies the accepted Task snapshot before executor-selected reads.
`runtimeTaskAttempt()` attaches `task`, the assigned `events`, and one scoped
`read.tasks` capability. Workflows receive the snapshot as `reconciliation.task`;
managed and Codex model adapters share the state projection in
`task-decision-context.ts`. Model previews link omitted material to saved detail;
workflow objects remain structured data. Accepted work, Conditions, input
obligations and pending input coexist. A fresh read supplements the assigned
batch and never expands its authority. Native transports still determine which
live capabilities reach their worker; a serialized reader is not a tool bridge.

`createRuntimeTaskRead()` in `reads/app-read.ts` assembles the shared Task reader
and supplies its reads to optional outcome reporting. `createRuntimeAppRead()`
adapts those operations to the SDK's Promise interface. Loaded-App access and
model tools use the same implementation. Adapters preserve options and format
results; the reporting implementation owns outcome membership and counts.

Task profiling retains dispatch identity, queue wait and total elapsed time.
Session timestamps and execution-usage records supply execution duration, prompt
preparation size and token usage. Task adapters do not duplicate those observations
with provider callbacks. Lease renewal, execution deadlines and the event-loop
yield remain execution mechanics, independent of these passive measurements.

Installation and external controls enter through `app-task-runtime.ts`. The attempt
sequence and result checks live in `attempt-runner.ts`; only the existing reconciler
applies canonical transitions. Result rejection retains unfinished work and paces its
next attempt. Queues and events help discover work, while stored Tasks, attempts
and Conditions retain it. A timer rediscovers eligible work; it does not create
a separate maintenance lifecycle. `dependency-admission.ts: recoverTaskConditions()` reads exact input
answers and selected reports, then replays them and retained external Events
through the same Condition transition. Feedback survives a missed notification;
no extra delivery queue is needed.

### One admission and reconciliation model

Admission validates and saves the input or change, including its responsible
route when handling is required, before returning a receipt. Handling runs
separately: the worker reads current requirements and facts, acts and reports.
A failed handler leaves accepted work available for the same recovery path.
A receipt confirms acceptance; the saved result establishes what was handled.
Admission and result projection persist their own bounded retry deadlines, so an
unchanged failure is paced while fresh exact evidence and unrelated obligations
can still advance. Before a Task exists, admission failure returns through the
saved typed App caller when one exists; replay must reach that caller's normal
Task consideration path, not merely emit an event or invoke a callback. Inputs
without a typed App caller retain diagnostics and retry, but do not acquire a
guessed fallback owner.

Exact Task reads expose `currentObligations` as the common, read-only account of
current timing and retained input work. `{ available: false }` means Runtime
cannot authoritatively supply this projection; it is not evidence that no
obligations exist. When available, `reviewAt` is the Task's authoritative
absolute reconsideration deadline, and `inputWaits.items` is a bounded list of
exact admission keys with input/admission correlation, per-input review timing
and Condition counts. `maxItems` and `truncated` disclose the bound: omitted
items remain obligations and callers must not infer fulfillment from absence.
App-specific policy may interpret this evidence, but does not redefine it.

To inspect an older request before its timer is due, use `tasks.get` with exact
`inputKeys` (up to eight). The canonical reader returns original `inputEvents`;
reading changes no state. An ordinary result's `inputKeys` names its complete
scope (up to 64); omission uses the saved assignment and accepted live requests,
and `[]` covers none. When `inputKeys` is explicitly supplied, the managed
agent's `finish()` contract previews only that scope with the authoritative
`resultInputKeys()` validator, including live input the agent explicitly accepted,
so invalid, stale, wrong-Task, or child identities can
be corrected within the same execution. Preview is read-only; fenced settlement
runs the same validation again against current state. The ordinary input/result
links record its answer or report. Time and Condition changes do not expand an
answer. Unselected assigned inputs remain pending. Continuation
is saved as `inputWaits[key].pending`, alongside independent waits/deadlines;
claiming reads current work instead of inferring it from previous attempts.
Agent, workflow and executor use the same result contract.

Adapters translate source-specific information at the boundary. For example,
`lib/escalation-feedback.ts` resolves saved provenance to an exact Task address;
the existing event transaction saves its wake and ordinary Task recovery handles
it. Resolution labels never choose a session to restart. Unknown ownership is
recorded as unresolved and needs intervention; no supervisor is inferred.

A direct setter can finish its small edit during admission. Metric setters
validate the exact resource and save SQL state with the event in one transaction;
later reactions remain asynchronous. A passive notification alone does not
promise work. Project comments retain recorded evidence; requiring an App work
admission at the comment interface is separate from this lifecycle. Direct
synchronous helpers and explicit fenced controls keep their existing contracts.

`project.task.reconciled` and `app.task.cancelled` also notify result readers.
Composition refreshes exact input feedback and linked Conversation observations
from those facts. `core/inbox/input-result.ts` builds `app.dependency.updated`
for both live delivery and recovery: `blocked` returns the input's selected
report; `done` returns its answer or owner closure. A report may be accepted
`incomplete`/`waiting` facts or a factual failed-attempt reference, never an
invented answer. `failAppTaskAttempt()` saves the first failure report in the
same transaction as retry state; its diagnostic wrapper shares that path.
Internal workflow-to-agent handoff does not select a failure report.
`app-task-condition-tracker.ts` wakes the caller once per selected report
revision while keeping the wait unsatisfied. Automatic retries remain quiet.
An agent may deliberately select new feedback with `report: true` on `waiting`
or `incomplete`, with non-empty facts. Omitting the flag keeps an ordinary wait
quiet and preserves the first failure report during retries. Delayed older reports cannot
replace the latest selection. This does not guarantee every intermediate update.
The later answer satisfies the wait, even if the caller is retrying its own work.
Conversation uses the same saved selection; answer or closure suppresses newly
admitting obsolete reports without erasing inputs already admitted as history.
This is not a general progress stream. Apps can still declare relevant event routes.

## Outcome and control names

| Name in code | Meaning in this lifecycle |
| --- | --- |
| `converged` / SDK `done` | An accepted outcome; later input can run the same open Task. Owner closure preserves this outcome status; read `closed` separately |
| Worker result `incomplete` / `reportAppTaskFailure()` | Unsuccessful attempt facts; unfinished work retries with backoff |
| Turn Stop / `stopAppTaskAttempt()` | Stop the observed attempt; keep the Task and accepted Requests |
| `cancelAppTask()` / SDK `closed` | Authorized owner ends the assignment; retained facts remains readable |

Task attempt failures persist their retry deadline, backing off from 250 ms to
one hour during prolonged failure. Fresh human input still permits one new
attempt. Dispatch or storage errors before that write use `controller.ts`'s local
timer (250 ms to 30 seconds). Neither path has a failure-count stop. These timers
pace different work: a dispatch may only retry a storage operation; an attempt
may spend model tokens or perform effects. Backoff limits frequency, not lifetime
spending. The owner can revise, pause or close the assignment.
A missed Condition checkpoint reports which waits are due. It carries no "final
review" count: repeated reviews keep the declared timing, and the owner decides
whether the assignment should continue.

Apps choose execution policy; the Host persists and executes it through the
current attempt. `select-execution` in `TaskAttempt.apply()` / `tasks.apply` or
final result actions selects `declared` (the Task's configured workflow/executor)
or `agent` (its responsible agent), with a reason. This chooses the **next
eligible attempt**, without waking it, answering input, changing requirements,
or retiring Conditions. A Task without a configured procedure cannot select
`declared`. Ordinary backoff, Stop, capacity, workspace and verification rules
still apply.

The decision and reason live on the ordinary attempt as `executionSelection`
and are included in the next attempt's context. No decision preserves existing
behavior: unexpected procedure failure hands off to an available agent; that
agent continues until an explicit choice or specification revision. Convergence
alone does not imply handback. The next claim records the selected handler;
a later failure can hand off again. New generations ignore old choices.

Live and final changes share admission. Identical selection actions replay
within their originating attempt; the same decision in a later attempt remains
a new choice. Distinct decisions can replace the next method before settlement;
an old replay cannot overwrite a later admitted choice. Use a fresh reason for
a reconsidered decision, rather than resubmitting an earlier operation. One
batch cannot contain competing execution selections. Claims and change receipts
commit atomically and reject stale attempts. Intentional agent selection is not
counted as an unexpected failover. The existing workflow `needs-agent` result
is a final agent choice with immediate continuation and supersedes an earlier
live execution selection.

New work is requested through `TaskReconcileResult.dependencies`: the destination
App validates `input` and chooses its Task specification and executor. Workers
cannot return raw `create-task` or `update-task` actions. `unblock-task` reconsiders
an existing wait using its current generation and creator authority.
`admitTaskAppDependencies()` in `dependency-admission.ts` saves and notifies delegated
input; `app-task-inputs.ts` resumes the caller's exact saved input when feedback
arrives through its retained wait.

Parent links organize work and scope reads; creator metadata controls changes.
They neither wait for nor subscribe to child outcomes. Typed dependencies return exact input answers;
Conditions await facts. `dependsOn` remains a static execution gate, not a return
link. Workflow reconciliation receives the same saved waits as registered
executors.

Owner and worker are roles in each assignment, not agent types. The same agent
may execute assigned work and own work it delegates. Requirements belong to
the assigning owner; the worker chooses execution within those requirements.
Delegating further repeats the same dependency/feedback contract with no
depth-specific handler. Parents review and combine evidence; child success
does not fulfill a parent assignment. Internal steps need no separate Task.
The creator revises same-App and cross-App work through `tasks update` or
`TaskAttempt.reviseTask`, supplying the exact Task, observed generation and complete
App input. `task-revision.ts` uses the destination App's normal mapper and saves
requirements through existing input admission. ACK means saved, not handled.
The save preserves current execution, observed status, failure pacing, waits,
pending events and original input-answer links. It requires no session cleanup
and does not wait for another caller's answer. Status progress cannot conflict
with a spec write; concurrent spec changes still require a fresh read.

Creator identity is immutable Host metadata, `{ appId, taskId? }`, recorded at
creation. App-created work has an App creator; delegated work has its calling
Task as creator. A reference, parent link or executor name grants no authority.
The SDK exposes creator on exact Task reads; agents never supply it in updates.
Only considered, unanswered input can acquire a result link. Its original
admission and previously accepted answers remain immutable across spec updates.
Revision after an earlier answer does not open another wait; request another
answer through ordinary dependencies.

Current execution is identified by the exact attempt, independently of the
latest spec generation. Its lease, session, failure and explicit Stop remain
valid execution facts. Effects, workspace adoption and accepted results still
require the current spec. A stale result releases only that attempt, preserves
its input and lets ordinary reconciliation read the new requirements. Existing
indexed recovery covers lost queue notifications and restart. No second queue,
revision controller or compulsory same-session adoption protocol is needed.

### Adopting creator revisions

Release matching Host and SDK together. Replace executable `update-task` results
with the `tasks` tool's `update` action or `TaskAttempt.reviseTask` before returning
the result. Update App guidance and typecheck its workflows against that SDK.
The responsible App's `task` mapper must accept the complete revised input and
return desired intent; Host preserves the exact Task ID and parent.

The schema adds nullable `creator_json` to the existing inbox table. New Task
resources save creator in metadata. Historical Tasks without provenance remain
readable but require explicit offline initialization before requirement changes;
do not infer authority from parent links, executor names or input source text.
Accepted historical results remain readable. Uncommitted old output containing
retired actions is rejected and reviewed again through ordinary recovery.
This source change neither migrates installed Apps nor certifies a live rollout.

For installations predating typed dependencies, retire saved implicit waits offline using
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
losing result acceptance, then propose the same outcome from those facts.
The local effect key follows admitted work, not attempt number. It remains
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

A new rejection or handoff diagnostic replaces the current facts links;
omitting them clears that list. An execution failure alone retains prior links.
Neither transition changes the facts in historical accepted attempts.

New Task contracts omit mode and use `incomplete` for unsuccessful reports.
Historical labels are normalized only when reading retained resources/attempts;
new authoring must use the current contract. Upgrade Host and App code together.
