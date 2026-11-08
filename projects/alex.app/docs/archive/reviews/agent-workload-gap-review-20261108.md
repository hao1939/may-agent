# Agent workload: source and running-system gaps

**Supports:** [Agents, Tasks and workload feedback](../../proposals/agent-task-workload-model.md).
This dated review explains the resource, coordination and accounting refinements;
the proposal owns the intended rules. It does not establish improved behavior or
implementation of those refinements.

Reviewed 2026-11-08 using canonical reads at 11:16 UTC and a bounded recent-history
cut. The review was read-only apart from existing source tests. No Host/App
deployment, Task mutation, retry, cleanup, message, paid model trial or budget
change was performed.

## Source and deployment identity

The source and running Host were
`4f8d0188ff11c19ada8c56d0a5a4ef373eb7e1eb` (#392, lifecycle and creator closure).
The local deployment receipt at
`/app/projects/may-agent/.state/deploy-receipts/host-task-lifecycle-pr392-20261108.json`
reported success and health; artifact and loaded artifact were both
`0bb1969fbf12e6ad3138d7d15a49ec33e2d474aaea641a0404dd0223fed1d0eb`.
The running executable and the executable inside its filesystem matched that
hash. The review shell had a different mount namespace and an older executable;
that was not a discrepancy in the deployed Host.

The Host started at `2026-11-07T19:58:04.028Z`. Loaded Alex, May and Scout
definitions were `8f695085374b0109c1605b3fafcd674f1ffcb1e0-definitions-v5`.
Readiness returned HTTP 200 and `ready: true`; two control reads showed no active
agents or work. Host concurrency was 8 total, with at most 7 background attempts;
App limits were Alex 3, May 4 and Scout 1. Editing design documents does not
activate them as agent instructions.

## Observed workload and physical capacity

Canonical Task reads excluded closed/cancelled work, completion receipts and
retired Apps. Pages were read sequentially; this was not an atomic fleet snapshot.

| Loaded App | Idle | Waiting | Attention | Pending/running | Open |
| --- | ---: | ---: | ---: | ---: | ---: |
| Alex | 514 | 5 | 0 | 0 | 519 |
| May | 178 | 11 | 3 | 0 | 192 |
| Scout | 64 | 1 | 8 | 0 | 73 |
| Total | 756 | 17 | 11 | 0 | 784 |

Idle means no current execution is requested. It establishes neither fulfillment
nor closure authority. Some records are standing work or Conversations; finite
assignments still need their original scope, evidence and creator disposition.
In the corresponding resource cut, 718 idle records had not been updated in
seven days: candidates for review, not a bulk-closure list.

The 251 GB volume had roughly 0.7 GB available. The captured cohort since this
Host startup contained 76 attempts: 60 completed and 16 failed. Completed attempts
include waiting outcomes, not just delivered assignments. All 16 failures had
disk/worktree evidence: nine May and seven Scout failures.

Scout's `explore-github` had 16 attempts: four converged and twelve waiting.
Several waiting results correctly avoided more scans while preserving unresolved
publication/capacity obligations. The cut does not show that every wake was
wasted. A prior 24-hour cohort contained 75 incomplete Scout results, all before
this deployment. The current three-attempt policy bounds that earlier retry
behavior; those historical attempts are not evidence of an unbounded current
loop.

## Gaps and smallest useful corrections

| Finding | Consequence | Correction retained in the proposal |
| --- | --- | --- |
| Attempt context and App-scoped reads lack a shared workload summary. | Agents must assemble expensive partial views and can confuse many open Tasks with execution pressure. | Supply a bounded, timestamped view of runnable work, blockers, review candidates, credits and usable capacity within read authority. |
| Host/App limits, retry bounds, per-call allowances and usage records exist; root/sponsor accounting and agent/root concurrency do not. | Children and retries have no cumulative shared work quota; observed cost is not an enforced balance. | Add trusted root attribution and atomic reservations at existing operation boundaries, preserving claims and retry protections. |
| Foreground eligibility covers pending human Conversations, not autonomous owner reviews. Worktree preparation occurs before agent execution. | Reserving a place alone cannot ensure coordination starts under stress. | Declare trusted bounded coordination and an existing-workspace path; preserve human responsiveness and creator controls. |
| Repeated Tasks can encounter one physical prerequisite failure. | Empty slots may coexist with repeated preparation failures and repeated judgments of unchanged evidence. | Check the relevant resource at the affected operation; share blocker observations and coalesce wakes without merging obligations. |
| Intake and review policies already exist in Apps but lack common workload/accounting facts. | A new input mapping can look like new funded business work, even when it repeats existing need. | Reuse existing owner reviews to decide advance, defer, decline or commission, retaining exact caller obligations. |

Reviewed source boundaries at the Host revision above:

- `src/app/app-runtime.ts:159` and
  `src/app/core/scheduling/host-capacity.ts:16`: shared capacity and reserve.
- `src/app/core/tasks/app-task-runtime.ts:587` and
  `src/app/core/tasks/attempt-runner.ts:230`: foreground selection and preparation.
- `src/app/core/tasks/attempt-execution.ts:190` and
  `src/app/core/reads/task-status.ts:4`: scoped context and idle projection.
- `packages/sdk/src/task.ts:35`, `packages/sdk/src/workflow.ts:182,304` and
  `packages/sdk/src/app.ts:438`: Task attribution, reads, per-call limits and App
  concurrency/retry policy.
- `src/lib/manager.ts:1051` and `src/lib/execution-usage.ts:82`: helpers and recorded
  usage, without a cumulative root ledger.

Workspace App examples included `projects/alex.app/app.ts:416` (generic input
mapping) and `projects/scout-knowledge-lib.app/app.ts:465` (owner review/schedules).
These are reviewed behavior, not a permanent source-line contract.

## Value now and implementation order

The strongest supported opportunity is avoiding repeated blocked effort and
improving disposition, rather than a Task-count admission cap. Existing Alex Task
`input/appdep_715d650c41c11f59a97c020e`, created by `runtime/pattern-audit`, already
owns shared worktree-capacity admission/coalescing. Its accepted review says
implementation remains future work. Reuse that accountable work; this review
does not authorize a duplicate diagnosis or data cleanup.

May repair Tasks `goal/appdep_0760adc78afbd4dfb20e5f3a` and
`goal/appdep_8102a64221ef4ec1496599c8` failed during worktree preparation before
their agents started. This motivates coordination that can start without another
worktree, not a promise that an agent can repair every storage failure.

First address the existing resource-capacity work and reachable coordination.
Then trial the small workload summary through existing owner reviews. Implement
shared accounting after settling its units and authority. The proposal now
specifies initial charging and renewal choices explicitly as proposed mechanics.

Compare the same business scenarios under light and heavy loads. Look for useful
obligations continuing, less repeated blocked/model effort, bounded review cost
and proper creator disposition. Fewer open Tasks, more closures, lower sampled
cost or higher utilization alone would not demonstrate improvement. Priority age
should make continued deferral visible; this observation did not establish
starvation or justify an automatic aging policy.

## Verification and evidence limits

Existing portable tests passed in the reviewed Host checkout: `host-capacity.test.ts`,
`queue.test.ts` and `task-closure.test.ts`: **21 tests, 72 assertions, 0 failures**.
They cover current queue/capacity and creator-closure behavior; they do not test
the proposed ledger or establish better workload decisions.

Local detailed evidence was retained under
`/app/tmp/agent-workload-review-20261108/`: `review.md`, `review-evidence.json` and
compressed raw snapshots. That directory and the deployment receipt are local
operational evidence, not portable documentation dependencies. The identity,
counts, limitations and resulting recommendations above are the durable review
record. No new live inspection or agent trial was performed for the subsequent
design refinement.

## Lifecycle integration source review

Reviewed candidate Host `036f4a4f757eea9f8a4492231e5541f365a8fcf6`
([PR #398](https://github.com/hao1939/may-agent/pull/398)), based on main
`17702b600e`. This is a separate source review from the running-system snapshot
above; no fresh live-runtime audit or deployment was performed. The
[workload proposal](../../proposals/agent-task-workload-model.md#integrate-with-the-existing-lifecycle)
owns the resulting integration requirements.

| Lifecycle area | Source processing |
| --- | --- |
| Admission/revision | `state/inbox.ts: admitTaskInput()` reaches `observeAppTaskIntent()`. Conversation admission and creator revision reuse admission; event mappings can reach observation directly. |
| Dispatch/claim | `controller.ts` schedules under Host/App capacity; `claimObservedAppTask()` establishes durable attempt ownership. |
| Execution/settlement | `attempt-runner.ts` serves agents, workflows, registered executors and Conversation executors; settlement reaches the shared completion, defer or failure operations. |
| Waiting/waking | `recordAppTaskTrigger()`, `app-task-condition-tracker.ts` and `lib/db-writer.ts: persistExactTaskWake()` retain evidence/readiness through different implementations. |
| Ending/reopening | Creator controls and the candidate App result policy persist the same closure representation. Attempt Stop remains distinct from ending the assignment. |
| Recovery | Indexed recovery rediscovers saved work. Task-bound sessions are recovered through their Task instead of independently resuming the old session. |

Static counting of top-level functions containing `commitTaskMutation()` in
`app-task-reconciler.ts` found 25 committing functions (23 exported and two
private), with 27 call sites. This includes leases, session association and
workspace observations, not just lifecycle phase changes. Ordinary mutations
reach `app-task-store.ts: commitTaskMutation()` and
`state/app-task-resource-store.ts: commit()`, which checks the exact write fences.
One canonical store does not mean every mutation is a work start or that every
adapter already forwards every effect correctly.

Additional writers have bounded, distinct jobs. Condition observation uses the
shared commit while constructing its own wake changes. `DbWriter` persists an
exact-event wake in the event transaction with direct Task-row SQL. The resource
store also maintains derived recovery indexes and initial bootstrap state.
`malformed-conversation-input-recovery.ts` is an explicit operational repair.
Four offline modules (`conversation-cutover.ts`, `task-state-cutover.ts`,
`task-receipt-cutover.ts`, `task-coordination-cutover.ts`) construct import
mutations. These paths need explicit accounting treatment; their existence is
not evidence of an independent normal Task lifecycle or a demonstrated defect.

PR #398 exposed a concrete effects-forwarding defect: Conversation settlement
replaced the shared completion result's cancellation list with a separate
control list. Durable App closure survived, but its notification was lost. The
candidate removes that separate list and duplicate type declaration; explicit
controls append to the shared result. Both execution modes use the same App
ending policy. Task-mode Conversation already followed direct Task settlement;
the failing adapter was the Conversation executor path.

The source opportunity is to compare wake writers against the same terminal,
generation, replay and retry rules and preserve shared operation effects across
adapters. This review did not demonstrate another wake defect or justify a new
controller, generic transition framework or delivery queue. The four workload
integration boundaries are admission, execution start, settlement with confirmed
cleanup/recovery, and agent decision context.

Verification on the candidate: `bun run check:ci` and 387 focused tests passed
(3,655 assertions, zero failures). Coverage spans result/guarded closure,
communication, Conversation settlement/Requests/runtime, reconciliation and Task
revision. The notification and combined-effects regressions failed before the
fix. Both Conversation execution modes publish closure after the reply commits,
restart does not duplicate it, and reply-persistence failure rolls back App
closure and explicit cancellation together. Hosted **Quality** and **Container**
passed on the exact candidate
([CI run](https://github.com/hao1939/may-agent/actions/runs/42482182792)). These
checks do not implement shared budgets or demonstrate adaptive workload behavior.
