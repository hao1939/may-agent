# Recovery against the continuing-Task design

**Status:** Critical-path source PoC reviewed, September 12, 2026; unmerged and
undeployed. This review applies the
[accepted proposal](conversation-input-unification.md#recovery-keeps-the-same-task)
to PRs #153, #154 and #155; it does not merge or deploy them.
The current review artifact is [Host PR #158](https://github.com/hao1939/may-agent/pull/158).
The subsequent [deeper review](controller-poc-deeper-review.md) records natural
delegation, owner withdrawal, corrected acceptance, additive waits and revised
retry pacing. The evidence below retains its original revisions and defaults.
Its [later source investigation](controller-poc-deeper-review.md#why-the-source-stayed-large)
also supersedes the session-result salvage tests below: uncommitted execution
now retries through normal Task settlement. Ordinary App inbox handling and the
multiple result-return protocols remain explicit simplification work.

**Recommendation:** Proceed with human review of one Task model, controller and
lifecycle. A can take human input, delegate to B, and B can delegate to C:
**A → B → C → B → A**. Context and capabilities vary; execution ownership does
not. The old independent conversational inbox executor and supervisor reply path are removed,
and the paired App removes its supervisor declaration. Source checks, two live
nested trials and an isolated real-daemon cutover support this critical path.
The [acceptance audit](#critical-path-acceptance-audit) states what is proved and
what remains outside it. Earlier sections below retain dated intermediate
failures and limitations; they do not describe the current candidate.

The worker decides **how to do the assigned work**. The assigning App, parent
agent or human decides **whether to keep assigning it**, revise its scope or
close it. The controller retains that assignment and evidence, releases each
attempt, and schedules the next eligible reconciliation with backoff. Neither
a worker's honest failure report nor a core retry counter may abandon the work.

This corrects the earlier review's suggestion that accepting a give-up judgment
could leave unfinished work quiet until an explicit owner unblock. That would
preserve the Task record while still letting the worker end the effort.

## Critical-path acceptance audit

The four implementation checkpoints in the proposal now have source evidence:
one lifecycle, nested composition, result routes/App conventions, and isolated
retained-state cutover with the old execution owners removed. This completes
the critical-path source experiment requested by the human. It is a
recommendation for review, not merge or deployment approval.

| Requirement | Evidence and boundary |
| --- | --- |
| Outcome without closure; later input; exact answer | `app-task-accepted-result.test.ts` and `app-task-common-lifecycle.test.ts` check accepted attempt identity, atomic rollback, later generations, out-of-order callers and reopen. An old success cannot satisfy a newer assignment. |
| Owner closure; repeated control; late output | Common-lifecycle tests check exact-result closure, duplicate close, closure while running, stale settlement and late wakes. Closing a parent does not silently close independent children. |
| Duplicate and during-run wakes | `controller.test.ts` checks deduplicated keys, a fresh pass after a during-run wake, shared capacity and drained shutdown. There is one current claim per Task. |
| A → B → C → B → A; human input while C works | Two [live nested trials](#nested-delegation-uses-the-same-task-loop), at Host `64cd4d1b` / App `b73886ab05`, each use seven attempts and one measurement read, with zero tool errors or extra supervisory attempts. All three Tasks stay open; the original Request closes and fresh input works after reopen. |
| Stop, later input and background pause | `conversation-runtime.test.ts` and `conversation-task-turns.test.ts` exercise the same Task attempt through public control, queued input, restart, atomic reply/control settlement and source-aware capacity. Telegram coordinates stay with the actually claimed input. |
| Failure reports and retry without a failure-count stop | `app-task-retry.test.ts` and common-lifecycle tests retain original input, waits and failure evidence; seven consecutive failures and 24 independently failing Tasks recover. Real due timers and restart preserve backoff and release capacity. [Live failure trials](#recovery-evidence-and-remaining-gap) report failure, then answer after the fixture repairs the source. |
| App-owned judgment and owner-owned scope | Source tests reject worker self-revision/closure and accept an owner's scope change or closure during cooldown. The next worker receives retained evidence and the current assignment. App guidance owns uncertain recovery judgment. |
| Empty or interrupted synthesis | [Managed recovery](#managed-conversation-recovery) and [failure checks](#failure-handling-uses-the-shared-task-lifecycle) continue from retained input/evidence through bounded attempts; unaccepted work may be redone. Accepted effects are fenced and preserved. |
| Missed notification, late links and quiet timers | Runtime/state tests route accepted results and closures through durable input, recover missed delivery after reopen, page bounded discovery and retain Stop. Saved waits and self-links do not cause extra model calls. [Daemon tests](#daemon-restart-with-retained-outcomes) also execute without optional schedules. |
| Capability removal, cleanup and shutdown | Runtime tests leave unavailable-handler work visible and executable again after restoration. Controller and workspace checks release capacity, drain attempts and preserve required work evidence. An open idle Task alone does not require a running process; failed work may retain an affordable recovery workspace. |
| Historical reads | [Reader review](#historical-reader-review) retains exact results and closed history, distinguishes owner closure from cancellation, and keeps archive readers outside runtime authority. |
| Real old-version cutover | Clean old `a8f65188` → candidate `682ba127`: four observed old processes exit, retained input continues, measurement 17 is accepted, earlier reply appears once, supervisor stays closed, and fresh input executes on the same open Task. Four scripted provider calls; no real model calls. |

The source checks named above live under Host `src/app/core/tasks/`,
`src/app/core/state/` and `src/app/adapters/workspaces/`; current full-CI evidence
is recorded with the [reader checkpoint](#historical-reader-review), with the
latest comment and guide changes recorded under [review preparation](#review-preparation).
The subsequent [PR consolidation](#consolidation-of-earlier-prs) records the
remaining execution fixes carried into the candidate.
This audit inspected assertions and retained reports; it did not repeat successful
model trials or claim those older trials ran against a newer revision.

**Value versus cost:** one execution/settlement/retry authority replaces the
independent inbox and supervisor paths. At the reader checkpoint, production
code against main `49272b5a` is **526 net lines larger**: **517** in three offline
converters and **9** in ongoing code. This is a reduction in competing paths,
not a substantial reduction in line count. Keep typed message/Request/Topic
operations and archive reads: they preserve useful context and evidence without
adding another lifecycle. Do not build a generic controller framework or merge
tables merely to make every capability look identical.

Accept planned upgrade downtime, bounded attempts, safe redo of unaccepted work,
and conventional human capacity without general preemption. Retained evidence
has a storage cost; this PoC does not add automatic deletion of referenced
outcomes. Optional discovery has latency and cannot replace required recovery.

**Deferred beyond the critical path:** a controlled old-versus-new model cost
comparison; unprompted decomposition; live owner withdrawal after repeated costly
failure; autonomous repair of real services; long-running scale/retention
measurement; full installed tool/transport trials; and installation-specific
rollout/rollback. Source authority checks and small live judgment samples do not
prove those broader behaviors. Follow the human's critical-path-first decision:
record these limits instead of adding mechanisms or extending the PoC indefinitely.
Host/App adoption still requires human review and a separate rollout plan.

## Review preparation

Host `c1a2e48e` clarifies SDK comments and source guides without changing runtime
behavior. The guides distinguish accepted outcomes, worker failure reports,
Turn Stop and owner closure; they also explain retained `achieve`/`maintain`
labels and dispatch-error backoff. Stale claims that callback-test migration
and isolated restart proof were pending are corrected.

PR #158 is ready for human review, with a source reading order, changed-contract notes and the
paired App revision `b73886ab05`. Review the lifecycle first, then human-facing
settlement, result return/retry, and the offline conversion/coverage map. The
canonical proposal and boundary document distinguish this implemented candidate
from the released protocol. Historical evidence below keeps its original dates
and revisions.

Local `bun run check:ci` passes at `c1a2e48e`; design integrity, executable design
examples and canonical App checks pass, along with the Host guide and changed
design links. [GitHub Quality and Container](https://github.com/hao1939/may-agent/actions/runs/34650854597)
both pass on that exact revision. The previous full local CI result at `54c1b5b4`
retains its exact source revision. No model or daemon-cutover trial was repeated
for these comment and guide edits. Host and App remain unmerged and undeployed.

## Consolidation of earlier PRs

Host `10060de7` addresses the two outstanding #153 review concerns and carries
the useful recovery follow-up from #155. `c6b8a348` separately brings over #155's
bounded Pi-startup fixture subprocesses and isolated synthetic environment.

| Earlier PR | Disposition in #158 |
| --- | --- |
| #150 | All three commits are already in #158's history; exact accepted evidence and judgment experiments remain |
| #153 | Structured non-success judgments remain valid attempt evidence. A committed finish survives a later direct timeout, and cancellation cannot erase missing-result validation |
| #154 | Individual Task backoff removes the motivating bulk-unblock recovery path. The 256-action/64-KiB proposal is not included; existing bounded action validation remains |
| #155 | Recovery preserves successful work and committed effects, uses App guidance for the next step, and retains read/write evidence. Pi-startup tests use bounded asynchronous subprocesses |

The new regressions reproduced five failures on `c1a2e48e`: two direct-timeout
cases, cancellation hiding a required-result error, and the read/write recovery
guidance cases. After the fixes, all **77 focused tests pass** across five files.
The timeout regression runs the real agent/tool loop, holds cleanup after the
finish receipt, and observes the real deadline. Managed-session checks verify
persisted status and one terminal publication. Task claim and owner-closure
fences remain in force; preserving an executor result cannot waive them.

The recovery tests also retain the original assignment after an empty response
and a successful write receipt after a final-synthesis failure. Their synthetic
model verifies available context and guidance, not guaranteed model compliance
or permission to repeat an uncertain external effect. No model trial or installed
service was used for this follow-up.

Full local `bun run ci` with these changes passes **2,901 tests**, with **3
installation-dependent skips** and **0 failures** across 291 files (168.12 seconds).
[GitHub Quality and Container](https://github.com/hao1939/may-agent/actions/runs/34651919594)
both pass at `c6b8a348`; hosted tests report the same counts (124.73 seconds).
Design integrity, executable design examples, canonical App checks and changed
document links also pass. No new skips or automatic retries were added.

PRs #150, #153, #154 and #155 are closed with supersession notes pointing to
#158; #150 was already closed when this follow-up finished. #158 remains the
single open review target. Host and paired App remain unmerged and undeployed.

## Historical reader review

Host `c50f56f4` fixes two current projection errors: an explicit owner
closure appeared as cancellation, and restored closed history disappeared from
the SDK Task list. Human views now show `closed` separately from `cancelled`;
SDK lists retain closed resources with their existing `closed` flag and evidence.
Active outcome reports exclude closed work. Child history retains the legacy
`cancelled` field name but carries the actual closure kind; closure alone proves
neither success nor failure. No claim, retry or storage lifecycle was added.

New checks exercise real owner closure after an accepted result, withdrawal of
unfinished work, historical receipt conversion, pagination, App isolation and
active-versus-history reporting. The focused readers/reporting suite passes
47 tests. Full local `bun run ci` at Host `c50f56f4` passes Host/SDK types,
the App boundary and lint: **2,896 passed, 3 skipped, zero failures**
(2,899 tests / 291 files; 136.97 seconds). The skips require separately installed
App/agent configuration. The last real-daemon cutover remains `682ba127`;
the reader changes do not modify conversion, claims or execution.

GitHub Quality at `c50f56f4` subsequently hit its 15-minute timeout. A local
run with the same JUnit options still passed all 2,896 tests in 129.24 seconds.
Comparing logs found only the five clipboard-bridge tests without results; that
suite contained two unbounded synchronous Node subprocess calls. The log does
not establish why the child process stalled. Host `54c1b5b4` replaces those
calls with asynchronous execution and a five-second subprocess timeout, keeping
the successful patch and exact invalid-anchor checks. All five focused tests
pass. Full local CI then passes **2,896 tests, 3 skipped, zero failures**
(2,899 tests / 291 files; 130.91 seconds), and GitHub **Quality and Container
both pass at `54c1b5b4`**. No automatic retries, new skips or larger job timeout were added.
This follow-up changes only the test harness; the runtime inventory is unchanged.

Archive readers and their pre-cutover read projections remain deliberately.
They are needed for offline inspection, including old cancellation records
without a retained executable spec. Runtime preparation rejects unconverted
history, and accepted attempts/retained Tasks control all current execution
decisions. Removing those readers would require more migration work without
removing another execution owner. Compatibility names such as `achieve`,
`maintain` and SDK `done` also remain; they do not select different lifecycles.
Any later naming cleanup should have its own concrete value.

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

At this checkpoint, remaining work included human responsiveness during
cooldown and migration of old failure/receipt readers. The later
[fresh-input checks](#fresh-human-input-during-retry) exercise a simpler
Task-wide exception instead of independent per-input deadlines. Initial pacing reuses
250 ms exponential delay capped at 30 seconds; that is an experimental default,
not evidence of acceptable long-term cost under sustained failures. The retained
SDK spelling `stopped` is also misleading for a continuing unsuccessful attempt;
public vocabulary and consumers still need a coordinated migration.

PR #153's earlier live Host-contract trials already showed that a model can
return an honest give-up and have it accepted after the execution fix. The
[follow-through trial](controller-poc-input-continuation.md#can-a-model-use-it)
also passed with fresh models and controller-owned return links. Neither tested
#155's interrupted continuation. The later [managed Conversation trials](#managed-conversation-recovery)
cover an empty response before useful work and a provider failure after a
committed effect, using actual App context and checking duplicate writes.

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
capacity, background pause and [human Task controls](#human-task-controls-through-conversation).
Failure pacing per input remains unfinished. The old inbox pump and separate follow-up owner remain; both must
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

Later checkpoints add result routing, missed-result discovery, human controls,
capacity, background pause and prior-attempt evidence. Per-Task cooldown still
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

This removes no old inbox execution path yet. Later checkpoints add result
routing, human Task controls and managed-model recovery trials; full cutover and
per-input pacing remain required. The same agent can still judge approaches;
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

## Returning linked outcomes through Conversation input

Source [checkpoint `faba34f7`](https://github.com/hao1939/may-agent/commit/faba34f7)
routes `conversation.task.changed` to the stable
Conversation Task. The notification supplies an exact App, Task and attempt
reference; storage checks the Topic link and reads the accepted result. Event
summary text cannot substitute another answer. Success, waits and honest
non-success reports use the same system-input boundary. The worker judges
their meaning with current Conversation and Request context; the controller
owns execution and follow-through.

A declared old supervisor subscription is bypassed for Task-owned Conversations,
including summary-only notifications without an accepted outcome. A self-link
cannot turn the Conversation's own reply into fresh input. Existing legacy
Conversations still need a cutover; this checkpoint does not retire their
separate result projection or the App's old follow-up declaration.

The existing `conversation.supervision.review` timer event selects up to 100
accepted linked outcomes lacking a Conversation input. It emits the same
`conversation.task.changed` notification. Admission removes each selected
reference from that query, so later pages progress across restart without a
separate cursor or delivery table. Pending, failed, handled and stopped inputs
already belong to their Task and are not re-created by discovery. Closed
Conversations and self-links are excluded. New notification identities allow
a later timer to retry a failed admission; the input's stable outcome identity
still prevents duplicates.

Five added checks use actual storage and installed runtime paths with supplied
decisions:

- Live delegated success returns to the Conversation and closes its accepted
  Request while both Tasks remain open. The old supervisor subscription stays
  present in the fixture and creates no Task.
- A result committed with ingress stopped is discovered after SQLite reopen
  through a timer event and returns through that same controller.
- Failed result-input admission, including a failed discovery tick, preserves
  the child's accepted evidence. A later tick admits it once after storage is
  repaired. Replayed notifications and quiet ticks make no further model call.
- An honest child failure returns to the Conversation without fulfilling the
  Request or closing the assignment. The normal backoff timer runs the child
  again; successful evidence then returns and resolves the ask.
- One-item discovery pages progress across two Conversations and multiple
  Tasks. Stop survives reopen, late links are discovered, and owner closure
  prevents future Conversation input. Self-links cannot cause a reply loop.

The runtime tests also exposed a deferred timing report writing after runtime
drain and database close. The callback now checks that its runtime is still
installed; it needs no new timer registry. The Conversation suites pass **31
tests**. These are supplied-decision tests, not live-model or managed-process
Conversation trials.

A temporary query fixture with 2,001 accepted attempts and 1,980 handled
references found 21 pending outcomes. Twenty selections averaged **8.6 ms**.
SQLite uses existing Topic, Task-attempt, Conversation-input and primary-key
indexes; no new index is added. The 100-item limit bounds returned work, not
historical rows examined. The query remains scoped to one App's links but its
cost grows with their retained history. This local measurement is acceptable
for the existing infrequent discovery tick; it is not a scale or latency guarantee.

The closure checkpoint below extends this common route. Later checkpoints
supply prior-attempt context and exercise managed-model recovery. Per-input
pacing and retirement of the old execution and follow-up owners remain required.
Human Task controls are covered below. No installed state or Host main changed.

## Returning owner closure through Conversation input

Source [checkpoint `1b43c973`](https://github.com/hao1939/may-agent/commit/1b43c973)
extends the same route to the owner's saved
closure. The worker owns how to pursue its assignment; the owner decides
whether to continue, revise or close it. Code applies that decision and returns
the fact to the linked Conversation. Closing a Task does not manufacture a
successful result or resolve the human's Request.

Accepted results name an exact attempt; closures name an exact Task generation.
Admission checks the saved source and Topic link in one transaction. The
existing cancellation event supplies the committed generation; notification text
alone cannot stop an attempt or create a closure input. Cancellation uses the
stored reason and rejects late results from the interrupted attempt.

The existing review timer discovers both missing outcomes and closures, then
emits the same `conversation.task.changed` event. Existing input identities
deduplicate admission and preserve Stop across restart. There is no new table,
scheduler, model role or delivery cursor. If the stable Conversation Task remains
but its App removes Conversation capability, retained work cannot fall back to
the old routing owner.

Five new supplied-decision checks cover live closure, missed notification and
restart, Stop of the closure-review Turn, exact source validation with atomic
admission rollback, and capability removal. The runtime cases leave the Request
open after Task closure; a later human withdrawal closes it explicitly while
the Conversation Task stays open. All **36 Conversation tests** pass.

The updated local discovery fixture contains 2,001 accepted attempts, one
closure and 1,980 handled references. It returns 22 pending changes; twenty
selections average **9.4 ms**. Both query branches use existing indexes and are
scoped to the recipient App. The limit bounds returned work, not history read;
the measurement is not a scale guarantee.

Live closure is proved through the existing `cancelLoadedAppTask` path. Direct
state/App-action closures still need their notification path reviewed; discovery
can find saved closures without a live event. All closures currently become
facts, including closure after success. Measure any extra quiet-review model
cost in the managed trial before adding suppression policy. This checkpoint
does not prove live-model understanding or retire the legacy execution owner.

## Prior evidence in normal execution

[Checkpoint `4e040987`](https://github.com/hao1939/may-agent/commit/4e040987)
fixes a gap exposed by reviewing the earlier live harness: it supplied its own
previous report, while normal Conversation context omitted prior attempt
evidence. A claim now projects the latest earlier stored attempt into
`previousAttempt`: exact identity and generation, execution state, failure,
session/workspace references and any accepted report/result/evidence. Current
generation evidence takes precedence; fallback retains the older generation.

The same projection reaches registered executors, managed agents, workflows,
Codex packets and Conversation context. It adds no persisted field, table,
query or recovery policy. Tests cover retry, accepted child failure, reopen,
owner revision and isolation from consumer mutation. The missing-context
regression failed before the fix; the focused suites then passed 27 tests.

## Managed Conversation recovery

[Checkpoint `03618081`](https://github.com/hao1939/may-agent/commit/03618081)
replaces the shared prompt's premature "call finish() now" with continuation
within the original scope and remaining budget, following App instructions and
checking uncertain effects. It retains the existing bounded completion
mechanism and schema guidance; there is no new recovery-prompt framework.

The [live harness](https://github.com/hao1939/may-agent/blob/03618081/scripts/poc/controller-judgment/managed-conversation.ts)
uses human-event admission, one stable Conversation Task, the installed
controller, actual managed model/tool execution and Conversation settlement.
Its synthetic App checks and records a measurement in temporary storage.
Every write appends a record, making accidental repetition observable.

All three trials passed on clean `03618081` with `gpt-5.6-sol`:

| Injected fault | Observed behavior | Attempts / backend calls | Elapsed | Reported tokens |
| --- | --- | --- | --- | --- |
| Empty initial response | Read 0.92, recorded once, correctly reported above 0.90 | 1 / 3 | 13.0 s | 9,357 |
| Interrupted stream after the record committed | Re-read committed state, avoided another write, returned the correct comparison | 1 / 4 | 18.5 s | 12,339 |
| Managed result lost before settlement; SQLite reopened | New attempt received the exact failed session, read the existing 0.78 record and correctly reported below 0.90 without another write | 2 / 5 | 23.6 s | 15,221 |

The lower-value restart case used unchanged App instructions. Each trial
injected its fault, retained exactly one record, stored the reply and fulfilled
Request update, left its Task open with no due retry, and avoided the legacy
executor. Tool traces and answer comparisons were inspected. The interrupted
trials' saved sessions contain the revised continuation prompt. The models
chose the next useful read/action; code supplied retry timing, prior evidence
and result settlement. None needed to schedule its own recovery.

These are three synthetic, in-process managed trials, not a success-rate claim
or proof of the worker subprocess, installed May App, transport delivery or
live child chains. Reported tokens include repeated/cached input; backend
internal retries and billing were not independently measured. The harness's
attempt/call/time limits bound the experiment, not Task lifetime. An earlier
empty-response baseline also passed with the old prompt; these results do not
establish that the wording change improves success rate.

The next proof is migration and removal: one execution owner after cutover,
fresh human input unaffected by unrelated retry cooldown, live child return
through intervening input, and the real worker/restart boundary. Keep the
experiment focused on these gaps rather than adding a new recovery subsystem.

## Human Task controls through Conversation

[Checkpoint `ef0b9554`](https://github.com/hao1939/may-agent/commit/ef0b9554)
moves conversational cancellation into the same fenced transaction as the
accepted Turn, Request updates and reply. Preparation resolves an exact Task
from human context or the selected stored Topic. Settlement reuses the existing
Task cancellation operation and checks the prepared generation/resource version.
A system Turn cannot control Tasks, and the worker cannot close its own Task.

After commit, the existing cancellation event aborts the exact running attempt;
the common ready event wakes its parent across the worker boundary. The old
daemon callback that published a separate cancellation request is removed.
Human-facing Task reads now offer cancellation for all open Tasks, regardless
of the retained `achieve`/`maintain` spelling. No SDK control or table is added.

The **41 Conversation tests** pass, including reply-write rollback, target
revision after preparation, intervening human correction, source authority,
cross-App closure/reopen, actual attempt abortion and rejected late output.
The Task read/control suites pass **31 tests**. Cancelling the Task does not
silently close its original human Request. These use supplied decisions and
the in-process runtime; worker-subprocess and live-model cancellation remain
unproved. The old inbox execution and follow-up owners still need retirement.

## Offline Conversation cutover

[Checkpoint `f5b3eafe`](https://github.com/hao1939/may-agent/commit/f5b3eafe)
removes the old Conversation turn handler and
its separate reply/handoff callbacks. Inbox composition admits input and reads
context; Task runtime owns Conversation execution. Missing Task admission fails
before a conversational input is stored, without falling back to another executor.
The older follow-up routing and result projection still require retirement.

`migrateConversationInputs` is an offline state operation for one declared App
and Conversation. In one transaction it saves prior execution evidence as
historical attempts, retains exact old claim generations, fences those claims,
and binds the inputs to the stable Task. Unfinished and failed input enters
normal admission for redo; answered and explicitly stopped input stays quiet.
It does not manufacture an accepted Task result. Requests retain their state
until a new answer is accepted, and failed import rolls the conversion back.

The focused Conversation/state/runtime suite passes **47 tests**, including
reopen, replay, old-claim rejection, rollback, quiet history, subsequent human
input and child return through an intervening discussion. A fixture omitted
the required Request timestamp; that is corrected. The child-chain timeout
failed after a reported 78 ms against its 2 s wall-clock limit, then passed
alone. Its deadline now uses monotonic time with the same behavior assertions.
Counters attached to the removed executor callback are deleted; actual Task
binding, claims, settlement and exclusion from inbox execution are the evidence.
The live harness now checks the retained input's execution Task directly; its
previous three live results remain tied to `03618081`, not this changed source.

This operation is not an upgrade command or proof that old processes stopped.
Its `oldRuntimeStopped` argument records an operator assertion. Actual process
shutdown, mixed ordinary/conversational input in the same Conversation,
retained Task-policy migration and worker-process cutover remain unproved.
The existing admission guard rejects unhandled unconverted input; the enclosing
transaction rolls back rather than partially converting that case.

Host/SDK types, boundary checks and lint pass. Full CI reports **2,621 passed,
3 skipped and 185 failed** across 2,809 tests in 283 files (167.8 s). Compared
with `ef0b9554`, 57 failure names were added and none removed. They belong to
legacy Conversation Stop, execution, Request, handoff and containment suites
still using the retired path. Useful contracts must move to Task execution;
these failures cannot be dismissed as obsolete assertions without that audit.
All 128 earlier failures also remain unresolved. This is a PoC checkpoint,
not a merge-ready candidate.

This slice removes **326 net production lines** (149 added, 475 removed),
including the offline state operation. The whole branch now adds **598 net
production lines** against `3037c4b9`, using the same exclusions below. Removing
one duplicate executor is concrete progress, but total simplification still
depends on retiring the remaining owner paths and resolving migration checks.

## Follow-up retirement

[Checkpoint `24208b00`](https://github.com/hao1939/may-agent/commit/24208b00)
removes the supervisor's result-to-reply projection,
automatic waiting/assignment messages and quiet-Task review query. Task-change
events now carry exact source identities; admission reads the accepted attempt
or owner closure from storage, and execution gathers current Conversation
context. The timer only discovers missing outcome/closure inputs. An absent
Conversation capability cannot route those events back to an old supervisor.

The paired May App candidate, workspace commit `0823556a65` on
`poc/may-conversation-task-input`, removes `conversation/follow-up`, its event
resolver and its separate result contract. May's ordinary Conversation guidance
retains the useful judgment: preserve current scope, leave healthy work alone,
keep unchanged automated reviews quiet and do not confuse a later finding with
another fulfillment of an old ask. The existing schedule remains a discovery
tick. This App source is isolated and must be reviewed with the Host candidate;
it has not been integrated into workspace main or activated.

The five focused Host suites pass **96 tests**. The seven May declaration tests
pass against the candidate SDK. The important coverage changes are:

| Former check | Current proof or accepted tradeoff |
| --- | --- |
| Separate supervisor admits and returns delegated work | Common runtime tests return exact outcomes through live notification, restart and failed admission; no supervisor is created |
| May-owned goal and later steering | Real runtime selects the same App's goal input, executes independent work, reopens storage and steers that exact Task |
| Subscribed input answered directly | Persisted subscription routes system input to the default Conversation's one execution Task |
| Request closure through supervisor output | Twelve state tests retain scope/revision checks, bounded context, actual handoff links and atomic reply/closure; failed settlement uses safe redo |
| Host-generated waiting and assignment notices | Removed; accepted replies and Task reads remain the user-facing evidence |
| Quiet linked work is periodically investigated | Removed; the timer discovers saved outcomes/closures, while mechanical failures remain visible in Task evidence and paced recovery |

No worker-process or live-model evidence is added by these supplied-decision
tests. A retained old supervisor still requires explicit owner retirement during
offline cutover; removing its declaration does not close its durable Task.
Retained Task-policy migration, human responsiveness during cooldown and the remaining full-suite
failures are still adoption gates.

Full CI at `24208b00` passes types, App boundary and lint, then reports **2,634
passed, 3 skipped and 171 failed** across 2,808 tests in 283 files (132.3 s).
Against `f5b3eafe`, no failure entries were added and 14 were removed through
the coverage migration above. The three old composition cases became the two
new runtime checks plus existing cross-App return coverage; total test count
falls by one. Remaining failures are unresolved work, not automatic candidates
for changing expectations.

The Host slice removes **445 net production lines** (16 added, 461 removed).
The whole Host branch now adds **153 net production lines** against `3037c4b9`,
excluding tests, fixtures, scripts and documentation. This is a smaller change
than the earlier 924-line increase, with duplicate source paths actually removed.
It is not evidence that operational migration is complete.

[Checkpoint `75154039`](https://github.com/hao1939/may-agent/commit/75154039)
integrates upstream main `a8f65188`, preserving the observer-feedback, model-field
and metrics changes. The single manual conflict combined two SDK type imports.
Full CI passes types, boundaries and lint, then reports **2,660 passed, 3 skipped
and 171 failed** across 2,834 tests in 286 files (137.8 s). The 26 additional
tests pass; failure entries are unchanged from `24208b00`. The production delta
against that current main remains 153 net lines, excluding upstream additions.

## Fresh human input during retry

[Checkpoint `89329ce4`](https://github.com/hao1939/may-agent/commit/89329ce4)
reproduces the Task-wide cooldown delaying newly
admitted human input, both after failure and when input arrives during a failing
attempt. It uses one persisted `freshHumanInput` flag on the Task, written in
the admission transaction and consumed by the next claim. New input clears a
deadline without clearing the failure count. Input arriving during execution
keeps that opportunity through failure settlement and restart. No retry table,
per-input counter, scheduler or App recovery action is added.

Five new state checks exercise durable replay, input arriving during executor
failure or result rejection, failed capability admission and rejected admission
rollback. Two Conversation-runtime checks use real input admission, controller,
SQLite, capacity, pause and reply settlement with supplied inference. They seed
seven earlier failures, then observe the runtime's next failure. New human input
executes before the resulting 30-second delay, including after a capacity wait
and storage reopen. The original Request stays open; the new answer does not
pretend to fulfill it. Existing scoped Stop coverage remains part of validation.

The accepted tradeoff is earlier reconsideration of the pending failed work
when a human speaks. Each new admission permits one fresh claim; duplicate
messages, system reviews and timers do not. A failed capability check consumes
the opportunity too, preventing a rapid loop while execution is unavailable.
This proves source mechanics, not actual model responsiveness or transport
delivery. Retained-state cutover, full-suite migration and worker-process
proof remain open.

Host/SDK types, boundary and lint checks pass. Full CI reports **2,668 passed,
3 skipped and 170 failed** across 2,841 tests in 286 files (149.8 s). All seven
new checks pass. No failure entries were added; the existing check that fresh
input must not receive an old attention result now passes. This slice adds
**23 net production lines**, bringing the whole branch to **176 net added lines**
against `a8f65188`, excluding tests and fixtures.

## Migrating tool execution and accepted-result checks

[Checkpoint `3e61e705`](https://github.com/hao1939/may-agent/commit/3e61e705)
moves five failing Conversation tests off the removed inbox
executor and through installed Task admission, execution and settlement. The
Conversation agent now requires its Task binding; it cannot fall back to inbox
recovery ownership. Guidance distinguishes finishing a Turn, resolving a Request
and creating separate background work.

The tool-loop cases use scripted model choices with real read, edit, write,
shell and finish tools. A failed content check is repaired within the same Turn.
Injected interruption and exhausted execution preserve the original Request and
leave input pending. After SQLite reopen and the due time, the next attempt reads
prior failure evidence, verifies existing files without repeating writes, and
answers the original ask. Accepted input is not replayed after another reopen.
Malformed child-wait output admits neither child work nor Topic effects.

Two accepted-result tests now check the continuing-Task contract: an accepted
parent outcome does not close its live child, and finite work retains exact
accepted evidence while open and after explicit owner closure. The three focused
suites pass **45 tests**. These are source checks with supplied inference, not
new live-model or worker-process trials. Retained-state migration remains open.

Full CI passes Host/SDK types, boundaries and lint, then reports **2,675 passed,
3 skipped and 163 failed** across 2,841 tests in 286 files (139.4 s). Seven
failure entries were resolved and none added. This checkpoint adds no net
production lines; the whole branch remains at **176 net added lines** against
`a8f65188`, excluding tests and fixtures.

## Workspace and worker-process boundaries

[Checkpoint `127c3ab2`](https://github.com/hao1939/may-agent/commit/127c3ab2)
migrates **19 workspace checks** from terminal receipts and
permanent attention to exact accepted attempts and paced continuation. It keeps
the Git contracts: local/shared execution needs no worktree, declared branches
select the execution base, uncommitted changes keep their checkout, and committed
but unmerged changes can retain their branch after checkout removal. Integration
allows the same Task to retry at its saved deadline and release the checkout.
Acceptance leaves the Task open and quiet. These state checks control the clock;
the existing real-timer checks retain ownership of scheduling proof.

The **nine real worker-process checks** cover inherited agents, restored agents
and workflows, pinned source, rejected App removal, parent disconnect and control
delivery. A fresh due attempt uses restored code; startup recovery neither imports
workflow definitions to judge availability nor publishes a separate repaired
handler decision. This replaces the removed availability-inspection race test.
The tests preserve the failed attempt and original generation instead of expecting
an unblock mutation or terminal receipt.

A new process probe admits one measurement ask, writes its value in a workflow,
then disconnects the worker's IPC parent before settlement. The old worker exits
before a separate recovery process releases its claim. A replacement worker gets
the interrupted attempt's identity, reads the existing measurement and answers
the original admission on the same Task. A later worker entry creates no new
attempt or effect publication. This is real subprocess/IPC/SQLite evidence with
a deterministic workflow. It is not a live agent, Conversation subprocess,
complete Host restart or operational old-to-new runtime cutover.

Full CI passes Host/SDK types, boundaries and lint, then reports **2,701 passed,
3 skipped and 138 failed** across 2,842 tests in 286 files (162.6 s). The 25
previously failing workspace/process cases and the new effect-retention case
pass; no failure entries were added. This checkpoint changes tests and fixtures
only. The whole branch remains at **176 net production lines added** against
`a8f65188`, excluding tests and fixtures.

## Historical completion receipt cutover

Checkpoint `dfd78b06` imports an old completion receipt as an
explicitly historical accepted outcome, links matching admission keys by Task,
generation and specification hash, and records closure on the retained Task.
It does not guess which old worker attempt produced a receipt. The original
receipt, worker attempts and compacted-history digests remain unchanged. Attempt
history gains a labeled receipt-import entry; the execution count excludes it.

The conversion preserves existing human/owner closure and leaves newer Task
generations unchanged. It fences obsolete live
claims when a receipt already establishes completion. A closed child's history
can be restored under a closed parent, without admitting new executable work.
Replay is a no-op, and failure rolls back the complete App-scoped conversion.
The source remains an offline helper, not an operational upgrade runner.

Eight conversion tests and the owning storage/accepted-result suites pass
**46 tests**. The reproducible
[`task-state-cutover.ts`](https://github.com/hao1939/may-agent/blob/38a048da5c105bea91dc7163010d94483a60b747/scripts/poc/task-state-cutover.ts)
trial additionally writes a fresh SQLite database through old Host `a8f65188`,
closes it, runs the candidate's normal Host schema upgrade and imports its real
receipt. The original ask returns the original measurement, its old attempt
remains intact, and the closed Task performs no new execution. This is an
old-source-to-new-source storage trial with supplied execution results, not a
Host restart or live-model trial.

Full `bun run ci` at `dfd78b06` passes Host/SDK types, App boundary and lint,
then reports **2,709 passed, 3 skipped and 138 failed** across 2,850 tests in
287 files (144.1 seconds). It adds eight passing checks with no new failure
names versus `127c3ab2`. The remaining failures still require individual review.

The schema upgrade must precede the state conversion: the standalone Task test
store does not upgrade old inbox columns before creating the new indexes. As
with Conversation cutover, `oldRuntimeStopped` is an operator assertion; it
cannot prove process quiescence. Receipt-only history also lacks a complete
executable specification. Its reconstructed Task is an inert closed projection;
the original receipt remains the historical record, including unavailable or
compacted details. No lost evidence or acceptance check is invented.

The next checkpoint below covers maintained-cycle outcomes, unfinished
failure/wait inputs and worker self-stops. Supervisor retirement and the
operational cutover remain required. Receipt import alone
does not yet permit removing all historical receipt readers. It adds **186 net
production lines**: 169 in the offline conversion and 17 in storage/history
projection. It adds no table, scheduler or execution authority. The original
receipts remain archival evidence while consumers move to accepted outcomes
and explicit closure; this is not a completed compatibility retirement.

## Retained open Task state

The open-state converter at `186392c9` runs after receipt import, inside an App-scoped
SQLite transaction. It preserves the latest maintained or waiting outcome on
its exact retained attempt. Historical maintained results did not always save
their acceptance method; the import leaves that detail absent instead of
inventing a verifier or a model judgment. New execution still records its
normal acceptance basis.

Original input is recovered from saved attempt/event batches. Only input
actually present in an accepted attempt is linked to that outcome. An older
answer already returned through an inbox record stays there; a later unrelated
Task result cannot replace it. Waiting inputs regain their exact child and
Condition links. Existing Condition evidence and review deadlines survive the
conversion, and another input can be handled while the wait remains open.

An old worker self-stop is identified by its recorded App agent and attempt,
not inferred from its prose. Its original cancellation record is retained on
that attempt as historical evidence. The Task becomes eligible for continued
work with backoff, and the worker receives its previous non-success report.
Human/owner closure and human Turn Stop remain effective. This is a scoped
offline conversion, not a new runtime operation for reopening closed Tasks.
Interrupted and failed work retain their original input, ordered claimed and
pending facts, failure counts, workspace/session evidence and pause controls.
Workflow-to-agent handoff remains a handoff.

Fifteen new source checks pass. They cover quiet maintained outcomes, later
results, child and Condition returns across intervening input/restart, deadline
retention, failure pacing and pause, obsolete claims, human Stop, worker stops,
atomic rollback, App isolation, and refusal of missing or mismatched acceptance
identity. The expanded
[`task-state-cutover.ts`](https://github.com/hao1939/may-agent/blob/38a048da5c105bea91dc7163010d94483a60b747/scripts/poc/task-state-cutover.ts)
trial also uses actual old Host `a8f65188` writers for a maintained result, a
Condition wait, failure, in-flight work, worker self-stop and human cancellation.
After the candidate schema/state upgrade, the wait and three unfinished Tasks
continue with their original input. Completed work stays closed, maintained
work stays open, and human cancellation remains unchanged. Results are supplied
by the harness; no live-model or full Host restart is claimed.

Full `bun run ci` passes Host/SDK types, App boundary and lint, then reports
**2,724 passed, 3 skipped and 138 failed** across 2,865 tests in 288 files
(144.6 seconds). The checkpoint adds fifteen passing checks with no new failure
names versus `dfd78b06`; the unresolved failures are not presumed obsolete.
It adds **238 net production lines**: 235 in the offline converter and three
for historical state fields. It reuses event ordering/coalescing and the same
fenced resource commit, adding no table, scheduler or execution owner.

This is still an offline source helper. Missing original input or a missing or
conflicting accepted-attempt reference aborts the App transaction; this version
does not reconstruct lost history from backups or guess another answer. The
operator must establish that the old Host and workers stopped before invoking
it. Supervisor retirement, mixed ordinary/Conversation cutover, operational
activation and full regression convergence remain unfinished.

## Mixed ordinary and Conversation input

At `47638e0e`, a Conversation can contain both messages and inputs for ordinary background
Tasks. The previous admission guard treated every unfinished unconverted row
in that Conversation as legacy Conversation execution. It therefore rejected
new messages and rolled back migration whenever an ordinary input was present.
The inbox claim/readiness queries also excluded the entire Conversation after
its first input acquired an execution Task, stranding the ordinary work.

Admission, result-return admission and offline conversion now use the existing
App `requests.inputKinds` declaration to identify legacy Conversation input.
Inbox readiness and claims use the same declaration to select ordinary input;
they never claim converted input or a declared Conversation kind. Apps handling
all input conversationally have no inbox execution work. State callers without
an App declaration retain their conservative legacy fence. No new App option,
table or execution owner is introduced.

The focused suites pass **70 checks**. Two added regressions reproduce the
previous failures: migration preserves ordinary input unchanged across reopen,
and normal Host admission runs both a Conversation reply and an ordinary Task
in the same Conversation before and after reopening storage. The Task's exact
result returns to its ordinary input while the Task stays open. Existing checks
also verify result-return admission while unrelated ordinary input is pending,
and exclusion of expired legacy Conversation execution.

Full `bun run ci` passes Host/SDK types, the App boundary and lint, then reports
**2,726 passed, 3 skipped and 138 failed** across 2,867 tests in 288 files
(158.8 seconds). No failure names were added or removed versus `186392c9`.
The checkpoint adds **32 net production lines**; full-branch growth is 632.
Those counts exclude tests, fixtures and Markdown. Documentation integrity,
checked examples and the canonical App boundary also pass.

This establishes the mixed-input source boundary, not an operational cutover.
Retained supervisor retirement, complete process shutdown/activation, broader
regression convergence and current-source model trials remain required.

## Retiring the old supervisor

At `26dce52f`, the retirement proof reuses standalone Task event admission, the normal
owner-close operation and Conversation input migration. It adds no production
mechanism. A pending frozen command can still name the old supervisor even
after the new App removes its subscription. Closing first would cause replay of
that command to fail against the closed Task.

The tested order, with execution stopped, is:

1. Apply the supervisor's already-resolved command to storage through standalone
   Task admission. Record its admission with the original event identity.
2. Convert the retained Conversation input and close the supervisor by exact
   generation and resource version. Keep these changes in one SQLite transaction.
3. Reopen storage and activate the App without its old supervisor declaration.
   The ordinary review event discovers any unreported linked result and admits
   it to the Conversation Task.

The source test starts with an obsolete inbox claim, a running supervisor claim,
an accepted Request, a Topic-linked worker result and a frozen supervisor command.
It injects a closure-write failure: command admission and Conversation conversion
roll back, and both original claims remain valid. The successful transaction
preserves the worker, Topic and Request, and rejects both obsolete owners.
After reopen, the common Conversation runtime reports the exact measurement
and closes the Request. The supervisor never executes; the worker and Conversation
Tasks remain open, with no remaining missing-result or runnable-work entries.
The two cutover suites pass **eight tests**.

The old-source storage trial also writes an unfinished maintained supervisor
with Host `a8f65188`, converts it with the candidate and closes it through normal
owner control. Obsolete output is rejected and other maintained/unfinished work
continues. Its report adds `retiredSupervisor: true`.

Full `bun run ci` passes types, the App boundary and lint, then reports
**2,727 passed, 3 skipped and 138 failed** across 2,868 tests in 289 files
(147.0 seconds). No failure names changed versus `47638e0e`. This checkpoint
adds only a test and PoC-script coverage; net production growth remains 632
lines against `a8f65188`. Design integrity, examples and changed-document links
also pass.

These are supplied-decision source trials. The integrated test covers one App,
one Conversation and a frozen Task-resolver command. It does not operate real
old Host processes, exhaust every queued route form, validate installed May
guidance or provide an upgrade runner. The operator must account for relevant
pending commands before retirement; failure is an incomplete cutover, not
permission to delete a command or its accepted work. Complete process
shutdown/activation and full regression convergence remain required.

## Critical path through real workers

At Host `4bff7813`, this trial follows the shared loop, with additional corner
cases deferred:

```text
human -> Task A -> delegates Task B
human -> Task A -> answers while B runs
         Task B -> accepts outcome -> event/input -> Task A -> replies
```

Both Tasks execute through the normal controller and worker process. The
App's conversational handler supplies A's response and Request decisions;
the workflow handler supplies B's measurement. No second executor owns A.

[task-interaction-scenario.ts](../../../may-agent/test/integration/fixtures/task-interaction-scenario.ts) uses temporary SQLite,
normal App discovery, HTTP provider requests, `finish` tool validation and
private worker IPC. One scenario handles two human inputs on the same Task
across storage reopen and rejects duplicate dispatch as a reason for another
model call. Another publishes human messages through normal ingress: A admits
B and an open Request, answers a second human message while B waits for an HTTP
measurement, then receives B's exact accepted attempt through the normal event
route. A reports 17 and fulfills the Request. Both Tasks remain open. After
closing and reinstalling the runtime and reopening SQLite, A answers from the
retained discussion without creating another Task or leaving an unreported result.

The worker boundary suite passes **11 tests**, including these two scenarios.
This checkpoint changes only test code and reuses the existing worker harness;
it adds no production mechanism. The scripted provider proves the plumbing and
structured-result contract, not independent model judgment. The reopen check
does not restart the full daemon or perform an operational upgrade. Next,
exercise actual App guidance and unscripted model decisions on this same path
before adding further recovery scenarios.

Full `bun run ci` passes Host/SDK types, the App boundary and lint, then reports
**2,729 passed, 3 skipped and 138 failed** across 2,870 tests in 289 files
(157.9 seconds). Both new trials pass in the full suite; failure names are
unchanged from `26dce52f`. Net production growth remains 632 lines against
`a8f65188`. Design integrity, examples and all 44 changed-document links pass.

## Live May on the shared loop

Host `4e216338` and paired App `0823556a` pass two live trials with
`gpt-5.6-sol`, using the same App declaration, seed, May role instructions and
shared common sense. Both source checkouts were clean. The
[shared-loop script](https://github.com/hao1939/may-agent/blob/38a048da5c105bea91dc7163010d94483a60b747/scripts/poc/controller-judgment/shared-loop.ts)
records their revisions and copied-file hashes. The second run changes only
the measurement; its instructions were not tuned after the first result.

The ordinary ask requests a background sample check against a 0.90 minimum.
The model selects a May-owned goal through the actual App mapping. While B's
HTTP read waits, A explains why one sample may be insufficient for a broader
decision. The model neither polls Task state nor manages subscriptions or
retries. When code accepts B's outcome, its event becomes input to A, which
reports the finding and fulfills the original Request. Both Tasks stay open.
After runtime/SQLite reopen, a new human input receives the earlier result and
the discussion's limitation from retained context.

| Trial | Result judgment, inspected in final and reopened replies | Task attempts | Model responses | Measurement reads | Tool errors | Elapsed |
| --- | --- | --- | --- | --- | --- | --- |
| Development: 0.92 | Meets 0.90 by 0.02; one sample does not establish long-term reliability | 5 | 6 | 1 | 0 | 51.6 s |
| Held-back value: 0.78 | Does not meet 0.90; preserves the same single-sample limitation | 5 | 7 | 1 | 0 | 63.1 s |

Elapsed time includes holding the observation until the intervening discussion
finishes; it is not a provider-speed benchmark.

Both pass the mechanical checks for exact accepted-attempt correlation, one
linked background Task, an open Request during discussion, later fulfillment,
unchanged intervening response and retained Task identities. Neither emitted
`handler.failed`. Local reports retain attempted tools, model usage metadata,
events and transcripts. The endpoint reported 2,484 and 2,943 output tokens;
those counters are telemetry, not independently verified billing.

The trial limits tool presets to coding and finish, uses a local HTTP source,
and omits optional skills and other installed Apps. It bounds itself to eight
worker dispatches and six minutes; those are experiment limits, not Task
lifetime rules. It proves two Tasks on the same App with actual model judgment,
not the complete installed tool catalog, a three-Task chain, all failure cases,
transport delivery or operational cutover. Basic reopen is not a full daemon
restart. The paired App's later README-only commit `71e2af6b` removes stale
supervisor documentation without changing the tested declaration or prompts.

At Host `4e216338`, full CI still reports **2,729 passed, 3 skipped and 138
failed** (2,870 tests, 289 files, 145.5 seconds); Host/SDK types, the App boundary
and lint pass. The live results justify continuing with the shared loop.
They do not clear the regression, migration or overall complexity gates.

The next checkpoint, `1be08130`, restores the two existing cross-App result
checks to the active lifecycle. Their old setup paused the App and then claimed
work manually, which the current storage boundary correctly rejects. The tests
now use active policy and the existing startup gate to control execution; they
release that gate after closing the controller during cleanup. They also wait
for committed attachment rather than recording success before the operation.
Both pass all 59 assertions: the original caller receives its exact accepted
0.92 result after a later input has produced 0.1 on the same Task, through either
an event or recovery. No production behavior changed.

Full CI at `1be08130` passes types, the App boundary and lint, then reports
**2,731 passed, 3 skipped and 136 failed** (2,870 tests, 289 files, 150.3 seconds).
Those two correlation tests are the only changed failure names versus `4e216338`.
Design checks and all 46 changed-document links pass. The remaining failures
still require individual review; they are not all assumed to be outdated tests.

## Nested delegation uses the same Task loop

The three-Task probe treats human interaction, review and measurement as roles:
A receives the ask, B requests C's measurement, C returns evidence to B, and B
returns its assessment to A. All three belong to the same May App and use the
same Task controller. No measurement App or extra execution owner is installed.

Host `f89ce4e7` removes two restrictions exposed by this path. Ordinary Task
handlers now see their own App's typed work inputs, using the same catalog as
the human-facing handler. A dependency may create another Task through that
App's mapping; the worker need not switch to low-level Task creation actions.
The source also accepts durable publication as sufficient to save a pending
wait. A Task worker publishes into the shared journal before the parent admits
the relayed input. Requiring the parent's synchronous receipt inside that worker
had reported failure even though the child was admitted. The fix reuses journal
recovery and exact input identity; it adds no IPC request/reply protocol.
Publication still does not claim admission, execution or a successful result.

Host `dbc707fa` corrects a related input-routing problem: a typed work input no
longer inherits the App's default Conversation. Only declared conversational
inputs use that default; explicit Conversation links remain supported. Without
this correction, C's raw result could appear in the human discussion before B
judged it. Delegated evidence returns to the assigning Task for interpretation.

The deterministic worker trial covers typed A → B → C → B → A admission,
an intervening human discussion, exact
returned evidence, no raw child reply in the human discussion, zero Task
execution failures, open Task identities and a fresh reply after SQLite/runtime
reopen. The missing-publication and invalid-target admission checks also pass.

An initial live run at `f89ce4e7` correctly delegated, discussed and assessed
the measured 0.92 against 0.90. Its script reported success too early on reopen:
the extra raw child message satisfied a reply-count predicate, while the new
input was still pending. That run proves the inspected pre-reopen model
behavior, not completed reopen. The corrected harness at `dbc707fa` requires
the new input to be settled and its own response to recall the measured value.
It also selects the exact final attempt rather than relying on result order.

The next live development run at `dbc707fa` exposed an avoidable model loop.
B's waiting report quoted the pre-admission observation that no child existed
yet. A interpreted it as current state and unnecessarily steered B again; B
then read Task state to verify work that code had already admitted. The three
Tasks eventually returned the correct result, but the trial exhausted its ten
dispatch allowance before the reopen input could execute. That is a failed
end-to-end trial, not proof of clean follow-through. Increasing the allowance
would hide the unnecessary supervision work.

Host `64cd4d1b` instead matches ordinary dependency behavior: automatically
return an answer, honest failure report or owner closure. Keep recorded waits
readable without starting a caller attempt. Both event admission and periodic
change discovery enforce this rule. The 58 focused storage, lifecycle and
worker checks pass; the nested worker probe also verifies that the discovery
timer cannot turn a saved wait into another model request. The experiment now
reports allowance exhaustion immediately instead of waiting for its overall
timeout while the controller retries failed dispatches. These are fixture
allowances, not Task lifetime or retry-count limits.

Two live trials at Host `64cd4d1b` and paired App `b73886ab05` now pass the full
three-Task path, including a newly executed and settled input after reopen.
Both use `gpt-5.6-sol`. Their source checkouts were clean, revisions and copied
App/role/shared-file hashes match, and the held-back trial changes only the
measurement. No model instructions were tuned between the two runs.

| Trial | Inspected final and reopened judgment | Task attempts | Model responses | Measurement reads | Tool errors | Elapsed |
| --- | --- | --- | --- | --- | --- | --- |
| Development: 0.92 | Meets 0.90 by 0.02; retains the single-sample limitation | 7 | 9 | 1 | 0 | 88.0 s |
| Held-back value: 0.78 | Misses 0.90 by 0.12; retains the single-sample limitation | 7 | 8 | 1 | 0 | 83.9 s |

Neither run emits `handler.failed`. The seven attempts are A's admission, B's
delegation, C's measurement, A's intervening discussion, B's assessment, A's
final reply and A's new reply after reopen. The worker uses its available tools
to collect and inspect evidence; no Task polling or extra supervisory attempt
is needed. Both fulfill the original Request and leave all three Tasks open.
The human explicitly requests independent collection and review, so this tests
using that decomposition, not whether the model would choose it unprompted.
The reduced tool catalog, controlled HTTP source and basic storage/runtime
reopen do not prove full daemon restart, operational cutover or transport
delivery. Elapsed time includes deliberately holding the observation; it is
not a provider-speed comparison. Raw reports and transcripts remain local.

Full CI at `64cd4d1b` passes Host/SDK types, the App boundary and lint, then
reports **2,732 passed, 3 skipped and 136 failed** across 2,871 tests in 289 files
(161.3 seconds). The failure names are unchanged from `1be08130`. The branch
is 632 net production lines larger than baseline `a8f65188`, unchanged from
the start of this review. These fixes add no new
controller or storage mechanism. Full-suite convergence, operational cutover
and overall simplification remain separate acceptance gates.

## Moving inbox checks onto the Task loop

Host `f9ada65b` moves the retained contracts of fourteen removed inbox-execution
callback tests onto actual Task execution and settlement. Five added checks
cover canonical focus/command context without mutation, an old Topic outside
the bounded prompt, rejection of guessed work, and correction of a closed-target
handoff through normal backoff after storage reopen. Existing runtime checks
own direct replies, delegation, steering, subscribed input and human controls.
The Host's `test/README.md` maps each retired contract to its current owner;
generic inbox admission, attachment and readiness checks remain.

The old Topic check caught a real defect: preparation resolved an eight-character
reference, but settlement wrote that alias into canonical foreign-key fields.
Settlement now writes the resolved Topic ID. The closed-target check uses
previous-attempt evidence and the common retry, without restoring a special
two-call conversation recovery path. All **68 affected tests pass**. The code
guides now describe one Task lifecycle and the human-facing handler's limited
context/presentation responsibilities. This adds three production lines; the
full branch remains **635 net production lines larger** than `a8f65188`.

The first full CI run passed types, boundaries and lint, then aborted when a
Bun 1.3.14 test worker crashed with SIGILL during the workflow-guards integration
suite. Its partial totals are not a comparable full-suite result. Running that
suite alone passed all nine tests, without reproducing the crash. Both logs
are retained locally; the native crash remains unexplained.
One explicit full rerun passed types, boundaries and lint, then completed with
**2,737 passed, 3 skipped and 122 failed** (2,862 tests across 289 files,
174.2 seconds). Against `64cd4d1b`, the only fourteen removed failure names are
the migrated callback checks; no new failure name appeared. This is a coverage
migration with one production fix, not proof that the remaining regressions
are obsolete. Design integrity/examples/App checks and 49 local document links
pass; the Host code guides also pass a 20-link check. PR #158 remains draft.

## Retry evidence and canonical attempt context

Host `1b3506cc` updates the core retry and worker-failure checks to the accepted
continuing-Task contract. All 23 checks in those groups pass: failure cost is
counted once, ordinary facts cannot bypass backoff, retained input survives
repeated failure, accepted progress or owner revision resets pacing, and the
parent receives evidence without having to unblock each retry. Failure reports
keep both Task and children open. Explicit owner closure is atomic and does not
cascade: cross-connection races preserve children admitted before closure and
reject new attachment that loses the closure race. The two retained mode
spellings follow the same rules.

The retry test exposed a real storage defect. A bounded history read selected
attempts solely by timestamp and could omit the Task's current attempt when
timestamps tied or the clock moved backward. A valid claim then looked stale.
The query now prioritizes the existing current and observed attempt references
inside the same 16-attempt limit. Two deterministic storage checks cover tied
and backward timestamps, retained evidence, bounded history and history-free
reads. No new table, query or retry mechanism is added. This adds eight net
production lines; the full branch is **643 lines larger** than `a8f65188`.

The three affected state/retry/reconciler suites report **198 passed and 24
failed**. Those remaining reconciler failures are outside the migrated groups;
receipt, action and lifetime expectations still need individual review.
Full CI at this revision passes Host/SDK types, the App boundary and lint, then
reports **2,758 passed, 3 skipped and 105 failed** (2,866 tests across 289 files,
155.3 seconds). The seventeen resolved failure names all belong to the migrated
retry/report groups; no other failure name changed from `f9ada65b`. This run
completed without the earlier Bun worker crash. No operational cutover or
whole-system simplification claim follows from this checkpoint.

## Common reconciler outcomes and owner closure

Host `55e51193` completes the reconciler and parent-result coverage migration:
**185 checks pass** across those two suites. New outcomes are read from accepted
attempts on retained Tasks. Explicit owner closure preserves evidence, rejects
later admission and leaves independent children executable. A parent explicitly
waits for child evidence; a lifetime mode cannot infer that judgment. Failed
work retains its input and retries at its saved deadline without a supervisory
Task or manual unblock.

Four historical receipt-reader checks now seed the pre-controller stored shape
directly. Current completion no longer fabricates old state for them. They still
exercise real duplicate pruning, child preservation and exact recovery identity;
this preserves compatibility coverage until cutover permits reader retirement.

This checkpoint changes tests and coverage documentation only. Full CI passes
types, the App boundary and lint, then reports **2,784 passed, 3 skipped and 80
failed** (2,867 tests across 289 files, 148.0 seconds). All 25 resolved failure
names belong to the migrated reconciler and parent checks; no new failure name
appeared against `1b3506cc`. Runtime, inbox and daemon restart failures still
need investigation. The production delta remains **643 net added lines** against
`a8f65188`; the critical-path model trials retain their own source revisions.

## Runtime outcomes and input continuation

Host `c2b00c29` migrates the runtime and input-state checks to accepted attempts
on retained Tasks. Together with Human Task reads, the three affected suites
pass **181 checks**. They preserve exact answers, failure evidence, atomic
state/wake writes, saved backoff across a fresh process, stale-attempt fencing
and independent work. Capability replacement respects the existing retry
deadline. Invalid output can be corrected in a later attempt; a worker cannot
revise its own assignment.

The parent-repair case now returns the child's first failure to its assigning
Task. The App repairs the prerequisite; the common controller retries the child
at its saved deadline without an `unblock-task` action. The child returns its
verified result, then the parent accepts the original input. Both Tasks remain
open. This passes with live controller delivery and with storage/runtime reopen
before the parent's review. Accepted non-success reports also survive reopen,
reach the subsequent executor as evidence and remain readable after later
success. The original input stays unfinished until its exact answer is accepted.

These checks exposed a small read-model defect: Human Task detail omitted the
structured result retained on an open Task. The fix includes it in exact detail,
keeps compact lists bounded and hides the old result while a newer attempt is
running. It also preserves historical receipt detail. This adds **three net
production lines**, bringing the full branch to **646** against `a8f65188`;
no storage schema, scheduler or retry mechanism is added.

Full CI passes types, the App boundary and lint, then reports **2,834 passed,
3 skipped and 30 failed** (2,867 tests across 289 files, 151.82 seconds).
All 50 resolved failure entries belong to the migrated runtime and input-state
checks; no new failure name appeared against `55e51193`. The remaining checks
cover retired inbox execution assumptions and daemon restart/scheduled execution.
They still require behavioral review, not automatic expectation replacement.
The earlier live-model trials retain their own source revisions.

## Daemon restart with retained outcomes

Host `a9252e96` updates the three daemon checks that still expected current
completion to write a historical receipt and delete the Task. Their failing
runs had already reached accepted results. The checks now read the exact
accepted attempt, require its Task and generation to remain, and verify that
no owner closure was recorded.

The focused checks pass: scheduled workflow discovery, graceful shutdown while
waiting for a fact, and a daemon crash during an active workflow. Both restart
cases use real isolated daemons, sockets and workflow workers with optional
schedules disabled. After restart, the same Task waits for the exact fact and
accepts its result; the interrupted case also checks that the prior attempt is
no longer running. No production code changed in this checkpoint.

This is candidate-to-candidate restart evidence. It does not verify stopping
all old-version execution owners or activating converted production state.
A first local check incorrectly expected the raw Task socket view to expose the
Human Task view's `terminal` field. That assertion was removed; retained Task
identity and the absence of owner closure are checked through canonical storage.

Full CI passes types, the App boundary and lint, then reports **2,837 passed,
3 skipped and 27 failed** (2,867 tests across 289 files, 159.50 seconds).
Only these three failure names disappear against `c2b00c29`; no new failure
name appears. The remaining failures concern the retired inbox execution and
control fixtures. The production delta stays at **646 net added lines**.

## Public Stop and admission ownership

Host `e908ff94` moves the remaining admission containment and ownership checks
off the removed model callback. Input coordination still owns typed attachment,
claim renewal, capacity release and dependency reads; it does not execute an
agent. The ten containment checks use fake Task storage to isolate those
boundaries. Four ownership checks exercise real Task attachment transactions.
They preserve unrelated progress while a delayed attachment loses ownership,
and reject expired input before creating work.

The renewal test exposed a real gap: the Host revoked local authority after a
renewal write failed, but did not pass its existing authorization callback to
Task attachment. Work could still be created while the last stored lease was
fresh. The fix checks that authority inside the attachment transaction before
new effects. An exact committed replay needs no new authorization and cannot
change the accepted input or desired work. The regression holds the logical
clock before lease expiry, so execution delay cannot hide the missing check.
This adds **two net production lines**, bringing the branch to **648** against
`a8f65188`. It adds no state, scheduler or recovery policy.

Host `ae83b416` moves the two old public Stop cases into the Task runtime suite.
They call real Task attempts and the public event interface: Stop commits
before aborting, preserves independent work and the accepted Request, rejects
late output, and handles queued corrective input after runtime/storage reopen.
The corrected input runs on the same Task. A failed Stop transaction leaves
execution live; a stale control cannot alter an accepted result. A repeated
committed Stop remains an idempotent read. The separate existing controller
check still verifies newer input execution after Stop through normal scheduling.

The four affected suites pass **76 checks**. There is no added model-execution
fixture or restored inbox executor. The eleven old saved-decision/failure cases
still need review against retained input and affordable redo; this checkpoint
does not preserve their old promise to end failed input after one model call.

Full CI at `ae83b416` passes types, the App boundary and lint, then reports
**2,853 passed, 3 skipped and 11 failed** (2,867 tests across 288 files,
124.99 seconds). All sixteen resolved failure names belong to these migrated
checks; no new failure name appeared against `a9252e96`. The original two Stop
cases were moved, so the total test count is unchanged. The source remains
unmerged; cutover and overall simplification are still unproved.

## Failure handling uses the shared Task lifecycle

Host `bf402899` retires the eleven `app-inbox-failure.test.ts` cases that still
called the removed executor. Their old promise was one model call followed by
terminal input failure or saved-decision replay. The accepted contract permits
redo of an unaccepted attempt; input and accepted evidence must survive.
`test/README.md` maps each former guarantee to current executable coverage.

The existing Task runtime and settlement fixtures now cover:

- thrown execution, invalid output and missing follow-up Topic: input and
  attributed failure evidence reach a corrected attempt through the real
  backoff timer, including after runtime/storage reopen;
- a failed reply commit: no child admission, Topic, Request or answer escapes;
  retry succeeds after reopen when the target App is available, or retains
  unfinished work until that App returns;
- rejected guessed control or handoff: the target stays unchanged, input
  remains pending, and a corrected attempt receives the failure evidence;
- a failed interface notification after acceptance: one reply remains readable
  after reopen without another model call; and
- failed new/existing Topic settlement: reopening SQLite confirms atomic
  rollback of the reply, Request, Topic and accepted attempt.

The existing input-state test owns failure-evidence/retry-write rollback. The
real worker-loss scenario owns process recovery: it retains original input,
fences the exited worker and checks a committed measurement before safe redo.
An in-process database reopen is not substituted for that process proof.

All **88 checks across the three affected runtime/storage suites pass**.
No production code changes in this checkpoint. Six additional parameter cases
replace the eleven obsolete fixtures; the lower test count does not skip their
useful guarantees or preserve their superseded no-redo promise.

Full local CI at `bf402899` passes Host/SDK types, the App boundary and lint,
then reports **2,859 passed, 3 skipped and zero failures** (2,862 tests across
287 files, 140.66 seconds). The three skips require separately installed App
or agent configuration. The draft remains unmerged and undeployed; passing
portable CI does not certify old-version cutover or the whole installation.

## Real daemon cutover

The committed [`task-runtime-cutover.ts`](https://github.com/hao1939/may-agent/blob/38a048da5c105bea91dc7163010d94483a60b747/scripts/poc/task-runtime-cutover.ts)
trial passes from clean old Host **`a8f65188`** to clean candidate **`d2e1e2dc`**.
It starts actual daemon entrypoints and workflow workers using temporary App
files, SQLite and a local scripted provider. It calls no real model or installed
service. This extends the earlier source-only conversion checks across the
process boundary without adding a production migration service.

Before cutover, the old daemon accepts a reply and Request, starts measurement
and supervisor workflow workers, then holds the next human input in its real
inbox executor. The harness stops the parent before taking its process census,
kills it, and verifies all **four observed processes** are exited before opening
the database for conversion. Linux process start times protect the census from
PID reuse. This proves the fixture's shutdown; `oldRuntimeStopped` itself remains
an operator assertion rather than a process detector in core.

The existing receipt/open-state/input conversions run inside one SQLite
transaction with normal owner closure of the old supervisor. Before the old
inbox lease would expire, its exact owner/generation is rejected. The accepted
reply and open Request survive; independent measurement work remains present.
The candidate then proves:

- the original unfinished input is answered by the stable Task and its Request
  is fulfilled;
- the measurement keeps its original generation, its interrupted attempt stays
  readable, and a new accepted attempt returns the value **17**;
- the supervisor remains closed and its workflow does not execute again;
- fresh human input executes on the same Task, with no inbox execution lease;
  and
- the earlier reply appears once, with the executing Task and measurement Task
  both still open.

The report records **four scripted provider calls**: old accepted reply, old
held execution, candidate continuation and fresh candidate input. There are
**zero real model calls**. Startup reports the retired inbox session as
nonresumable; the existing startup policy leaves continuation to the Task.
No extra provider call resumes that session. The first development run omitted
the public event's required App target; correcting the harness was sufficient.
No production change was needed. The committed run is clean.

This is one exercised Linux upgrade with a synthetic App. It does not prove
arbitrary installation state, automatic process discovery during deployment,
rollback to the old lifecycle or production activation. Existing source checks
separately cover frozen supervisor command admission, receipt import, owner
closure and conversion rollback. The broader live trials remain the evidence
for actual App/agent judgment; this trial supplies decisions to isolate migration.
Local reports and daemon logs are retained outside the repository.

The small dispatch-backoff probe also passes again at this checkpoint: its
200 ms retry waits **201 ms** normally and **202 ms** after an ordinary wake.
Its README incorrectly retained the original failure claim after the controller
fix; that text now distinguishes the initial failure from current behavior.

Full CI at `d2e1e2dc` passed types, the App boundary and lint, then reported
**2,858 passed, 3 skipped and one failed** (2,862 tests across 287 files,
121.32 seconds). The existing waiting-daemon restart check reported a five-second
shutdown timeout during a test lasting 3.78 seconds. Its helper measured elapsed
time with `Date.now()`. A new deterministic regression reproduces premature
timeout after a forward wall-clock correction: the unmodified helper reports a
one-second timeout after only 4.77 ms. Host `2b13943f` changes that test helper to
monotonic elapsed time without increasing the deadline. The regression and both
real daemon restart cases then pass (**three checks**). This fixes the helper's
demonstrated clock sensitivity; the originating CI clock change was not captured.
No Host shutdown behavior changes.

Full local CI at `2b13943f` passes Host/SDK types, App-boundary checks and lint:
**2,860 passed, 3 skipped and zero failures** (2,863 tests across 288 files,
121.31 seconds). The added test is the clock regression; the three installation
configuration skips are unchanged. The clean cutover report remains tied to
`d2e1e2dc`; its successor changes only the polling test helper and regression.

## Historical receipts no longer decide execution

Host `9d819d53` removes completion receipts from admission, claims, dependency
readiness, recovery and owner controls. Normal reconciliation no longer writes
receipts or deletes Task resources. Accepted attempts and retained Task state
own current outcomes; explicit owner closure fences future execution.

The new regression uses an archived success for generation 1 and an unfinished
generation 2. The previous runtime incorrectly made dependent work runnable.
The revised runtime waits for generation 2's accepted outcome while keeping that
Task open. The regression fails on the previous implementation and passes on
the candidate. Exact input replay and accepted-outcome correlation checks pass.

App descriptor preparation rejects unconverted completion history before work
can be admitted or executed. Offline conversion remains explicit and retains
the original receipts. The preparation test verifies rejection without mutation
and successful preparation after conversion. This adds one App-local read check,
with no new table, persisted flag, repair loop or per-claim migration. Archive
readers remain available; this is retirement of runtime authority, not deletion
of historical evidence.

All 218 affected checks pass. The first full CI run had **2,860 passed, 3 skipped
and one failed**: the large-history responsiveness fixture directly activated
unconverted receipts. It now runs the existing offline conversion first and
retains its 4 MB evidence payload and responsiveness assertion. That check
passes, and full CI at `9d819d53` then passes **2,861 tests**, with **3 skipped
and zero failures** (2,864 tests / 289 files; 166.47 seconds). The receipt cleanup
removes **155 net production lines** under the inventory rules below.

## Integration with current main

Host `ff3b852b` incorporates main `49272b5a`, including Telegram #157 and the
release metadata. It preserves the shared persisted-event reader, explicit
reply/Topic context and the upstream human-facing guidance. It also carries
Telegram's active-input coordinates through the actual Task attempt: the
current button uses that attempt's admitted batch, so newly queued input from
another chat cannot move its destination or grant control over another attempt.
The existing public Stop/reopen test now exercises two different chat/thread
origins and passes those assertions. No inbox execution owner is restored.

Full CI at `ff3b852b` passes types, the App boundary and lint, then reports
**2,893 passed, 3 skipped and one failed** (2,897 tests / 291 files; 169.91 seconds).
The upstream Topic-context test still called the retired inbox executor. Host
`682ba127` moves that test onto real Task admission, attempt execution and fenced
reply settlement. It keeps selected and replied-to Topics, oversized journal
input, restart, provider redelivery and foreign/missing-Topic isolation; its 43
assertions pass. The test supplies the judgment, as before; no production change
is needed to retain these guarantees.

Full local CI at `682ba127` passes Host/SDK types, the App boundary and lint:
**2,894 passed, 3 skipped, zero failures** (2,897 tests / 291 files; 134.74 seconds).
GitHub Quality and Container also pass on that exact revision.

The isolated daemon cutover passes again from clean old Host `a8f65188` to clean
candidate `682ba127`. All four observed old processes exit before conversion;
the candidate retains the earlier reply once, answers the original unfinished
input, records measurement **17**, keeps the supervisor closed and executes
fresh input on the same open Task. The report records one Task execution owner,
four scripted provider calls and zero real model calls. The startup precondition
accepts the converted state. The earlier Linux fixture and rollout limits still
apply; the successful live judgment trials retain their original source revisions.

## Current simplification inventory

The [final audit](#critical-path-acceptance-audit) updates the totals after reader
corrections. The inventory below records the preceding checkpoint.

At `682ba127`, compared with current main `49272b5a`, non-test files under `src/`
and `packages/` add **2,880** lines and remove **2,374**: **506 net added lines**.
This excludes tests, fixtures, scripts and Markdown. The three offline cutover
modules account for **517** added lines; ongoing code has **11 net removed lines**.
Migration remains a real review and maintenance cost until it can be retired.
Earlier checkpoints compare against `a8f65188`; counting the newly integrated
Telegram changes against that older base would misattribute upstream work to
the PoC.

| Responsibility | Candidate path and removed authority |
| --- | --- |
| Execute a bounded attempt | `core/tasks/app-task-runtime.ts` claims once and runs the App-selected handler through `runTaskExecutorAttempt`; the independently executing inbox callbacks and `conversations/turn-handler.ts` are gone |
| Accept an outcome and human-facing effects | Fenced Task settlement composes typed message, Request, Topic, delegation and control writes; separate supervisor reply projection and `core/state/conversation-outcomes.ts` are gone |
| Return delegated evidence | Saved return links and exact outcomes wake the caller through durable input; the paired App removes its supervisor declaration, and saved waits do not create supervisory attempts |
| Retry unfinished work | Existing Task backoff and recovery own execution; input coordination retains admission/attachment only, with no model callback or saved execution decision |
| End an assignment | Authorized owner closure is separate from accepted outcomes; both retained mode spellings use the same lifecycle rather than choosing automatic completion or reopening |
| Interpret historical completion | Offline conversion imports accepted attempts and owner closure; runtime receipt matching, duplicate pruning and receipt-based dependency readiness are gone |

Handler-specific context and reply settlement remain necessary: messages,
Topics and Requests have product meaning. They do not introduce another claim,
retry counter or lifetime policy. The ongoing implementation is slightly smaller;
total production code including conversion is still larger. Neither line counts
nor fewer execution owners establish overall maintenance cost or operational reliability.
The real-daemon fixture above now proves old-version cutover for its stated
scope. At this checkpoint, historical reader review and the final audit were still
pending. The [reader review](#historical-reader-review) now resolves those gaps
without adding a framework to eliminate ordinary handler-specific code.

## Verification and cost

Host/SDK types, App-boundary checks and lint pass at the listed checkpoints.
The three skips require separately installed Apps/agents. Historical full-suite
results are retained here; passing focused tests does not clear the migration gate.

| Source checkpoint | Passed / skipped / failed | Tests / files | Seconds | Change in evidence |
| --- | --- | --- | --- | --- |
| `3d3f5a73` | 2,625 / 3 / 130 | 2,758 / 281 | 131.0 | One additional loading error; the stale availability-helper import was fixed in `ca3a5986` |
| `b05340bc` | 2,631 / 3 / 130 | 2,764 / 281 | 145.4 | Loading error gone; self-revision expectation subsequently migrated in `650b019e` |
| `895c75c6` | 2,637 / 3 / 129 | 2,769 / 281 | 130.6 | Conversation settlement checks |
| `6aa80877` | 2,644 / 3 / 129 | 2,776 / 282 | 132.9 | Common runtime; index migration regression fixed |
| `f5d0fab6` | 2,647 / 3 / 129 | 2,779 / 282 | 136.7 | Human ingress and Stop |
| `ebb98a14` | 2,653 / 3 / 129 | 2,785 / 282 | 135.6 | Capacity and pause |
| `86455d13` | 2,655 / 3 / 129 | 2,787 / 282 | 131.2 | Mixed-input selection and reply placement |
| `faba34f7` | 2,660 / 3 / 129 | 2,792 / 282 | 135.8 | Outcome return route |
| `1b43c973` | 2,665 / 3 / 129 | 2,797 / 282 | 136.9 | Owner closure return route |
| `4e040987` | 2,665 / 3 / 129 | 2,797 / 282 | 137.4 | Prior attempt evidence reaches normal execution |
| `03618081` | 2,665 / 3 / 129 | 2,797 / 282 | 139.5 | Continuation prompt; recovery/execution suites pass 38 tests |
| `ef0b9554` | 2,672 / 3 / 128 | 2,803 / 282 | 135.9 | Atomic conversational cancellation; human reads no longer forbid maintenance cancellation |
| `f5b3eafe` | 2,621 / 3 / 185 | 2,809 / 283 | 167.8 | Removes old Conversation execution; offline cutover passes, 57 legacy fixture failures added |
| `24208b00` | 2,634 / 3 / 171 | 2,808 / 283 | 132.3 | Retires supervisor projection; migrates Request, same-App and subscription coverage |
| `75154039` | 2,660 / 3 / 171 | 2,834 / 286 | 137.8 | Integrates current main; 26 additional tests pass, failure entries unchanged |
| `89329ce4` | 2,668 / 3 / 170 | 2,841 / 286 | 149.8 | New human input gets a fresh attempt; seven new checks pass and one old failure resolves |
| `3e61e705` | 2,675 / 3 / 163 | 2,841 / 286 | 139.4 | Conversation execution requires a Task binding; tool-loop and accepted-result contracts migrated |
| `127c3ab2` | 2,701 / 3 / 138 | 2,842 / 286 | 162.6 | Workspace and worker-process checks migrated; retained-effect recovery crosses real processes |
| `55e51193` | 2,784 / 3 / 80 | 2,867 / 289 | 148.0 | Reconciler outcomes and owner closure migrated; intermediate checkpoints are recorded in the sections above |
| `c2b00c29` | 2,834 / 3 / 30 | 2,867 / 289 | 151.82 | Runtime outcomes, input continuation and exact structured-result reads |
| `a9252e96` | 2,837 / 3 / 27 | 2,867 / 289 | 159.50 | Real daemon restart and scheduled workflow checks read accepted attempts on retained Tasks |
| `ae83b416` | 2,853 / 3 / 11 | 2,867 / 288 | 124.99 | Public Stop uses Task attempts; admission checks retain containment and fence revoked ownership |
| `bf402899` | 2,859 / 3 / 0 | 2,862 / 287 | 140.66 | Retires the last independent inbox failure fixtures; retained input, atomic settlement and affordable redo run through the shared lifecycle |
| `d2e1e2dc` | 2,858 / 3 / 1 | 2,862 / 287 | 121.32 | Clean old-to-new daemon cutover passes; full suite exposes premature wall-clock timeout in an existing test helper |
| `2b13943f` | 2,860 / 3 / 0 | 2,863 / 288 | 121.31 | Monotonic polling fixes the demonstrated test-helper deadline fault; all portable checks pass |
| `9d819d53` | 2,861 / 3 / 0 | 2,864 / 289 | 166.47 | Runtime receipt authority removed; old success cannot satisfy a newer assignment; activation requires converted history |
| `ff3b852b` | 2,893 / 3 / 1 | 2,897 / 291 | 169.91 | Current main integrated; one upstream Topic fixture still invokes the retired inbox executor |
| `682ba127` | 2,894 / 3 / 0 | 2,897 / 291 | 134.74 | Topic fixture uses actual Task execution; local/remote CI and clean old-to-new daemon cutover pass |
| `c50f56f4` | 2,896 / 3 / 0 | 2,899 / 291 | 136.97 | Owner closure reads and filters are truthful; closed results remain discoverable without appearing as active work |
| `54c1b5b4` | 2,896 / 3 / 0 | 2,899 / 291 | 130.91 | Clipboard tests use bounded asynchronous subprocesses after a hosted timeout; local CI and both GitHub checks pass |

Failure entries are unchanged from `6aa80877` through `03618081`. The earlier
`650b019e` test follow-up has focused verification, not a separate full-suite
result. Live-model evidence and its limits are recorded in their owning sections.
At `ef0b9554`, no failure entries were added. The obsolete maintenance-cancellation
prohibition is replaced by passing owner-control checks for both retained mode
spellings. All 128 other failures remained unresolved at that checkpoint.

The eleven remaining failures at `ae83b416` are resolved at `bf402899` through
the coverage mapping above. The no-redo and terminal-failure assumptions are
intentionally superseded; retained input, exact effects and accepted evidence
remain required. No tests were skipped to clear this gate.

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
The outcome-route checkpoint adds **130 net production lines** (131 added, one
removed), excluding tests. It adds one capability operation and one bounded
query over existing records. It reuses the Conversation input transaction,
Task controller, source event and optional review timer. The old supervisor
is bypassed for Task-owned Conversations, but its code and declaration still
need retirement; total code reduction is not established.
The closure-route checkpoint adds **67 net production lines** (138 added,
71 removed), excluding tests. It extends the same capability and discovery
query to saved closures, and checks durable cancellation before aborting an
attempt. It adds no table, index, scheduler or model decision. This remains
intermediate code until the old Conversation execution and follow-up paths retire.
The prior-evidence projection adds **55 net production lines** (56 added, one
removed). The recovery prompt adds two net production lines; the separate live
harness and its documentation are experiment cost. No overall code-reduction
claim follows from these local counts.
The human-control checkpoint adds **59 net production lines** (102 added,
43 removed), including removal of the old daemon callback and mode-based
cancellation visibility. It closes a cutover gap; it does not retire the full
legacy execution owner.

Across the full branch, `3037c4b9..ef0b9554` changes non-test files under
`src/` and `packages/` with **924 net added lines**.
This excludes tests, fixtures, scripts and documentation; it is a review-cost
indicator, not a complete complexity measure. The local recovery deletions
below have not yet paid for the whole Conversation integration. Retiring the
old owners and reviewing the resulting path count is an acceptance requirement.

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
