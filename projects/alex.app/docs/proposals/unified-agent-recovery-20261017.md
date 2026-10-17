# One recovery rule: restore useful work within a bounded allowance

**Supports:** [Task recovery](../2a-design/task-resource-engine.md#pause-reload-and-recovery). Keeps unfinished work recoverable without repeated manual rescue or uncontrolled model cost.

**Choice basis:** [Understandable recovery](../1-principles/work-model.md#prefer-understandable-recovery) and [simple first](../1-principles/core-principles.md#simple-first): preserve the goal, let the agent judge, and reuse the execution and Task mechanisms that already work.

**Design status:** Proposed for review, 2026-10-17.
**Implementation status:** The existing mechanisms provide parts of this loop. The shared allowance and an owner execution path independent of broken Task setup are not established. This document changes no runtime behavior.

## Recommendation

Apply one rule wherever failure prevents useful work: **retain the obligation,
give the responsible agent the evidence and a usable execution path, let it
repair or choose a real wait, then verify that ordinary work advances. Bound
unsuccessful repetition across the whole loop.**

Controller errors, workspace setup, workflow loading and failures during agent
execution follow this rule. Their location determines how evidence is captured;
it does not justify an unlimited retry policy. No catalogue of error types is
needed for the agent to investigate unfamiliar failures.

An ordinary tool error should first return to the agent already doing the work.
It can diagnose and continue within that invocation. Host recovery is needed
when that execution cannot continue or never started. A valid external wait or
a quiet worker within its execution deadline is not a failure.

For example, a Task cannot create its Git worktree. The Host retains that Task
and gives its owner the error in a small working directory that does not require
that Git setup. The owner inspects the repository, repairs what it is authorized
to repair, and requests continuation. The Host retries normal workspace setup;
the original Task continues its assignment. If the repair fails, the same
recovery allowance applies. Creating another repair Task buys no extra retries.

## What we learned from the current mechanism

The [source and runtime review](../archive/reviews/recovery-mechanism-20261017.md)
separates demonstrated behavior from remaining gaps.

| Finding | Design consequence |
| --- | --- |
| Restart recovery preserved Tasks and produced useful work. Feedback also lets an active agent correct errors in the same invocation. | Retain these paths and their ownership; start recovery with surviving intent and current facts. |
| Controller failures emit `handler.failed`, but the installed Alex, May and Scout definitions have no subscription to that event. Selected failure routes exist. | Logging and a Task in attention are insufficient. Make owner delivery part of the common recovery path. |
| A normal repair Task can require the same Git preparation and App bootstrap that failed. | Reuse the bounded runner with a smaller prerequisite set; demonstrate that the owner really starts. |
| Execution failures default to three consecutive failures; controller dispatch and admission can retry indefinitely with capped delays. | Apply one bounded work-recovery policy across these boundaries. Backoff alone does not establish progress. |
| Existing connected tests prove failure consideration, but their owner does not actually repair and resume the failed work. | Require an end-to-end repair and original-work result. A delivered report is intermediate evidence. |
| Extra review and correction loops have incurred material token cost. | Deliver concise evidence to the existing owner; do not automatically start a reviewer and a new repair Task for every error. |

The earlier #381 patch addressed a synthetic missing-history case before we
proved this general path. It remains draft and is not the implementation plan.
The lesson is to test the recovery mechanism across failures, rather than build
a separate branch of repair logic for each failure we can reproduce.

## The recovery loop

1. **Retain work and explain the failure.** Keep the existing Task or pending
   input, its owner, and whatever evidence survives. Deliver the failing
   operation, exact error, current execution/cleanup facts, evidence references
   and remaining allowance. Keep long logs available on demand.
2. **Make one owner execution possible.** Use the current invocation if it can
   continue. Otherwise use the existing bounded runner without depending on the
   failed Task's workflow, Git worktree preparation or old session metadata.
   Keep the same tools, authority and installation restrictions.
3. **Let the agent act.** It may repair, reconstruct disposable state, choose
   another approach, wait for an external fact, or identify a specific decision
   it needs. An unfamiliar error is ordinary investigation input.
4. **Resume and verify.** Retry the affected ordinary operation and continue
   the original assignment. The owner judges goal progress using concrete
   output, tests or other task-relevant evidence. A successful repair report,
   accepted JSON response or newly created Task alone does not prove recovery.
5. **Contain unsuccessful repetition.** Keep one recovery in flight for the
   affected work. When its allowance is exhausted, retain the obligation in
   attention with the attempted actions, blocker and next decision. Ordinary
   scheduling ticks do not renew that allowance.

These steps describe behavior in the existing Task lifecycle, not a second
scheduler or a new durable repair workflow. The Host cannot infer semantic
progress from logs alone; it enforces limits and exposes execution evidence.
Agent judgment remains fallible and can be assessed through existing evaluation.

## One policy, including setup and controller failures

Use a **recovery cycle** to mean one bounded owner repair attempt, if needed,
followed by at most one retry of the affected ordinary work. A direct automatic
work retry also consumes a cycle. Failure to start the owner consumes a cycle
as well; changing where an error occurs must not evade the limit.

Proposed starting policy for review:

- Allow at most **three unsuccessful cycles** for the same stalled work,
  taking the existing three-failure default as the starting point. The owner
  receives the first failure; do not spend all three on blind setup retries.
- Apply finite execution deadlines and model/tool limits to every invocation.
  Repair, helpers and ordinary retry draw from the same configured recovery
  cost ceiling. Three cycles is an outer bound, not permission to spend beyond
  that ceiling. Reuse existing budget controls; report the effective limits
  when validating an implementation rather than inventing a universal token
  number for all Apps.
- Preserve the allowance on the existing Task or pending input across restart,
  new attempts and delegated repair. An error message change, new report,
  generation bump or new repair Task is not proof of progress and does not
  reset it. Share that original reference with separately owned contributions.
- A real wait names a prerequisite and a supported return path. A changed fact
  permits reconsideration within the remaining allowance. Exhaustion requires
  an explicit owner/operator decision to renew it; an automatic timer cannot
  make that decision, and a recovery result cannot grant itself fresh credit.
  Successfully restored operation plus accepted evidence of useful work ends
  the stalled period.

The shared rule distinguishes **work attempts from availability checks**, not
controller failures from agent failures. A paced code check may continue to
observe a waiting prerequisite without a model call. Each check must have a
bounded timeout and resource cost, and unchanged results must not trigger a new
agent turn. Reuse existing observation/backoff scheduling. Re-running a worker,
full App bootstrap or Git setup is a work retry, not a free availability check.

This retains eventual detection when a dependency returns without spending
tokens confirming the same outage. A hard cap can leave genuinely unresolved
work awaiting a decision; that is preferable to an invisible costly loop. A
known outage should become a wait early, preserving allowance for recovery.

## Host and App responsibilities

**Both need changes, for different responsibilities.** Fixing App subscriptions
alone cannot recover an owner blocked by Host setup. Host plumbing alone cannot
choose a useful repair or decide whether the result meets the assignment.

| Host owns | App and agents own |
| --- | --- |
| Failure capture and delivery tied to the existing Task/input and configured owner | Meaning of the failure, investigation, repair or alternative approach |
| A bounded owner invocation that bypasses failed optional Task setup | Which evidence establishes useful progress toward the original goal |
| Capacity, execution deadlines, shared recovery limits, and cleanup before conflicting replacement | A real external wait, a specific help request, or a justified request to renew allowance |
| Retained scheduling and cheap checks that wake work when relevant facts change | Authorized source fixes, tests and follow-through |
| Factual display of last failure, attempts/cost, owner, and why work is waiting | Alex leads system improvement and assigns teammates when useful; Evaluator assesses outcomes |

The Task owner should keep in-scope repair. When a fix needs system-improvement
ownership, use the existing addressed contribution to Alex and return evidence
to the original Task. Alex chooses whether Bob, Tech Lead, Gym or another
teammate is useful. Evaluator is not a mandatory relay or the repair owner.

## Minimum execution path and failure boundary

The implementation must demonstrate a direct invocation of the configured owner
using the existing runner and an already accepted agent definition, with a
disposable working directory. It must not first import the broken workflow,
prepare the failed Task worktree or resume the unusable session. The current
worker's whole-App registry bootstrap needs review at this boundary; simply
creating an ordinary Alex Task does not provide this independence.

This is a smaller entry into the existing runner, not another agent service.
Select the owner from retained trusted configuration, not from an error string.
If no accepted owner configuration can be loaded, the runner/model is down, or
essential storage cannot be used, expose that execution is unavailable. Reuse
the external supervisor/operator and bounded availability observations until
minimum capability is restored. An agent cannot repair anything while it cannot
execute. Do not create a second database to simulate normal operation.

Preserve the current execution fences and wait for actual helper/process cleanup
before a conflicting replacement starts. A cancellation request is not proof
that cleanup finished. Diagnostics must not hold the failed worker's capacity.

Use the existing store when it works. Losing some recent history, accounting or
repeating bounded work after a crash is acceptable; reconstruct from current
facts and disclose unknowns. This proposal does not require exact-once repair
or perfect crash accounting. Repeated bootstrap failure must still be paced and
visible to the external supervisor, rather than resetting an internal hot loop.

## Delivery and acceptance

Implement one connected path after design review: common Host failure/owner
delivery, the smaller runner entry, shared limits, and App owner handling.
Exercise it with the same fixtures across the boundaries below. Add only the
minimum missing primitives needed by this path. Existing event-specific routes
should be folded into it where they duplicate recovery, preserving useful
domain feedback. No automatic evaluator fan-out is part of this change.

| Acceptance case | Required evidence |
| --- | --- |
| Tool error inside a usable agent invocation | The current owner receives it and continues; no duplicate recovery invocation. |
| Broken workflow loading or Git setup before owner execution | With real App workspace configuration enabled, the owner starts through the smaller runner path, performs a repair, and the original normal path produces a useful result. |
| Missing optional session history after restart | The owner can reconstruct from surviving intent and current facts; missing evidence is explicit and existing cleanup rules hold. |
| Shared prerequisite temporarily unavailable | Bounded code checks remain quiet; restored availability permits the retained work to proceed within its allowance. |
| Unsuccessful repair, recurring failure, or failure of the recovery invocation itself | One retained obligation and shared allowance; exhaustion stops work retries and exposes the next decision. Duplicate events and ordinary restarts do not grant fresh credit. |
| Old execution still cleaning up | No conflicting replacement starts until cleanup is confirmed; inability to confirm becomes a visible blocker. |

Portable tests must have the fixture owner actually perform the repair, rather
than have the test quietly restore the environment after a notification. Use
the real runner setup at the independence boundary; scripted model responses can
prove mechanics but cannot establish autonomous diagnosis. A bounded trial with
a real agent in a disposable environment is needed before claiming that judgment
works. None is run by this documentation change.

Record time to useful progress, original/repair invocation counts, total model
usage including helpers, and duplicate/no-progress wakes for both a successful
repair and an unrepaired failure. Apply failure injection only to the disposable
trial. A quiet state, delivery acknowledgement or an accepted report is not the
success metric. Retain the successful restart, wait and cleanup regressions.

After implementation, update the owning [Task contract](../2a-design/task-resource-engine.md),
[execution feedback](../2a-design/execution-feedback.md), [runtime contract](../2a-design/runtime.md)
and [operations guide](../2b-manual/app-operations-recovery.md) together. Review,
merge and installation adoption remain separate evidence. #381 stays draft.

## Decisions to review

The recommended direction is one rule across all failure stages, an owner path
independent of optional Task setup, and one finite allowance for repair and
resumption. The three-cycle default is a proposed operating choice, not a
measured optimum. Check the acceptable cost and delay against actual configured
runner budgets during implementation review. The key design tradeoff is allowing
bounded reconstruction and repetition while keeping failure understandable and
recoverable.
