# Hierarchical recovery: restore useful work through the responsible owner

**Supports:** [Task recovery](../2a-design/task-resource-engine.md#pause-reload-and-recovery). Lets unfinished work resume with less human rescue and acceptable cost.

**Choice basis:** [Understandable recovery](../1-principles/work-model.md#prefer-understandable-recovery), [simple first](../1-principles/core-principles.md#simple-first), and [recovery ownership](../2a-design/system-boundary.md#retry-and-recovery-ownership): agents judge; infra executes their decisions and records what happened.

**Design status:** Hierarchical ownership agreed in review, 2026-10-17; implementation gaps and trials below remain proposed.
**Implementation status:** Mechanical recovery, caller feedback and addressed escalation exist. A live incident demonstrates agent correction, Alex-to-May repair, restart continuation and result return. A scripted trial now demonstrates repair of a worker's Git setup through its saved caller with real worker subprocesses, ordinary App loading and agent tools. A second subprocess trial demonstrates a declared operational route without a caller, addressed repair return and explicit retry after exhaustion. Installed route coverage, isolation from broken App/module bootstrap, autonomous diagnosis of a startup failure, and the complete human escalation loop remain unproven. This document changes no runtime behavior.

**Host foundation:** [#381](https://github.com/hao1939/may-agent/pull/381) merged
on 2026-10-17, supplying recovery with incomplete execution history. Deployment
is not established by the [merge record](../archive/reviews/hierarchical-recovery-trial-20261017.md#381-merge-record). The connected caller and operational-route trials now demonstrate failure
delivery, executable help and return to the original assignment for failed Git
setup. Remaining work tests other startup failures and adopts the declared App
routes. Evaluate these together as one recovery mechanism.

An [App-path check](../archive/reviews/hierarchical-recovery-trial-20261017.md#existing-alex-recovery-path)
found a concrete omission in the existing Alex routes: they handled `retrying`
and `incomplete` but dropped `exhausted`. The source correction sends that final
fact through the same owner/review paths. A real-selector fixture also confirms
that repairing before exhaustion lets Host resume automatically. This is a
delivery correction, not a new escalation rule, mandatory manual retry or
evidence that agents need more instructions. Live activation remains separate.

## Recommendation

**Every Task needs a usable recovery and escalation path. Give its owner the
opportunity to recover within its capabilities and bounds; when it cannot,
deliver the blocker to the next responsible agent. Preserve the original work
so it can resume.**

Follow the existing [escalation contract](../2a-design/escalation.md). Every App
does not need system-repair tools, permissions or expertise. The Task owner
still handles its blocker: repairing locally, choosing another approach or
asking for help are all valid decisions. Owner first means first opportunity,
not mandatory unsuccessful attempts.

For example, Scout cannot prepare its Git workspace. Infra performs supported
mechanical recovery. If Scout cannot start, the declared operational route
delivers the failure to its next responsible agent. May can repair the setup or
request engineering help from Alex. Repair evidence returns to the original
work, which resumes through ordinary execution. Scout still owes the research;
restoring the workspace does not fulfill that assignment.

Recovery must restore verified progress on the original work. If it cannot,
retain an actionable blocker with an accountable owner and a way to continue;
report the work as unresolved. A repair Task finishing is an intermediate
result. The original assignment still needs its own accepted outcome. When May
owes the human a response, she also explains the outcome and updates the linked
Conversation Request.

## One rule through the existing mechanisms

1. **Code handles known work.** Infra retries safe repetition within the
   operation's existing policy. Record the first failure without requiring a
   model call. Known errors that unchanged retries cannot fix go directly to
   judgment; do not spend a retry allowance replaying invalid input.
2. **The owner decides.** Give a running agent feedback in its current
   invocation. Supply the original operation/input, error, useful partial
   evidence, known or uncertain effects, and previous actions. The App workflow
   owns its ordinary agent call when code cannot proceed.
3. **Escalate when local recovery cannot help.** Use the declared responsibility
   relationship and ordinary addressed requests/returns. A helper returns to its
   caller; a Task owner can ask its App owner, then May, then the human where
   needed. Skip a role already held by the same agent. Each handoff should add
   capability, authority or judgment; Alex or a reviewer is not a mandatory hop.
4. **Return help and continue the original assignment.** A repair contribution
   follows the same acceptance and effect rules as ordinary work. The original
   owner judges how it changes the assignment and continues, waits or requests
   further help. Independent work and Conditions can coexist. A repair report,
   valid JSON result or admitted request alone does not prove recovery.
5. **Keep unsuccessful repetition bounded and visible.** Use existing execution
   deadlines, retry controls, request identities, Conditions and metrics. Retain
   the blocker and needed decision when automatic recovery is exhausted. Passing
   the failure upward does not silently renew the original operation's retries.

The Host supplies execution and delivery. It does not diagnose a failure,
choose a model or silently replace an App's declared executor. A running agent
chooses escalation; when execution never starts, delivery follows an already
declared caller/operational route. Before destination admission, responsibility
remains with the existing caller. Rejected input does not create a destination
Task or authorize Host to invent one.

## Close the loop with existing Tasks, inputs and Conditions

Use the [current terms](../2a-design/message-lifecycle.md#task-request-input-and-human-action):
the **Task** owns scoped work and context; an **App input/request** carries an
ask and its caller/result link; a **Condition** records a needed fact. A
**Conversation Request** is May's promise to the human. A **human-owned
Condition** asks for something from the human. "Ask for help" is an action using
these resources; recovery needs no additional kind of Task or Request.

The following is the intended integration through
[event admission](../2a-design/events.md) and the
[escalation contract](../2a-design/escalation.md). Coverage still needs the trials
below; existing event names alone do not establish that the loop works.

| Handoff | Existing path and required behavior |
| --- | --- |
| Failure during an invocation | Return tool/execution feedback to the active owner. It can repair, change approach or ask for help in that invocation. |
| Admitted work fails and has a usable caller | Preserve the saved request relationship and its `app.dependency.updated` feedback. The caller judges the blocker; do not commission a parallel repair from every failure event. |
| The owner cannot start and no caller can handle the failure | A declared operational subscription maps the applicable failure fact, including uncovered `handler.failed` cases, through pure `toInput` into ordinary durable App admission. Its recipient must be able to execute. |
| Help requires separate durable work | Submit a bounded ordinary Task contribution through the declared App input. Retain its admitted request identity; add the exact request Condition when its answer is needed. Local help can stay in the current invocation. |
| Help returns | Apply the accepted contribution through the saved caller/result link. For an event-originated repair, explicitly address the original Task with the repair evidence through supported App input; the event subscription does not create a caller link automatically. |
| Human help is required | May retains the source reference, creates/reuses an exact human-owned Condition and presents the actionable ask through the Conversation. The reply satisfies that exact need and returns through the same chain. |
| Original work continues | The original owner rereads current facts, verifies the repair and continues within existing authority and retry policy. If admission failed before a Task existed, recover the retained original input through admission first. |
| The human is owed an outcome | The Conversation handler explains the original assignment's result and fulfills, revises or closes its linked Conversation Request as appropriate. Pending human help keeps the promise open; fixing a prerequisite does not fulfill it. |

Each handoff must retain the original App/Task or pending input, failed
operation, available error/effect evidence, previous actions, relevant limits
and the exact return reference. Keep those facts in existing Task/input/request
records with compact evidence links. A transcript copy, parent Task ID or
`correlationKey` in free-form data cannot substitute for a working return path.

Routing does bounded selection and admission. It does not diagnose the error,
call a model or perform repairs on the event publication stack. A recorded
event, admitted input, running recipient, returned repair and resumed original
Task are distinct observations; check each one. If a caller is unusable, the
declared next route must handle that failure without sending the same blocker
back and forth. Missing routes remain visible and owned by the installation's
operator; do not claim that an undelivered failure has been escalated.

For the Scout example, a retained failure reaches May's declared operational
input. May repairs it or asks Alex for a bounded engineering contribution.
The result returns to Scout's original Task; Scout verifies workspace access,
finishes the research and returns that result to its caller. If credentials
require human action, May asks once on an exact Condition and continues after
the answer. Alex owns engineering improvement; Evaluator can assess evidence
and outcomes without becoming a mandatory repair coordinator.

## What works and what needs proof

The [source and runtime review](../archive/reviews/recovery-mechanism-20261017.md)
distinguishes existing behavior, synthetic cases and dated live observations.

| Finding | Smallest useful next step |
| --- | --- |
| Restart recovery and feedback inside an invocation already produce useful continuation. | Preserve these paths; avoid a second recovery lifecycle. |
| Live alert 4987 followed Evaluator → Alex → May → Alex, including a repair PR, deployment interruption and fresh verification. | Preserve this ordinary request/Condition loop; do not present all agent repair judgment as unproven. It does not test an owner unable to start. |
| Admitted Task failures and exhaustion already return through saved caller relationships, including after delivery failure/restart. | Reuse them. Missing `handler.failed` subscriptions do not imply all failure feedback is absent. |
| The reviewed installation has no selected `handler.failed` subscription. A subprocess fixture now routes exhausted workspace failures into an ordinary repair Task. | App owners must declare and adopt the relevant routes; the fixture does not install them or prove pre-admission/controller failure recovery. |
| Real worker subprocesses load the saved caller and repair a missing worker Git branch through ordinary tools. | Keep ordinary execution with independently usable prerequisites. Separately test whether a broken App/module bootstrap blocks other recipients. |
| Execution failures default to three consecutive failures; controller/admission retries use capped delays without a count limit. | Measure actual repeated work and model cost. Extend the owning retry policy only where needed; do not add a competing controller. |
| The scripted Git-setup trial demonstrates recipient startup, repair and original-work completion; the live incident demonstrates repair judgment after successful startup. | Test real judgment when the original owner cannot start; scripted provider choices do not prove diagnosis. |

The runtime review did not establish a current live recovery stall. The benefit
of each Host change must come from the contract and a reproduced gap, not from
assuming every failure boundary needs replacement.

The subsequent [hierarchical trial](../archive/reviews/hierarchical-recovery-trial-20261017.md)
demonstrates the saved caller path, actual tool-driven repair and automatic
original-work continuation without a Host change. Its negative cases retain
exhausted work and show that no caller/declared route means no agent receives
the blocker. The [subprocess follow-up](../archive/reviews/hierarchical-recovery-trial-20261017.md#real-worker-workspace-trial)
closes the process/loading gap for this Git failure: ordinary workers load
on-disk definitions, the caller repairs through its actual tool, and the same
worker Task completes after the default retry delay. The unresolved contrast
retains both asks and an operator Condition. App/module bootstrap failure and
real-agent diagnosis of the setup failure remain separate proof requirements.

The [operational-route follow-up](../archive/reviews/hierarchical-recovery-trial-20261017.md#operational-route-without-a-caller)
starts the worker directly, waits for exhaustion, and admits a repair Task
through a declared subscription. Its agent repairs setup, submits addressed
input to the original Task and requests explicit retry through the existing
control command. The original result returns through that new request; original
work retains its identity and assignment. Without repair, both asks remain open
with an operator Condition. This establishes the connected mechanical path, not
installed coverage or autonomous diagnosis.

The [live incident readback](../archive/reviews/hierarchical-recovery-trial-20261017.md#live-recovery-example)
independently supports real-agent diagnosis and return through the existing
hierarchy. It starts with a usable owner; diagnosis when that owner cannot
start remains scripted, even in the subprocess trial.

## Responsibility and execution availability

| Host owns | App and agents own |
| --- | --- |
| Failure facts and delivery through retained caller or declared operational routes | Meaning, local repair, alternative method and escalation decisions |
| The normal runner, tools, authority checks, capacity and cleanup | Recovery expertise, permitted procedures and selection of useful help |
| Existing retry/deadline controls and quiet observation | A meaningful wait, a justified bounded recovery action or request for more authority |
| Exact request/return relationships and truthful records | Acceptance of repair evidence and progress toward the original assignment |

This requires both Host and App work. **#381 belongs to the Host**: it restores
an ordinary attempt from retained Task authority and available history after
cleanup. **The declared recipients, repair decisions, waits and human
follow-through belong to Apps.** Shared delivery, return and startup support
belong to the Host; change those boundaries only where the common path is
missing. These responsibilities apply across failure types, without a Host
branch for each error or a special repair executor.

The escalation contract owns the hierarchy; installation/App declarations name
its recipients. Host source contains no named May/Alex behavior or per-error
agent selector. If delivery has no usable route, expose that gap rather than
claiming escalation happened. A missing recipient must not create unowned work.

At least one recipient on the configured path must be able to execute despite
the failed optional setup. First try the ordinary runner with its existing
workspace options. If App bootstrap or workflow loading prevents that, separate
the unnecessary startup dependency at its owning boundary. Use an accepted
agent definition and the same execution/authority contract. Add only a missing
primitive demonstrated by the trial, not another agent service or Host strategy
switch. Independent startup for every App is not required.

If essential storage, the runner or all usable model access is unavailable,
external supervision or an operator may be necessary. Do not create a second
database or recursively invoke more agents to simulate availability. No
conflicting replacement starts before old execution and helper cleanup are
confirmed; requesting cancellation is not confirmation.

## Cost and recovery limits

Keep the operation's existing bounded retries and each invocation's deadline.
Helpers in that invocation share its existing scope. Separate durable repair
work has its own explicit bounded assignment and returns to the original Task;
preserve the original failure reference, prior actions and available cost
evidence. A new Task, report, generation or restart is not proof of progress and
must not mechanically renew the failed operation's allowance.

The responsible agent can choose a different bounded repair or request explicit
retry through existing authorized controls. The worker's repair result alone
does not grant new authority or change the assigning owner's allowance. Keep
unchanged escalation requests rather than commissioning the same repair again.
The meaning of a hard budget and its renewal stays with its owning contract.

A known outage can become a wait early. Paced availability checks may continue
without model calls; changed facts return through the existing observation and
request paths. Exhausted work needs an authorized decision before another work
attempt. Ordinary ticks and unchanged observations cannot supply that decision.

Retaining one repair Task is necessary but does not by itself prevent token
waste. Repeated failure notices can still append inputs and wake that same
Task. The route and its owning workflow must reuse the open ask and record or
coalesce unchanged observations without commissioning another model judgment.
New actionable input, changed repair evidence, a human answer or an explicitly
chosen review deadline can justify another judgment. A timestamp, repeated
error report or fresh request ID alone cannot. The first useful escalation and
an exhaustion decision must remain deliverable; quiet waiting must not swallow
them or suppress independent work.

This is a requirement to stop persistent loops, not an exactly-once judgment
guarantee. At-least-once delivery or missing recent history can cause an
occasional duplicate consideration. Accept that cost when the work returns to
quiet waiting or useful progress; do not add a second receipt system to prevent
every duplicate. The workflow decides whether evidence changes the work; infra
applies the declared wake and retry policy without diagnosing its meaning.

After restart, reread retained work, asks, replies and Conditions before acting.
Continue an open repair or apply its saved result rather than issuing the same
ask again. When history is missing, disclose the gap and reconstruct enough
current facts to proceed. Affordable repeated consideration is acceptable;
unchanged model wakeups without useful work are not the recovery strategy.

This version introduces no universal three-cycle counter or distributed cost
ledger across the hierarchy. Measure total repair/resumption usage through
existing evidence first. If a reproduced loop evades current controls, extend
the owning policy and test that loop. At-least-once consideration, affordable
redo and lost recent history/accounting after a crash are acceptable. Exact
crash accounting and eliminating every duplicate handoff are not requirements.

## Implementation sequence and #381

Deliver the common rule across these boundaries. The trials exercise varied
failures against that rule; they are not a list of independent error-specific
repair handlers.

1. **Host recovery foundation merged in #381.** The
   [common recovery rule](../2a-design/runtime.md#recovery) now has source and
   portable startup coverage: retained Task ownership, confirmed cleanup, then
   ordinary continuation with available evidence. Verify the installed revision
   and behavior during an authorized rollout; merging is not deployment proof.
2. **Connect failure to capable help and back.** Use saved caller feedback
   first. Complete declared operational routes for work without a usable
   caller, including failures before admission/execution. Retain original
   references and demonstrate the explicit return for event-originated help.
   The real-worker Git trials establish both the saved-caller path and a
   declared operational route with explicit return and retry after exhaustion.
   The real-App check first repairs the dropped exhaustion notice in Alex's
   existing routes; earlier repair already resumes through Host backoff. Continue
   tracing the existing paths through pre-admission/controller failure and
   App/module bootstrap before proposing additional routes or capabilities.
   Remove a blocking shared startup dependency only
   if reproduced; keep judgment and engineering ownership in Apps.
3. **Complete quiet waiting and human follow-through.** Reuse an open ask and
   its Conditions, suppress unchanged model work, apply repair/human replies
   to the original assignment and retain exhausted work for an authorized
   decision. Exercise restart at the handoffs. Close the human-facing promise
   only with an explained outcome for its actual scope.
4. **Validate and adopt the connected mechanism.** Run the boundary cases
   below, then a bounded real-agent trial. Record source revisions and actual
   installed Host/App artifacts separately. Update the owning event,
   escalation, Task recovery and Conversation contracts/manual only for
   behavior established by implementation; retain remaining gaps explicitly.

#381 merged independently of the remaining work. Its checks establish the
incomplete-history/cleanup boundary, not failure routing, recipient startup,
human delivery or original-work completion through the hierarchy. The connected
trial can use existing recovery meanwhile; final adoption must check the Host
and App versions together.

#381 addresses synthetic incomplete-history cases, not a demonstrated live
outage. Its value is allowing affordable reconstruction with surviving intent.
If that requires substantial new machinery, reconsider the tradeoff. No storage
migration or new repair result schema is required.

**Source status:** #381 is merged; deployment remains unverified by this review.
The enduring rules belong to the [runtime recovery contract](../2a-design/runtime.md#recovery).
Review findings, reproduced failures, exact source revision and validation are
retained in the [trial evidence](../archive/reviews/hierarchical-recovery-trial-20261017.md#381-merge-record).

## Decisive trials

| Case | Required evidence |
| --- | --- |
| Ordinary tool error | The active owner handles feedback without a duplicate recovery invocation. |
| Incomplete-history recovery (#381) | Missing, unreadable or partially recorded metadata use the same retained Task authority and cleanup checks. Startup and claim recovery reach an accepted result with gaps disclosed and surviving bytes preserved. |
| Surviving result and repeated startup (#381) | Running metadata with a saved result and missing transcript retains the result and its descriptor, including through normal event persistence. A later startup with persisted SQL and damaged metadata settles stopped execution without inventing an outcome or blocking useful continuation. |
| Readable ownership conflict in damaged metadata (#381) | Recovery rejects the conflicting identity before cancellation or drain; unrelated metadata damage does not conceal it. |
| Startup admission and lifecycle validation (#381) | Actual startup preserves conflicting terminal-session descendants and markers, with or without the SQL projection, including a copied binding naming another real retained attempt. Verified helpers and prior workflow steps still clean up without taking ownership of the Task. Object-valued optional lifecycle fields cannot crash startup or enter SQL. Original work continues with damaged history and saved results preserved; inherited helper scope does not substitute for ownership. |
| Live execution or helper cleanup pending (#381) | Run the real startup entry point with delayed Task recovery and a live owner process. Preserve its claim and markers despite missing or terminal history. After the owner exits and retained descendants drain, ordinary recovery continues without replacing saved results. |
| Reused detached PID (#381) | An exited process marker is not overridden by its saved PID. With surviving legacy timing, startup and later Task recovery both continue after marker removal. Missing/unreadable markers still preserve genuinely live detached workers. |
| Owner cannot start because Git setup or workflow loading fails | A declared escalation recipient receives the original reference/error, starts through real runner/workspace setup, performs a repair, and the original Task resumes to a useful result. |
| No usable caller; help begins from a failure event | The declared route admits executable work and retains an explicit return to the original Task/input. Repair evidence reaches that work; no assumed caller link or duplicate parallel repair. |
| Original admission fails before Task creation | Retain the original input and route failure, deliver actionable help through a usable declared route, then retry admission and finish the original ask. No fabricated destination Task. |
| Owner lacks repair capability | It asks the next responsible agent without spending mandatory failed attempts; the return reaches the original assignment. |
| Recipient cannot help or failure repeats | Existing bounds and escalation leave a visible blocker and needed decision; unchanged notices do not repeatedly commission repair. |
| Human action is required | An actionable ask is presented through the real human adapter; its reply reaches the exact Condition, returns through May and resumes the source work. May explains the outcome and updates the associated Conversation Request. |
| Restart during admission, pending help or after repair return | Retained input/request/result identifies the same original work. Recovery reuses open help or applies its saved result; it discloses missing history, respects cleanup and does not silently renew exhausted retries. |
| Duplicate notices and an unchanged blocker | Measure model invocations while replaying notices and running ordinary recovery ticks, including restart. Occasional duplicate consideration is acceptable; unchanged state must settle into quiet waiting instead of sustaining model calls. A changed fact or human answer still reaches its exact owner. |
| Shared prerequisite returns | Quiet checks/returns make retained work eligible under its existing policy; original owners verify their own outcomes. |

Use disposable environments for injected failures. A scripted agent can prove
delivery, repair effects and resumption mechanics; it cannot prove autonomous
diagnosis. The fixture must perform the repair through the actual agent/tool
path, not silently restore the prerequisite after a notification. A bounded
real-model trial is still needed for diagnosis when the original owner's setup
cannot start. Keep its evidence separate from the established live incident,
portable checks and a full worker/bootstrap trial.

Record original/repair invocations, available total usage, time to useful
progress, repeated wakes and human intervention for successful and unresolved
cases. Keep successful restart, wait and cleanup regressions. Quiet queues or
accepted diagnostic reports alone are not the success criterion.
