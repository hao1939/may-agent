# Recovery: restore the original work through its responsible owner

**Supports:** [Task recovery](../2a-design/task-resource-engine.md#pause-reload-and-recovery).
**Choice basis:** [Understandable recovery](../1-principles/work-model.md#prefer-understandable-recovery)
and [simple first](../1-principles/core-principles.md#simple-first).

**Design status:** Ownership and the common recovery rule are agreed. This is
the single active recovery adoption proposal, consolidated 2026-11-12.
**Activation, 2026-11-12:** The selected installation accepts App source
`a886e25354`, including Alex's controller-failure correction. The
[activation observation](../archive/reviews/connected-recovery-trial-20261112.md#selected-installation-activation)
was quiet; installed repair judgment and the original caller outcome await a
real failure. Disposable routing and outcome evidence remain distinct.

**Implementation status:** Mechanical recovery, saved-caller feedback and declared
operational routes have source and trial evidence. A disposable connected trial
now carries an unavailable business workflow through real tool repair, ordinary
retry, exact caller return and HTTP-visible fulfillment of the original human
promise; its unresolved contrast preserves that promise. Orderly process restart
at the committed repair handoff and timer recovery of a contended no-work
admission also have evidence. A bounded real-model follow-up now demonstrates
diagnosis, authorized tool repair, original outcome consumption and one human
answer; its missing-authority contrast retains the promise. Earlier failed runs
exposed route ambiguity and duplicate communication, corrected in the trial's
input and existing guidance. A scripted human-reply follow-up now covers real
Telegram receipt correlation, insufficient and stale answers, verified tool
action and the original outcome. A disposable probe of the accepted App release
confirms selected routes and missing generic pre-attempt controller routes.
The corrected Alex source now has an
[independent-process trial](../archive/reviews/connected-recovery-trial-20261112.md#independent-alex-controller-trial)
through real tool repair, original result return and an owned missing-authority
blocker delivered to the caller. It is committed locally, with scripted decisions;
the selected installation now accepts the correction; repair behavior in a real
failure and broader reliability remain unproved.

## The remaining question

**Can an obligation whose owner cannot start reach capable help, return to that
same obligation and produce its promised outcome without manual advancement?**

For example, Scout owes research but cannot prepare its workspace. Its declared
responsible recipient can start independently, repairs the prerequisite and
returns evidence to Scout's original work. Scout verifies the repair, finishes
the research and returns the result. If May owes the human an answer, she
explains that outcome and updates the linked Conversation Request.

Repairing a workspace is an intermediate result. Success means verified progress
to the original assignment's accepted outcome. When repair is unavailable, the
honest result is an owned, actionable blocker with a way to continue.

## Participants and existing authority

| Participant | Responsibility |
| --- | --- |
| Original Task owner | Owns the assignment; uses failure/repair evidence, chooses the next authorized action and verifies its own outcome. Before Task admission, the retained input and its existing caller still carry the obligation. |
| Responsible recipient | Receives help through the saved caller relationship or a declared operational route. Repairs within its capability, chooses another authorized approach, or asks the next responsible agent. Each handoff must add capability, authority or judgment. |
| Host | Executes the declared procedure, retains failure/effect facts, applies existing retry/cleanup rules and delivers through existing relationships. Unaddressed failure facts can be journaled without an accountable recipient; the installation operator owns missing operational declarations. Journal acceptance alone is not delivery to help. |
| Conversation handler / human | The handler preserves and updates the human promise. A human-owned Condition records an actionable ask; the real adapter must present it and return the answer to that exact Condition. |

The [Host/App recovery boundary](../2a-design/system-boundary.md#retry-and-recovery-ownership),
[escalation contract](../2a-design/escalation.md) and
[Task lifecycle](../2a-design/task-resource-engine.md) remain authoritative.
Task, App input/request, Condition and Conversation Request keep their
[current meanings](../2a-design/message-lifecycle.md#task-request-input-and-human-action).
Recovery of current work and engineering improvement of future behavior remain
separate responsibilities; Alex or an evaluator is not a mandatory repair hop.

## Startup boundary: first verified finding

The [November 12 disposable trial](../archive/reviews/recovery-bootstrap-trial-20261112.md)
reproduced a shared dependency: a Task worker imports the accepted App catalog
before selecting its target. When another App's top-level module requires an
unavailable runtime prerequisite, even the independent recipient cannot start.
Keeping that prerequisite inside the business workflow lets the recipient run.
This establishes a startup contrast, not completed recovery or a live incident.

Keep App definitions loadable independently of optional business prerequisites;
check those prerequisites at the owned operation that uses them. Preserve atomic
rejection of invalid new source and the complete accepted routing catalog.
The trial does not justify a partial registry or a separate repair executor.

The controller publishes this pre-attempt failure as **handler.failed** and
schedules a dispatch retry; it produces no attempt reconciliation. The connected
trial must inspect the actual failure producer and its declared recipient rather
than assume an attempt-failure subscription receives every startup failure.
Existing dispatch backoff and attempt exhaustion are different paths.

The [accepted-release route probe](../archive/reviews/connected-recovery-trial-20261112.md#accepted-release-route-probe)
confirms this distinction for May, Alex and Scout: their selected declarations
have no generic controller-failure recipient. Alex's selector attempt failures
join one recovery Task; ordinary exhaustion either produces no input with
automatic review disabled or creates an evaluation workflow with it enabled.
An evaluation route does not establish operational repair. A working-tree route
change is separate from the accepted release and still needs capable-recipient
and original-return verification. Keep that correction in App policy; do not
add a Host fallback or route every repeated failure into new work.

**Source correction, now activated in the selected installation:** the reviewed Alex route accepted
controller failures only when `willRetry` was false. In the checked Host source,
`AppTaskController.recordFailure` sets `willRetry = !this.closed`; an active
controller keeps retrying with capped backoff. The App correction removes that
filter and preserves retry status as evidence for Alex. A
[production-controller regression](../archive/reviews/connected-recovery-trial-20261112.md#controller-failure-policy-correction)
now carries repeated pre-attempt failures into one investigation, actual tool
repair, normal retry and the original caller result. It uses scripted agent
decisions and the real Alex declaration in disposable state. The
[independent-process extension](../archive/reviews/connected-recovery-trial-20261112.md#independent-alex-controller-trial)
now verifies separate recipient startup, exact original return and honest blocker
delivery for an operation-specific prerequisite failure. No new Host exhaustion
rule was added; selected installation activation is recorded separately.

## Connected trial: established mechanics

The [connected November 12 trial](../archive/reviews/connected-recovery-trial-20261112.md)
submits one human ask through HTTP/control ingress. With loadable App declarations
and an unavailable workflow-local prerequisite, an ordinary operational recipient
uses its real tool to restore access. A request returns to the same worker Task;
normal backoff, verified original work and saved caller delivery carry the answer
back to the Conversation handler. The handler publishes the answer and fulfills
the original promise. The harness never advances recovery between these steps.

When repair is unavailable, the original Task exhausts its allowance without
fulfilling the request. The caller explains the blocker and retains its promise;
the same repair Task consumes exhaustion and retains its responsible owner,
requested action and future review. Scripted decisions establish these mechanics,
not autonomous diagnosis, long-term quiet behavior or installed adoption.

The extended trial restarts the fixture Host process after the repair request
and wait are committed. A fresh PID and registry preserve the Task generation,
failure allowance, retry deadline, exact requests and open promise; ordinary
startup completes the original return without repeating the repair command.
It also reproduces a no-work `session.end` admission failure under a real WAL
write lock. Once released, the default recovery timer clears the original
journal marker without manual delivery or new work. These are bounded contrasts,
not abrupt-crash or arbitrary admission-recovery guarantees.

## One connected acceptance scenario

Use one disposable environment and a real supported runner. Choose an original
human ask so its Conversation Request and caller delivery are included. Admit
it once, then let normal failure publication, declared admission, owner wakes,
requests/returns and retry carry the work. Retain the exact source revisions and
installation declarations used.

| Step | Evidence required |
| --- | --- |
| 1. Original owner cannot start | Inject a prerequisite or App/module-loading failure before its business procedure can run. Retain the original Task/input, failed operation, diagnostic evidence, known/uncertain effects and prior actions. |
| 2. Failure reaches executable help | The saved caller or declared operational recipient actually receives the blocker and starts despite the failed optional prerequisite. For a route without a usable caller, retain an explicit return to the original Task/input. Event persistence alone is not delivery. |
| 3. Recipient acts | Through ordinary tools and existing authority, it performs the repair and returns usable evidence, or retains an actionable blocker and the next responsible owner. Routing does bounded selection/admission; diagnosis and repair run as ordinary owned work. |
| 4. Original work resumes | The exact original obligation receives the return. Its owner verifies current facts and continues under existing policy. Before exhaustion, normal retry may suffice; after exhaustion, use an explicit authorized decision. Repair does not silently renew the original allowance. |
| 5. Original outcome is consumed | The original assignment reaches its accepted outcome and its caller receives it. The Conversation handler explains the result to the human and fulfills, revises or closes the linked promise for its actual scope. |

The harness may arrange the failure and record observations. It must not restore
the prerequisite, advance the controller, synthesize success/failure wakes or
manually deliver the return between steps. Keep the first missing fact, route,
wake or decision as the finding, and fix that owning boundary.

Provide exact declared destinations in callable context or business input;
role names alone can be ambiguous. A real-model trial selected its own App
instead of the verifier and settled into an ineffective wait. Making the
verifier's `appId` explicit corrected that trial without a routing heuristic.
Consumption also includes communication effects: after sending the answer with
`attempt.apply`, record it in the final summary and omit the message-sending
`response` shorthand. See the [communication contract](../2a-design/conversation-execution.md)
and [real-model evidence](../archive/reviews/connected-recovery-trial-20261112.md#real-model-follow-up).

Run the same chain with repair unavailable. It must leave the original work and
independent obligations intact, with an owned blocker, a declared next wake or
explicit operator action, and no false completion. If human action is chosen,
exercise the actual adapter, exact Condition reply and subsequent resumption.
A saved help request alone does not demonstrate presentation or an answer.

## Contrasts within that scenario

Use existing fixtures for these boundaries; they are variations of the same
acceptance scenario, not separate recovery projects.

- **Before Task admission:** retain the owed original input and its rejection,
  route usable help through the existing caller, then retry admission. There is
  no destination Task to invent or mark complete.
- **No usable caller:** exercise the declared operational route and addressed
  return. A correlation label in free-form data is not a working return path.
- **Restart at a handoff:** reread the same open ask or saved repair result.
  Preserve accepted work, independent Conditions and effect identities; disclose
  missing history. Uncertain external effects require reconciliation, not blind
  repetition.
- **Repeated unchanged failure:** replay notices and ordinary ticks, including
  restart. Reuse open help and settle into quiet waiting; measure model calls.
  The first useful escalation and exhaustion decision must still arrive.
  Changed evidence or a human reply must reach its exact owner.
- **Execution still alive:** preserve the old claim until owner and descendant
  cleanup is confirmed. Optional history can be incomplete; uncertainty about
  live execution cannot authorize replacement.
- **Controls during recovery:** acknowledgement, reads and cancellation remain
  usable. A current performance failure belongs to the existing runtime/query
  owner and the [Host follow-up](host-contract-improvements-20261016.md#query-cost-and-control-responsiveness).

Existing operation retries, deadlines, request identities and Conditions supply
the bounds. Occasional duplicate consideration and affordable repeated
uncommitted work are acceptable. Persistent unchanged model loops are not.
No universal retry counter or distributed recovery budget is proposed.

## Existing evidence and its limits

| Record | What it establishes / what remains |
| --- | --- |
| [Recovery mechanism review](../archive/reviews/recovery-mechanism-20261017.md) | Distinguishes existing mechanics, synthetic cases and dated live observations; it did not establish a current live recovery stall. |
| [Saved-caller worker trial](../archive/reviews/hierarchical-recovery-trial-20261017.md#real-worker-workspace-trial) | Real subprocesses load App definitions and repair missing Git setup through actual tools; the provider's repair choices are scripted. |
| [Operational route without a caller](../archive/reviews/hierarchical-recovery-trial-20261017.md#operational-route-without-a-caller) | Exhaustion, declared admission, addressed repair return and explicit retry complete the original Task. Installed coverage and autonomous diagnosis are separate. |
| [Live recovery example](../archive/reviews/hierarchical-recovery-trial-20261017.md#live-recovery-example) | Real agent diagnosis, engineering repair and return through the hierarchy; the original owner could start. |
| [Host #381 evidence](../archive/reviews/hierarchical-recovery-trial-20261017.md#381-merge-record) | Merged incomplete-history recovery with retained authority and cleanup checks; it does not prove route adoption or the human loop. |
| [Connected workflow recovery](../archive/reviews/connected-recovery-trial-20261112.md) | Real HTTP/control ingress, worker processes, tool repair, scheduled retry, exact caller return and original Conversation fulfillment; unresolved/exhausted, orderly committed-handoff restart and normal-timer contention contrasts. The real-model follow-up covers diagnosis and missing authority with explicit fixture routing. |
| [Human-reply and accepted-release follow-up](../archive/reviews/connected-recovery-trial-20261112.md#human-reply-follow-up) | Scripted judgment through the production Telegram adapter consumes insufficient, stale and current replies, verifies a real tool effect and fulfills the original promise. The accepted-release route probe proves selected routing/admission and records missing controller routes; it deliberately does not execute the installation's business work. |
| [Earlier detailed plan](../archive/reviews/unified-agent-recovery-20261017.md), [execution evidence](../archive/reviews/recovery-from-execution-evidence-20260922.md) and [oversight findings](../archive/reviews/reliable-recovery-and-independent-oversight-20261002.md) | Preserve historical failures, trials, limits and discarded ordering. Remaining recovery work is consolidated here. |

## Next step and completion

The connected scenario, unresolved contrast, committed-handoff process restart
and no-work admission timer recovery now have mechanical evidence. No new Host
recovery mechanism was needed. The bounded real-model follow-up now covers
diagnosis when the original procedure cannot start, using an explicit disposable
route and representative instructions. It required 19 provider calls for repair
and 22 for the missing-authority contrast, including reads and corrected tool
errors; it does not establish low cost or dependable behavior across workloads.
The human-reply boundary now has mechanical evidence, including stale and
insufficient answers. The accepted-release probe identifies the next adoption
gap: selected pre-attempt controller failures lack a declared capable recipient.
The App-owned correction is committed on local `main` and now has both an
actual-controller regression and an independent-process trial through tool repair,
the original result and delivered missing-authority feedback. Release it through
the normal App path, then verify the selected installation before claiming
adoption. Scripted outcome evidence does not establish model judgment or quietness
under prolonged unchanged failure notices. Retain the startup catalog contrast:
a recipient that shares the failed prerequisite cannot repair it.
Record original/repair invocations, available usage, repeated wakes, time to
useful progress, human intervention and exact caller outcomes.

A failing boundary justifies a focused correction followed by the same trial.
A passing trial justifies adoption only for the demonstrated installation and
route. Essential storage, runner or all usable model access can still require
external supervision or an operator.

Use ordinary Tasks, inputs, calls/returns and Conditions throughout. No new
recovery service, fallback controller, Task type, lifecycle state, incident
registry or automatic executor substitution is proposed. Update current contracts
and guides only for behavior established by implementation; archive the trial
evidence and keep any remaining limitation explicit.
