# Recovery against the continuing-Task design

**Status:** Source investigation, September 11, 2026. The common-lifecycle PoC
remains incomplete and unmerged. This review applies the
[accepted proposal](conversation-input-unification.md#recovery-keeps-the-same-task)
to PRs #153, #154 and #155; it does not merge or deploy them.
The current review artifact is [draft Host PR #158](https://github.com/hao1939/may-agent/pull/158).

**Current assessment:** Focused lifecycle and managed-model recovery checks
support the design. The source now removes the old Conversation executor and
supervisor reply path; the paired App candidate removes its supervisor declaration.
Adoption remains unproved: retained work still needs cutover and full CI at
`26dce52f` has 138 unresolved failures. New human input now permits a fresh attempt
without resetting failure counts; source responsiveness checks pass below.
Receipt and open-state conversion now have old-source import evidence below;
mixed ordinary/Conversation input and supervisor retirement also pass source
cutover and runtime checks.
The branch adds 632 net production lines against baseline main `a8f65188`
(counting `src/` and `packages/`, excluding tests, fixtures and Markdown). Finish cutover and examine those
failures before expanding the design.
The latest live evidence is
[below](#managed-conversation-recovery).

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
[`task-state-cutover.ts`](../../../may-agent/scripts/poc/task-state-cutover.ts)
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
[`task-state-cutover.ts`](../../../may-agent/scripts/poc/task-state-cutover.ts)
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

Failure entries are unchanged from `6aa80877` through `03618081`. The earlier
`650b019e` test follow-up has focused verification, not a separate full-suite
result. Live-model evidence and its limits are recorded in their owning sections.
At `ef0b9554`, no failure entries were added. The obsolete maintenance-cancellation
prohibition is replaced by passing owner-control checks for both retained mode
spellings. All 128 other failures remain unresolved.

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
