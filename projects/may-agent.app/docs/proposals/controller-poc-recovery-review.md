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

This is deliberately an incomplete source slice: one fresh human input per
attempt, direct answers only. Batched input, child/Condition returns, follow-up,
Task controls and normal runtime wiring are not enabled here. The old inbox
pump and follow-up owner have not been removed. Task capacity lanes, scoped
Stop, failure pacing, active-Turn projection and live Conversation-model
execution still need integration. Do not describe it as a completed cutover.

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
