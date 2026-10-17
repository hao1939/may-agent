# Hierarchical recovery: restore useful work through the responsible owner

**Supports:** [Task recovery](../2a-design/task-resource-engine.md#pause-reload-and-recovery). Lets unfinished work resume with less human rescue and acceptable cost.

**Choice basis:** [Understandable recovery](../1-principles/work-model.md#prefer-understandable-recovery), [simple first](../1-principles/core-principles.md#simple-first), and [recovery ownership](../2a-design/system-boundary.md#retry-and-recovery-ownership): agents judge; infra executes their decisions and records what happened.

**Design status:** Hierarchical ownership agreed in review, 2026-10-17; implementation gaps and trials below remain proposed.
**Implementation status:** Mechanical recovery, caller feedback and addressed escalation exist. A scripted trial now demonstrates repair through a saved caller with real Git workspaces. Universal failure delivery, independent worker bootstrap and autonomous repair judgment remain unproven. This document changes no runtime behavior.

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

## What works and what needs proof

The [source and runtime review](../archive/reviews/recovery-mechanism-20261017.md)
distinguishes existing behavior, synthetic cases and dated live observations.

| Finding | Smallest useful next step |
| --- | --- |
| Restart recovery and feedback inside an invocation already produce useful continuation. | Preserve these paths; avoid a second recovery lifecycle. |
| Admitted Task failures and exhaustion already return through saved caller relationships, including after delivery failure/restart. | Reuse them. Missing `handler.failed` subscriptions do not imply all failure feedback is absent. |
| Controller failure emits `handler.failed`; installed Alex, May and Scout have selected routes but no subscription for this event. | Exercise the uncovered controller path with an explicit App-owned route; inspect both admission and executable handling. |
| A normal repair Task may require the same Git preparation or App bootstrap that failed. | Test the designated recipient's prerequisites with real workspace configuration; do not require every owner to have a separate repair environment. |
| Execution failures default to three consecutive failures; controller/admission retries use capped delays without a count limit. | Measure actual repeated work and model cost. Extend the owning retry policy only where needed; do not add a competing controller. |
| Existing connected tests demonstrate failure consideration, not autonomous repair followed by original-work completion. | Have the fixture agent perform the repair and verify the original result; separately test real judgment. |

The runtime review did not establish a current live recovery stall. The benefit
of each Host change must come from the contract and a reproduced gap, not from
assuming every failure boundary needs replacement.

The subsequent [hierarchical trial](../archive/reviews/hierarchical-recovery-trial-20261017.md)
demonstrates the saved caller path, actual tool-driven repair and automatic
original-work continuation without a Host change. Its negative cases retain
exhausted work and show that no caller/declared route means no agent receives
the blocker. These are scripted in-process fixtures; full worker bootstrap and
autonomous diagnosis remain separate proof requirements.

## Responsibility and execution availability

| Host owns | App and agents own |
| --- | --- |
| Failure facts and delivery through retained caller or declared operational routes | Meaning, local repair, alternative method and escalation decisions |
| The normal runner, tools, authority checks, capacity and cleanup | Recovery expertise, permitted procedures and selection of useful help |
| Existing retry/deadline controls and quiet observation | A meaningful wait, a justified bounded recovery action or request for more authority |
| Exact request/return relationships and truthful records | Acceptance of repair evidence and progress toward the original assignment |

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

This version introduces no universal three-cycle counter or distributed cost
ledger across the hierarchy. Measure total repair/resumption usage through
existing evidence first. If a reproduced loop evades current controls, extend
the owning policy and test that loop. At-least-once consideration, affordable
redo and lost recent history/accounting after a crash are acceptable. Exact
crash accounting and eliminating every duplicate handoff are not requirements.

## Implementation sequence and #381

1. Clarify the hierarchy at the owning escalation/boundary contract and manual.
   Keep installed coverage separate from intended behavior.
2. Finish Host #381 as a small mechanical recovery improvement: missing optional
   session metadata can be tolerated when the retained Task establishes identity
   and execution cleanup is confirmed. Fix the cancellation/cleanup review
   finding for both present and absent metadata. Preserve unsafe-replacement
   failure feedback; do not make #381 implement hierarchical recovery.
3. Run the independent escalation trial below using existing App declarations,
   runner and return paths. Fix only the missing delivery or execution primitive
   it exposes, in a separately reviewable change. Keep App policy in Apps.
4. Update implementation status and retain exact evidence. Source checks, PR
   review, merge and installation adoption establish different facts.

#381 addresses a synthetic missing-metadata case, not a demonstrated live
outage. Its value is allowing affordable reconstruction with surviving intent.
If that requires substantial new machinery, reconsider the tradeoff. No storage
migration or new repair result schema is required.

**Review status:** #381's cleanup fix is published at `a9cc67ef6`; local CI and
GitHub Quality/Container passed and its cleanup review thread is resolved. It
is ready for independent review, unmerged and undeployed at this record. See
the [trial and validation evidence](../archive/reviews/hierarchical-recovery-trial-20261017.md).

## Decisive trials

| Case | Required evidence |
| --- | --- |
| Ordinary tool error | The active owner handles feedback without a duplicate recovery invocation. |
| Safe missing-history recovery (#381) | Sufficient Task context survives; old execution is stopped; ordinary startup/claim recovery reaches an accepted result and reports the missing history. |
| Cancellation or helper cleanup pending (#381) | The old claim and live markers remain; no replacement or fabricated completion. After actual cleanup, ordinary recovery can proceed. |
| Owner cannot start because Git setup or workflow loading fails | A declared escalation recipient receives the original reference/error, starts through real runner/workspace setup, performs a repair, and the original Task resumes to a useful result. |
| Owner lacks repair capability | It asks the next responsible agent without spending mandatory failed attempts; the return reaches the original assignment. |
| Recipient cannot help or failure repeats | Existing bounds and escalation leave a visible blocker and needed decision; unchanged notices do not repeatedly commission repair. |
| Shared prerequisite returns | Quiet checks/returns make retained work eligible under its existing policy; original owners verify their own outcomes. |

Use disposable environments for injected failures. A scripted agent can prove
delivery, repair effects and resumption mechanics; it cannot prove autonomous
diagnosis. The fixture must perform the repair through the actual agent/tool
path, not silently restore the prerequisite after a notification. A bounded
real-model trial is needed before claiming judgment works. State that separately
from portable checks and from a full worker/bootstrap trial.

Record original/repair invocations, available total usage, time to useful
progress, repeated wakes and human intervention for successful and unresolved
cases. Keep successful restart, wait and cleanup regressions. Quiet queues or
accepted diagnostic reports alone are not the success criterion.
