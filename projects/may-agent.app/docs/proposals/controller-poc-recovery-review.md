# Recovery against the continuing-Task design

**Status:** Source investigation, September 11, 2026. The common-lifecycle PoC
remains incomplete and unmerged. This review applies the
[accepted proposal](conversation-input-unification.md#recovery-keeps-the-same-task)
to PRs #153, #154 and #155; it does not merge or deploy them.

The worker decides **how to do the assigned work**. The assigning App, parent
agent or human decides **whether to keep assigning it**, revise its scope or
close it. The controller retains that assignment and evidence, releases each
attempt, and schedules the next eligible reconciliation with backoff. Neither
a worker's honest failure report nor a core retry counter may abandon the work.

This corrects the earlier review's suggestion that accepting a give-up judgment
could leave unfinished work quiet until an explicit owner unblock. That would
preserve the Task record while still letting the worker end the effort.

## PR assessment

| PR and reviewed revision | What it fixes | Fit with the revised baseline |
| --- | --- | --- |
| [#153](https://github.com/hao1939/may-agent/pull/153), `edd368ac` | Preserves a validated non-success result despite outer `finish(status: "failure")`. | Keep this execution-boundary distinction. Accept the failure as an attempt report, notify the owner, retain unfinished work and reconcile again after backoff. It neither closes the Task nor satisfies the assignment. The PR alone does not implement this continuation. |
| [#154](https://github.com/hao1939/may-agent/pull/154), `5943a292` | Replaces a 16-action ceiling with 256 actions and a 64 KiB UTF-8 budget, checked before graph reads. | A fix for the old action-batch admission failure, not the target recovery mechanism. Remove the need for routine unblock batches by keeping failed work eligible with backoff. A larger arbitrary count does not establish that behavior. Storage payload limits are a separate admission concern; backoff does not bound one oversized transaction. |
| [#155](https://github.com/hao1939/may-agent/pull/155), `f691ff08` | Replaces harmful "finish now" guidance after an empty/interrupted response with permission to continue the original bounded work. | Directionally correct. Core supplies execution facts and continuation mechanics; App instructions supply diagnosis and approach. The assigning owner retains value/cost, scope and closure decisions. Avoid growing a Host recovery-prompt framework. |

These are fixes on the old lifecycle. Keep their verified local benefits
separate from claims about the continuing-Task proposal. None alone provides
owner-controlled abandonment, persisted pacing and continued work after an
accepted failure report.

For #154's shared-prerequisite example, each Task can retain its assignment,
report failure and release execution. Failure backoff schedules a later check;
a declared repair event also reaches the same reconciliation path. The next
attempt reads the current prerequisite and existing effects before acting.
An agent need not enumerate Tasks or prepare a batch of `unblock-task` actions.
There is no fixed attempt count after which the controller silently retires
that work. Explicit owner controls remain separate.

Keep attempts bounded and concurrent execution controlled. Backoff lowers
retry frequency; it cannot cap lifetime cost if a failure lasts forever. The
accepted tradeoff is paced ongoing effort with visible failure evidence and
owner intervention. It does not authorize new scope, missing permissions or
blindly repeating uncertain effects. Already satisfied work can rest while
awaiting owner closure; unfinished failure must retain a continuation path.

For #155, keep worker guidance in the App's existing task/role instructions:
"Use the current assignment and retained evidence to make the next useful
step. Report failure honestly, but do not abandon the assignment or decide its
lifetime." The owner may judge that more work is not worth its cost. This is
an authority distinction, not a requirement for another model or service.

## Recovery evidence and remaining gap

Source [checkpoint `5b65d155`](https://github.com/hao1939/may-agent/commit/5b65d155)
implements persisted retry eligibility in the existing Task resource JSON and
indexed due column. It removes the four-failure gate. Failed execution, an
accepted failure report and rejected handler output retain unfinished input
and schedule a later attempt. A failure report remains accepted attempt evidence
without binding it as the final answer to the caller's original assignment.
Owner closure fences late results and now also rejects subsequent wake writes.

The focused source suite passed **31 tests**, including:

- **24 independent Tasks** each fail once and recover through the actual
  controller and due scheduler without an agent-generated unblock batch.
- **Seven consecutive failures** retain the same Task and original input,
  respecting backoff across reopen and duplicate wakes before succeeding.
- **An accepted failure report, then success** preserves the first report and
  binds the eventual answer to the original ask. A parent can read a child's
  failure while that child's unfinished work retains continuation.
- **Real timer and restart:** an early wake cannot claim during cooldown,
  capacity is released, and the reopened store's deadline starts the retry.
- **Atomic failure settlement:** a rejected storage write leaves the attempt
  running without a half-written retry deadline. Indexed hint updates cannot
  clear a future deadline. Owner revision can replace the assignment; closure
  prevents future claims and rejects late failure settlement.

The 24-Task test first failed because a deadline could become overdue during
other synchronous state transitions. The existing scheduler then deferred it
to the long safety scan. The checkpoint fixes this by querying overdue work
once after a state change, without recursively re-arming against unchanged
rows. The earlier test's incorrectly called wake assertion was replaced by
actual three-argument wakes and deadline assertions in the seven-failure case.

The original [controller-only backoff probe](https://github.com/hao1939/may-agent/blob/ca3a5986/scripts/poc/controller-judgment/backoff.ts)
remains unchanged. At `5b65d155` it measured **201 ms** for a configured 200 ms
retry, but only **1 ms** when the failure callback enqueued another wake.
Persisted Task eligibility prevented an early Task claim, while dispatch/storage
failure before that persistence could still bypass its own timer.

[Checkpoint `ca3a5986`](https://github.com/hao1939/may-agent/commit/ca3a5986)
makes the existing queue respect the dispatch retry timer. Wakes retain their
priority and lane without making that Task immediately runnable. Other Tasks
can run, pause still applies, and controller shutdown cancels its retry timers.
The unchanged probe now passes: **202 ms** in both cases, two executions each.
The controller, queue and workflow-adapter checks passed **40 tests**. Dispatch
pacing is process-local when storage cannot be written; persisted Task retry
deadlines still provide the restart guarantee once failure settlement succeeds.

A [live worker trial](https://github.com/hao1939/may-agent/blob/5b65d155/scripts/poc/controller-judgment/continuing-failure.ts)
uses the real Task protocol/schema and a read-only tool. The first model
attempt reads an unavailable measurement and reports failure. The fixture
repairs the source and reopens SQLite; the ordinary recovery scheduler starts
a fresh model attempt, without a new ask or unblock. The next attempt must read
the current source and answer the original question. Both trials ran on clean
`5b65d155` with `gpt-5.6-sol`:

| Repaired observation | Final answer | Executions | Execution time | Reported tokens |
| --- | --- | --- | --- | --- |
| 0.92, minimum 0.90 | Meets the minimum | 2 | 16.1 s | 12,397 |
| 0.78, minimum 0.90 | Does not meet the minimum | 2 | 12.5 s | 12,447 |

Both first attempts returned an honest failure, followed by a completed answer
on the same assignment after restart. Each execution used only `read` and
`finish`; neither model managed a retry or copied a runtime identifier. The
second case distinguishes a failed attempt to obtain evidence from a successful
answer reporting an unfavorable measurement. Both final results remain readable
while the Task stays open and quiet. Reported token counts include repeated
prompt input and cached tokens; they are not a verified bill.

This exercises direct-agent execution under the controller; it is not an
installed App or the full managed Conversation runtime. The fixture repairs
the source; it does not prove autonomous diagnosis or repair of a real service.

### Removing parallel recovery paths

[Checkpoint `3d3f5a73`](https://github.com/hao1939/may-agent/commit/3d3f5a73)
removes the separate handler-availability repair pass and the scan that used
another session's success to release failed work. An eligible attempt checks
its current executor and verifier through ordinary execution. Interrupted
attempt recovery and exact bound-session wake routing remain.

An installed-runtime test removes an executor, observes its Task's persisted
failure and cooldown, completes an independent Task, then restores the executor.
The original Task succeeds after its deadline without changing generation or
erasing the failed attempt. Reload does not duplicate the accepted execution.
Startup fixtures now read exact input outcomes instead of removed completion
helpers. The adapter test in `ca3a5986` also inspects actual workflow files
directly after retirement of the availability-cache helper.

Claiming now checks project pause inside the atomic mutation. A second SQLite
connection pausing immediately before commit cannot start the queued retry.
Explicit owner retry works during cooldown, with replayable control receipts;
it preserves prior failure evidence. These are background Task checks, not
proof of the unfinished Conversation pause and foreground-capacity integration.

This retirement does **not** migrate legacy persisted `attention` or old stopped
admissions. Production cutover must convert their retained obligations before
removing their old recovery paths. No installed data was changed.

### Worker judgment cannot rewrite the assignment

[Checkpoint `b05340bc`](https://github.com/hao1939/may-agent/commit/b05340bc)
removes a remaining self-update exception. The existing worker protocol already
forbade changing its current Task through result actions, but settlement allowed
the worker to rewrite its own outcome and acceptance criteria. Answer and wait
settlement now reject that mutation atomically, including earlier actions in the
same batch. A rejected rewrite retains the original assignment through failure,
backoff and reopen. External owner revision and delegated-Task changes remain.

The worker can explain that the requested measurement is unavailable and
recommend a narrower ask. It cannot silently replace "obtain the measurement"
with "explain why it is unavailable." Changing the method is its judgment;
changing the assignment is the owner's. No new role or approval workflow is
needed. The new and retained lifecycle/retry checks passed **34 tests**.
[Test follow-up `650b019e`](https://github.com/hao1939/may-agent/commit/650b019e)
replaces the old successful self-revision example with a worker reporting partial
evidence, followed by explicit owner revision. All **three targeted action tests**
pass, including retained evidence and runtime-prefixed identities.

Remaining recovery work includes scoped cooldown so a failed conversational
ask cannot delay unrelated fresh human input and migration of old failure/receipt
readers. Initial pacing reuses
250 ms exponential delay capped at 30 seconds; that is an experimental default,
not evidence of acceptable long-term cost under sustained failures. The retained
SDK spelling `stopped` is also misleading for a continuing unsuccessful attempt;
public vocabulary and consumers still need a coordinated migration.

PR #153's earlier live Host-contract trials already showed that a model can
return an honest give-up and have it accepted after the execution fix. The
[follow-through trial](controller-poc-input-continuation.md#can-a-model-use-it)
also passed with fresh models and controller-owned return links. Neither is
a real-model test of #155's interrupted continuation. That test remains:
inject an empty response before useful work, and a provider failure after a
committed effect; then verify useful continuation without duplicate effects
or unsupported blockers using the actual App context.

## Conversation checkpoint

Source [checkpoint `5ac0f6cf`](https://github.com/hao1939/may-agent/commit/5ac0f6cf)
starts actual Conversation storage settlement under one stable Task. It uses
real input rows, context construction, Topics, Requests and reply projection.
The composition entry receives an existing Task claim; it does not claim an
inbox item or create a second scheduler. A real managed Conversation resolver
can now receive that Task binding and its recovery owner.

The exercised direct-turn path commits Task acceptance, Topic, Request updates
and reply together. A failed reply write rolls them all back. Late output after
owner closure is rejected. New unreviewed input cannot publish the old proposed
closure. A second human input uses the same Task after storage reopen while
the earlier answer remains readable.

The input's execution-Task link also excludes the Conversation from old inbox
claims, including later unconverted input. Cutover refuses unhandled legacy
input even with an expired lease. This prevents dual execution; it does not
yet convert a production ingress path. Unconverted input remains visible and
pending rather than being processed by an obsolete executor.

[Checkpoint `895c75c6`](https://github.com/hao1939/may-agent/commit/895c75c6)
extends that same entry to batched input and delegated results:

- The executor receives the claimed input batch with each source preserved.
  An unaccepted answer's retained input can be considered with newer feedback.
  Settlement handles the batch and publishes one response; typed Request
  decisions still determine which accepted asks were fulfilled.
- The App maps a follow-up to its Task. Admission, Topic/Request linking,
  acknowledgment and the Conversation Task result commit together in SQLite.
  Failure to save the explanation leaves no admitted child or partial Request.
- An accepted attempt of a linked Task can become a new system input for the
  same Conversation Task. The state operation checks its exact App, Task,
  attempt and Topic link. Repeated delivery is idempotent; a later Task cycle
  cannot replace the saved earlier outcome.
- A system turn may retain an internal summary without publishing a chat
  message. Returning Task evidence does not itself close a Request.

The supplied-decision test now uses real Conversation messages, Topics and
Requests through **Conversation -> A -> B -> A -> Conversation**. B waits on an
actual Condition while the Conversation answers an unrelated question. After
SQLite reopen, a matching fact releases B, the normal child-result context
returns its evidence to A, and A's exact accepted outcome becomes Conversation
input. The final answer closes the original Request and preserves both earlier
replies. A separate cross-App check verifies exact result identity and rejects
unlinked or unaccepted results. Conversation state, projection and resolver
checks passed **30 tests**. The final [scenario fixture at `a6beb497`](https://github.com/hao1939/may-agent/blob/a6beb497/src/app/core/state/conversation-task-turns.test.ts)
uses the measurement ask followed by the threshold question; all **12
Conversation Task tests** pass at that test-only follow-up.

This remains a source PoC with supplied decisions, not a live-model Conversation
or a completed runtime cutover. The test calls the new outcome-admission state
operation at the result boundary; production event subscription and recovery
discovery are not wired to it yet. Normal human ingress, scoped Stop and
active-Turn projection are covered by the later checkpoint below, followed by
capacity and background pause. Task controls and failure pacing per input remain
unfinished. The old inbox pump and separate follow-up owner remain; both must
retire before one execution owner is proved for the installed runtime.

## Common runtime integration

The [runtime checkpoint `d42935a0`](https://github.com/hao1939/may-agent/commit/d42935a0)
moves Conversation judgment behind the normal Task execution boundary. The
composition capability prepares a typed decision; the common reconciler owns
the claim, lease renewal, cancellation signal, failure settlement and retry.
It commits the Conversation decision, reply, Request updates and follow-up
admission in the existing state transaction. The former composition function
that also settled the attempt is removed.

A Conversation-only App can now install a Task runtime without an authored
Task tree. Its structural root is conventional. Runtime identifies Conversation
execution from the persisted input link, using an indexed lookup; an unrelated
executor named `conversation` retains its ordinary Task contract. Ordinary Task
admission still requires the App's declared Task capability.
The [storage follow-up `6aa80877`](https://github.com/hao1939/may-agent/commit/6aa80877)
restores additive columns after the historical inbox-table rebuild, before
creating the new index. Full CI exposed that upgrade-ordering regression;
the existing migration test and both Conversation suites pass after the fix
(**24 tests**, including the seven runtime checks).

After committing a follow-up, core emits `app.task.ready` with its exact App and
Task identity. The existing runtime listener schedules that saved work. The
event is a notification, not admission authority; recovery can still discover
the durable ready Task. A one-App worker prepares only the selected follow-up
App from its pinned registry. The event uses the existing worker relay protocol;
this checkpoint does not run a new real-process Conversation relay scenario.

The [seven installed-runtime tests](https://github.com/hao1939/may-agent/blob/d42935a0/src/app/core/tasks/conversation-runtime.test.ts)
use the shipped Conversation resolver with supplied model decisions and
temporary SQLite. They cover:

- a model failure followed by the existing recovery timer's successful retry;
- restart discovery of admitted Conversation input without another ingress wake;
- owner closure aborting execution and fencing a late reply;
- the normal one-attempt worker entry settling a Conversation decision;
- ordinary execution for an unrelated executor named `conversation`;
- a failed reply transaction admitting no child, followed by a paced retry that
  commits the explanation and wakes the other App under shared Host capacity;
- a one-App worker admitting follow-up work from its pinned catalog and emitting
  the exact post-commit notification.

This checkpoint proves the common runtime path for **already Task-admitted**
input. The next checkpoint moves normal ingress and scoped Stop to that path.

## Normal ingress and Turn Stop

Source [checkpoint `f5d0fab6`](https://github.com/hao1939/may-agent/commit/f5d0fab6)
routes human Conversation events through the existing Task capability.
Admission stores the input and its stable execution
Task together, then wakes that Task. Production composition supplies this
capability and removes its direct Conversation resolver; the Task execution
backend already owns the resolver. The inbox does not schedule its old executor
for Task-owned input. Existing Conversation reads render the saved reply and
derive the active Turn from the current Task attempt.

The owner can stop exactly the observed Turn without closing the Task or its
Requests. One transaction interrupts the named attempt and records its considered
inputs as stopped. Newer input stays pending. A late result cannot publish a
reply, and neither a duplicate Stop nor restart can replay the stopped input.
The post-commit event aborts live execution; its listener checks the stored
decision first. Notification text alone cannot apply Stop. Ready and stopped
notifications cannot be admitted again as fresh Task work.

The new Stop regression also exposed an abort being reported as a handler
failure after the owner had already ended its attempt. The shared error boundary
now respects that stored decision and releases execution without a false failure
or dispatch retry. Genuine executor failures still retain their paced retry.

The two Conversation suites pass **22 tests** with supplied model decisions.
Three added checks exercise normal event admission and durable duplicate
receipts; Turn Stop with newer input, a late answer and replayed control; and
transaction rollback plus restart with no automatic replay of stopped input.
The ingress tests install the real registry, event persistence, Task runtime
and Conversation resolver. An old inbox resolver that throws if called stays
unused. They are not live model or managed Conversation subprocess trials.

Result-to-Conversation event admission and missed-result discovery and
Conversation Task controls remain unfinished. Capacity and background pause are
covered by the next checkpoint.
The retry context also needs the previous attempt's useful failure/effect
evidence before a real interrupted-Conversation trial. Per-Task cooldown still
delays unrelated fresh input. The retained-state guard refuses undrained legacy
input; the production resolver change does not provide a migration for it.
These are required integration work. The old inbox pump, legacy execution
fallback and separate follow-up owner must be removed before claiming one owner
across the installed system. Host main and the installation remain unchanged.

## Conversation capacity and background pause

Source [checkpoint `ebb98a14`](https://github.com/hao1939/may-agent/commit/ebb98a14)
moves the interactive capacity allowance into the common Task queue.
The App's declared limit bounds background attempts;
one human Turn per App may run alongside them, within the shared Host limit.
Two queued human Conversations in one App share that extra slot. At a Host limit
of one there is no physical reserve. Active attempts remain bounded and stoppable.

Only persisted, unfinished human Conversation input earns foreground capacity.
Ordinary Task priority and the trusted human scheduling lane still order work,
but do not grant the reserve. A system review uses background capacity. The
controller rechecks this distinction after waiting for capacity; a review cannot
inherit a reservation after its human input is gone.

An App pause now gates eligible Task keys instead of disabling its whole
controller. Human Conversation input continues through the same controller,
claim and execution path. The claim transaction rechecks pause against current
input, so another SQLite writer cannot race a background attempt through it.
No worker instruction, event label or dispatch lane bypasses that stored check.
The earlier console-only note was incorrect: normal interactive-console startup
already installs Task controllers. This change addresses persisted App pause.

Two added installed-runtime tests prove human replies beside same-App background
work and paused-App replies across restart, followed by background resumption.
Three controller checks cover capacity-wait replacement, source revalidation and
a failed scheduling read releasing capacity and using existing dispatch backoff.
A separate two-connection SQLite check proves the pause race and the human-input
exception at the actual claim boundary. These use supplied decisions, not live
models or a managed Conversation subprocess.

One partial index selects pending human input without scanning completed
Conversation history. Scheduling reads App pause and the pending human Task set
once at a dispatch boundary, then compares queue keys in memory. In a temporary
SQLite/2,000-key queue check, ten selections averaged 0.4 ms with that snapshot,
versus 8.5 ms with per-key reads. SQLite uses the partial index for both exact
claim checks and the pending-Task query. This is local selection evidence, not
a throughput or user-response guarantee.

This removes no old inbox execution path yet. Full cutover, result routing,
per-input pacing, Conversation Task controls and actual model use of the managed
Conversation path remain required. The same agent can still judge approaches;
it does not acquire capacity, unpause work or manage the scheduling loop.

### Human input in a mixed batch

Source [follow-up `86455d13`](https://github.com/hao1939/may-agent/commit/86455d13)
fixes another boundary exposed by the capacity check: a pending human message earned a
foreground slot, but 32 older system events could fill the actual attempt and
leave the human message out. A follow-up includes human-origin input before
the system backlog when selecting the bounded event batch. Selected events
retain admission order, and remaining events stay pending. Conversation presents
system evidence before human input so the existing current-ask and reply
selection uses the latest considered human message, including after a retry.
Stop uses that same selection while retaining any newer, unconsidered input.

The paused-App regression first failed with 35 system events followed by a
human message. It now includes the human message and 31 ordered system events;
the four remaining system events cannot run while the App is paused after
Stop. A retained-input retry also checks answer and Stop placement when newer
human input is followed by a system fact. These use real claims, Conversation
settlement and temporary SQLite, with supplied decisions.

The first broader check caught the selection change also reordering an
ordinary Task's retained failure input and later steering. The follow-up keeps
priority selection separate from event presentation; that existing retry
regression passes unchanged.

This does not yet solve response latency under a backlog. Pending unreviewed
events still prevent final acceptance, and retained inputs can enlarge later
context. The checkpoint fixes which input receives the opportunity and reply;
per-input acceptance and pacing remain migration work.

## Verification and cost

At `3d3f5a73`, Host/SDK types, App-boundary checks and lint passed. Focused
retry/common-lifecycle, storage and scheduler checks passed **62 tests**;
startup and restored-executor checks also passed. Its full run finished with
**2,625 passes, 3 skips, 130 failures and one test-loading error**, across 2,758
tests in 281 files (131.0 seconds). The loading error was the workflow adapter
test's remaining import of the removed availability helper, fixed in `ca3a5986`.

At `b05340bc`, static checks passed and full CI finished with **2,631 passes,
3 skips and 130 failures**, across 2,764 tests in 281 files (145.4 seconds).
The test-loading error is gone. One newly exposed failure expected successful
self-revision; the test-only follow-up above migrates that case and passes its
targeted checks. No new full-suite total is claimed for that follow-up. The
three skips require the separately installed agent/App fleet. **Full CI remains
red**, and the common-lifecycle migration remains incomplete.

At `895c75c6`, static checks passed and the full portable run finished with
**2,637 passes, 3 skips and 129 failures**, across 2,769 tests in 281 files
(130.6 seconds). The new Conversation checks pass, but the full migration gate
is still red. The subsequent test-only follow-up above has focused verification,
not a new full-suite total.

At `6aa80877`, Host/SDK types, App-boundary checks and lint pass. Full CI
finishes with **2,644 passes, 3 skips and 129 failures**, across 2,776 tests in
282 files (132.9 seconds). Compared with the prior follow-up checkpoint, it
adds seven passing runtime tests with no new or removed failure names. The
index migration regression found at `d42935a0` is fixed; the overall migration
gate remains red.

At `f5d0fab6`, Host/SDK types, App-boundary checks and lint pass. The two
Conversation suites pass **22 tests**, including the Stop/error regression.
Full CI finishes with **2,647 passes, 3 skips and 129 failures**, across 2,779
tests in 282 files (136.7 seconds). It adds three passing checks relative to
`6aa80877`, with no new or removed failure names. The full migration gate is
still red. No live model trial ran for this checkpoint.

At `ebb98a14`, Host/SDK types, App-boundary checks and lint pass. Queue,
controller, runtime and schema checks pass **58 tests**; the separate
two-connection pause fence also passes. Full CI finishes with **2,653 passes,
3 skips and 129 failures**, across 2,785 tests in 282 files (135.6 seconds).
It adds six passing checks relative to `f5d0fab6`, with no new or removed failure
names. The full migration gate remains red; no live model trial ran.

At `86455d13`, Host/SDK types, App-boundary checks and lint pass. The focused
Conversation, retry, context, queue and controller checks pass **85 tests**.
Full CI finishes with **2,655 passes, 3 skips and 129 failures**, across 2,787
tests in 282 files (131.2 seconds). It adds two passing regressions relative to
`ebb98a14`, with no new or removed failure names. The full migration gate remains
red. No live model or managed Conversation subprocess trial ran for this fix.

The remaining failures include old receipt/deletion and failure-count
expectations, Conversation/Request outcome readers, and real worker/restart
fixtures. These are unresolved migration and runtime checks, not evidence that
only assertions need changing. Review each behavior; do not skip checks or
replace expectations merely to make CI pass.

Earlier Conversation checks had 86 passes and 3 failures; the previous broader
Task [audit](controller-poc-input-continuation.md#evidence) also remained red.
Those are historical observations, not a fresh result for this checkpoint.
No production cutover or overall simplification claim is made.

The Conversation slice adds an execution link on retained inputs, a state
operation composing existing transactions, and a composition entry. There is
no new table, scheduler, model role or inbox execution lease. It adds code
without yet deleting the old runtime path, so net simplification is unproven.
The follow-up checkpoint adds **136 net production lines** (181 added, 45
removed), excluding tests. It reuses Task admission, accepted attempts, Topic
links and Request updates; it adds no table or scheduler. This extra code must
replace the old input execution and follow-up paths during cutover, rather than
remain alongside them as another permanent authority.
The common-runtime checkpoint and storage follow-up add **171 net production lines** (216 added,
45 removed), excluding tests. It adds one index and one post-commit ready
notification, reusing the existing controller, recovery timer, capacity and
worker event bridge. The lookup query plan uses the covering index on App and
execution Task identity. This remains an intermediate increase until the old
Conversation execution and follow-up paths are deleted.
The ingress/Stop checkpoint adds **238 net production lines** (271 added, 33
removed), excluding tests. It reuses the same Task, attempt fence, input records,
controller and event bus, with no new table or scheduler. This remains an
intermediate increase: optional legacy callbacks and the old inbox execution
path still need retirement. Passing the new checks does not yet prove a smaller
installed system.
The capacity/pause checkpoint adds **86 net production lines** (157 added, 71
removed), excluding tests. It adds one indexed input query and a scheduling
snapshot to the existing controller, reusing Host capacity and dispatch backoff.
The queue permits one human Turn beside the App's background limit; it retains
one execution owner per Task. It does not create a second Conversation queue,
executor, retry policy or recovery timer. Whole-system retirement remains open.
The mixed-batch follow-up adds **16 net production lines** (21 added, five
removed), excluding tests. It changes selection and reply placement inside
existing claims and settlement; it adds no queue, storage schema or model
decision. The PoC as a whole still adds production code until the old
execution and follow-up owners are removed.

Recovery still uses the existing controller, queue, Task resource and due
queries. Retirement at `3d3f5a73` removes **449 net production lines**; respecting
dispatch timers adds 20, and removing self-revision deletes another 21. Combined,
`5b65d155..b05340bc` adds 66 and removes 516 production lines: **450 fewer lines**,
excluding tests and harnesses. The added dispatch timer map protects pacing
before storage can settle a failure; it is not a new durable work authority.
This establishes a local reduction, not whole-system simplification or a
completed retained-state migration. The source is committed and pushed on
`poc/task-outcomes-and-closure`; Host main and the installation remain unchanged.
Human review is still required for Host PRs.
