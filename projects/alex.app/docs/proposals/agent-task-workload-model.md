# Agents, Tasks and workload feedback

**Supports:** [Agent Task ownership](../2a-design/agents.md#task-ownership-and-app-scope).
Keep useful work moving under changing demand, make commitments explicit and
bound execution and spending.

**Choice basis:** [Purpose and value](../1-principles/purpose.md),
[simple first](../1-principles/core-principles.md#simple-first) and
[agents judge; infra executes](../1-principles/core-principles.md#code-executes-and-brings-back-evidence-agents-judge).
Business need establishes the assignment; workload makes the opportunity cost
of taking it on visible. Agents judge priorities and scope, while the Host
enforces authority and resource bounds. Shared allowances permit cooperation
without multiplying budgets or making every observation a new assignment.

**Design status:** Accepted direction for the mental model and workload behavior.
The initial charging, renewal and coordination choices below are proposed refinements.
**Implementation status:** Proposed. Agent ownership, creator-controlled revision
and closure, bounded attempts and Host concurrency exist. Direct agent admission,
the shared allowances and workload feedback below are not implemented by this
document. Current durable admission still requires an App. The
[standalone-agent proposal](standalone-agent-tasks.md) owns that addressing change.

The [source and live-system review](../archive/reviews/agent-workload-gap-review-20261108.md)
motivates resource-health feedback and coordination that can start under stress.
Its observations are dated evidence, not proof of improved agent behavior.
**First priority:** finish the existing idle-Task disposition work and prevent
new finite results from accumulating without a decision. This precedes the new
feedback, budget and coordination mechanisms below; use the existing lifecycle,
bounded reader and guarded controls first.

## The mental model

**Agents accept and organize work. Tasks preserve assignments. The Host executes
and keeps the records.**

| Concept | Meaning |
| --- | --- |
| Agent | A durable identity with policy, knowledge, capabilities and a resource allowance. It judges input and owns delivery of assigned outcomes. |
| Task | A durable assignment with an outcome, acceptance criteria, assigned agent, recorded creator, evidence and unresolved work. |
| Attempt | One bounded execution of a Task; it can finish while the assignment remains open. |
| Host | Validates and persists decisions, runs attempts, enforces resource limits and returns feedback. |

An App can package shared context and capabilities; it adds no second
decision-maker or Task owner. The assigned agent chooses methods and reports
results. The recorded creator controls requirements and assignment closure.
The sponsoring agent supplies the resource account for a root; funding does
not change delivery ownership or creator authority.

A Task records a justified assignment and can remain pending without an execution
slot. Accepting it does not promise immediate execution or establish a delivery
date. The agent makes waiting, priority and delivery conflicts visible to its
caller. Completing an attempt, satisfying an input and closing the assignment
remain separate decisions under the existing lifecycle.

A root Task represents one independent assignment. Its descendants are
contributions to that assignment. The root identity also identifies their shared
allowance; it introduces no second work lifecycle. A standing coordination Task
lets an agent consider input and review results through the ordinary Task engine.
Its work has a small, explicit allowance of its own.

## Six rules

1. **Input reaches an agent before it becomes new work.** Human requests,
   metric breaches, schedules, observations and research findings are inputs.
   The responsible agent or its declared policy decides whether to advance an
   existing Task, admit an independent assignment or record no action. Repeated
   evidence can be batched while preserving exact caller obligations. A timer or
   metric alone grants neither authority nor another Task budget.

2. **Judge the need and make the commitment explicit.** Required business work
   can become a pending Task while execution capacity is full. Workload alone
   does not invalidate its need. Preserve the obligation and explain priority,
   waiting and delivery conflicts. Discretionary work must justify the effort
   and delay it imposes on existing commitments; pressure raises that threshold.
   If a request cannot be accepted, return an explicit disposition through the
   existing caller path. Input awaiting a decision remains durably visible.
   Spare capacity permits useful expansion without requiring invented work.

3. **Children share their assignment's resources.** An executing agent may
   request durable contributions within the root's delegated authority. Every
   descendant, retry and required follow-through retains that root's allowance;
   another contributing agent also applies its own execution and permission
   limits. Set a finite work allowance `B` and concurrency allowance `c` for each
   independent assignment, backed by its sponsoring agent's resources. Children
   acquire no independent budget. A new unrelated outcome requires its own
   authorized assignment and allowance. Trusted admission records,
   not structural parent links or model-supplied labels, establish attribution.

4. **Creation and execution both consume the allowance.** The Host atomically
   reserves against the root allowance and sponsor's available credits before
   each charged operation. A pending root needs only its creation charge and no
   execution slot; it does not reserve the full allowance `B`. Children share
   that root's allowance. Create large decompositions incrementally. Replays do
   not charge twice; closure does not refund spent work. At exhaustion, retain
   the input or assignment with its actual disposition and seek an authorized
   funding or scope decision. The [budget policy](#budget-policy) defines charges
   and renewal; retry, revision and delegation do not replenish the allowance.

5. **Yield execution while retaining responsibility.** A parent that has no
   useful independent work yields its attempt while awaiting a child. It retains
   its assignment and outstanding requirements but releases execution capacity.
   At most `c` attempts execute across the assignment and its descendants, subject
   to each agent's `C` and the shared Host limit. With `c = 1`, the parent yields,
   the child runs, and its result wakes the parent. Bounded helpers stay inside
   their caller's authority, cancellation scope and shared spending allowance.
   Parallel helpers must count against applicable execution limits. A suspended
   caller may lend its place to an awaited helper; reusing a place does not
   authorize simultaneous work in it or bypass the recipient agent's limits.

6. **Return results, review and end assignments explicitly.** The assigned
   agent reports evidence; the creator consumes it and retains, revises, closes
   or cancels the assignment through authorized controls. Ending an attempt or
   accepting a result does not itself close a Task. Pressure can bring this
   review forward; completion still requires evidence against the agreed scope.
   Cancellation or reduced scope needs the creator's explicit decision and a
   recorded reason. It must not be reported as delivery of the original outcome.
   Closing a root does not settle unresolved descendants, release their active
   reservations or erase accepted requirements. Input delivery and result
   recording need no new assignment execution budget.

## First milestone: resolve idle work and complete the result path

**Every open Task needs an accountable continuing responsibility. A completed
finite assignment should reach an explicit ending after its result is accepted.**
The [Task lifecycle](../2a-design/task-resource-engine.md#state-and-continuing-responsibility)
already defines this rule. The immediate work is to apply it and complete the
owner's follow-through, before adding workload control machinery.

**Progress, November 8:** The 756-Task idle baseline has 697 verified guarded
closures: Alex 480, May 163 and Scout 54. Its 59 retained assignments are
37 standing/reusable routes and 22 finite obligations with exact owners and
next evidence in the [retention ledger](../archive/reviews/task-backlog-retained-20261108.json).
The final snapshot has 58 currently idle Tasks; two baseline responsibilities
are running and one new arrival is idle. Earlier nine closures preceded this
baseline and are recorded separately in the [live disposition record](../archive/reviews/task-backlog-live-disposition-20261108.md).

**Milestone incomplete:** Baseline disposition is recorded, but new accepted
finite results still need an integrated authorized creator/App disposition path.
The loaded App policy has no trusted post-result closure hook, and the outcome
selector commissions reviews without consuming their completion for closure.
[Host PR #398](https://github.com/hao1939/may-agent/pull/398) now prepares the
opt-in `tasks.closeOnResult` path and is ready for required human review; both
hosted checks passed. Held App source
`0296b342d248f93368fae2bbc9f9e17293688b7c` requires an explicit evidenced ending
decision for finite message/goal assignments and includes the admission-identity
fix. Result, caller answer and closure commit atomically in the tested candidate.
Host merge and separate deployment, companion App integration/activation and a
live finite-result ending remain adoption steps. Task-created reviews retain
creator authority and still need that creator's result-consumption integration.
The scoped reader and installed operator control enabled the historical cleanup;
neither is an automatic result consumer. The narrow review-admission identity correction
is live at App source `6a7e49843c5d2c8cccd7615b991472856d43f8d4`, so later
admissions do not select closed finite reviews. That
correction alone does not prevent the backlog from recurring. Broader budgets
and feedback remain deferred until result-to-disposition behavior is demonstrated.

Start one bounded review of the existing population, saving pages and retry
identities. Use `task-disposition-review` in batches of at most ten, starting with
finite report intakes and independent assessments, then cover the other loaded
Apps. Read original asks, accepted results and exact caller obligations before
deciding. Apply and verify each justified ending as its review finishes; a
completed scan or a closure recommendation alone does not finish this work.

| Owner judgment | Action on the existing Task |
| --- | --- |
| Finite scope fulfilled, with no remaining promise | Creator or trusted App/operator closes against the current accepted result and versions; retain the result and caller evidence. |
| Useful work is still owed | Retain the exact outcome, accountable agent and next action; make it runnable through the existing authorized path when appropriate. |
| A result or decision is missing | Retain the precise dependency, provider/decision owner and return route. If evidence is insufficient, name the missing read or decision and who will obtain it. |
| Standing or reusable responsibility remains | Retain its purpose and declared input, schedule or relevant-change route. An open Conversation may legitimately remain idle. |
| Work is obsolete, duplicate or withdrawn | Obtain the creator's disposition and end the wrapper through the guarded control; verify any remaining promise has a real owner and return route. Do not record withdrawal as fulfillment. |

These are decisions under the existing lifecycle, not new Task states or a
second queue. Preserve active work, Conditions and independent descendants.
Age only selects what to inspect; it does not authorize closure. Ending records
retains their evidence and does not reclaim worktree or artifact storage.

Prevent recurrence in the same milestone. A worker returns a finite result and
closure recommendation. Its recorded creator consumes the accepted result,
checks remaining scope and applies the disposition. For App-created roots, the
declared App policy must provide an authorized owner review/control path; the
worker does not acquire self-closure authority. Use the existing owner-review
routes, coalescing returned results into bounded passes. Do not wake every idle
Task or create a review Task for each record. This result-to-disposition
integration needs source/adoption verification; the existing reader and closure
capability alone do not establish it.

Finish this milestone when the baseline idle cohort has recorded endings or
specific continuing obligations with owners and return routes, and new finite
assignments demonstrate accepted-result review followed by guarded disposition.
Verify that standing work and real waits remain intact. Record added arrivals
separately so a moving population does not invalidate review coverage. The
target is no unexplained open responsibility, not zero idle Tasks or a closure
quota. Any narrow repair needed to carry out review belongs in this milestone;
broader budget and feedback work waits.

## Workload feedback

**Honor existing obligations, spend spare capacity on useful expansion, and use
workload pressure to reconsider priorities and commitments.**

The Host supplies a small workload summary through scoped reads and attempt
context, projected from existing authority. It contains these facts, not a new
Task state or a second queue:

| Information | What the agent can judge |
| --- | --- |
| Running and runnable work, applicable Host/agent/App/root limits, and ready-work waiting time | What can advance now, and what another execution would delay |
| Pending input, blocked assignments with their next relevant change, and results awaiting creator review | Which obligations need consideration, help or disposition |
| Remaining credits and operation-specific resource constraints such as disk, workspace or source access | Whether spare execution places can actually be used |
| Observation time, read scope, estimates, unavailable facts and truncation | Whether the summary is sufficient or an exact scoped read is needed |

Count independent commitments separately from contributions, while including
contribution execution in resource use. Limit the view to the recipient's read
authority and loaded operational scope; ended work and retired Apps are not
current runnable demand. Idle is an execution state: standing work, a finite
result awaiting disposition and an unfulfilled obligation can all be idle.
Unknown or stale capacity is not evidence of available capacity. Avoid full
population scans on each attempt; expose bounded examples and exact-read links.

Agents interpret these facts alongside business value, deadlines and expected
effort, using estimates only where useful. The first version needs neither a
universal pressure score nor a fixed admission formula. Existing App limits
continue to apply until per-agent and root limits are implemented.

Task count is supporting context. If `K` is used as a workload reference, crossing
it prompts review; it is not an automatic rejection or closure threshold. Hard
limits apply to spending, permissions and executing attempts (`C` per agent,
`c` across a root and its descendants, plus the shared Host limit). These limits
do not establish whether an assignment is valuable or complete. Any separate
installation intake or storage quota must return an explicit deferred or refused
disposition, preserving already accepted obligations.

Each agent uses a bounded pass of its existing coordination Task to review
changed obligations and evidence, choose valuable next work and make necessary
priority, funding or scope decisions. Workload influences that judgment:

| Decision | With spare capacity | Under workload stress |
| --- | --- | --- |
| Required work | Advance it and make delivery expectations visible. | Retain its need; prioritize urgency and value, explain conflicts and renegotiate commitments when necessary. |
| Discretionary work | Consider a useful authorized improvement or experiment. | Require enough benefit to justify delaying existing commitments; defer or decline low-value expansion. |
| Scope and execution | Use an appropriate method and depth for the agreed outcome. | Seek the smallest sufficient outcome; obtain creator authorization for changed acceptance criteria. Reprioritize at safe attempt boundaries. |
| Cooperation | Delegate where specialist skill or parallel capacity helps. | Check the recipient's capacity and coordination cost; delegation preserves the root budget and caller responsibility. |
| Review and closure | Review results and stale work regularly. | Review blockers, already sufficient results, duplicates and obsolete work sooner; retain the same evidence and authority requirements. |

Include old ready obligations in review so low-priority work cannot silently
disappear behind repeated urgent arrivals. The agent must explain continued
deferral or seek a changed commitment; queue age alone does not grant priority,
funding or a delivery guarantee. Automatic priority aging is not required for
the first version.

Required and discretionary describe business judgments, not new Task types.
When execution is idle because work is blocked, resolve useful blockers and
consume results before expanding. Independent work may still proceed when its
value and allowances justify it. When no useful authorized work remains, idle
capacity is appropriate. Neither maximum utilization nor minimum live Task
count is the objective.

Relevant input, a returned result, a meaningful change in capacity or sustained
shortage of runnable work may wake coordination. Coalesce repeated notifications,
bound each review and use a cooldown after an empty planning pass. Routine
sampling and an unchanged idle condition do not each invoke a model. No separate
controller agent is needed. Limits and acceptance criteria do not automatically
change with the pressure signal.

The expected benefit is less low-value expansion during overload, useful
exploration when capacity is spare and faster disposition of completed or
obsolete work. Feedback adds no physical capacity. If required demand exceeds
completion capacity, waiting grows until demand, commitments or capacity change;
the agent must surface that conflict. Deferring a request moves outstanding
demand elsewhere and must remain visible. Cancellation is a business decision,
not evidence of improved delivery throughput.

## Coordination that can run under stress

Each agent's standing coordination Task considers input, selects useful work,
consumes results and brings finite assignments to their creator for disposition.
Use existing owner-review routes during migration. The installation declares
the accountable agent and trusted coordination role through normal definitions;
a Task name, priority or model-authored label cannot grant that role. A returned
result can wake the recorded creator's coordination Task, with repeated wakes
coalesced. App-created roots need an explicitly authorized App-policy control
path; the assigned worker never acquires closure authority by reviewing itself.

Reserve one shared Host place for human interaction and these bounded
coordination passes. Prefer human input at safe dispatch boundaries and give
ready coordination passes fair turns within their protected allowances. There
is no permanently running controller or reserved place per agent. A one-place
Host interleaves bounded attempts instead of reserving away all execution.
The current foreground reserve is for pending human Conversation work; extending
it to trusted coordination remains unimplemented.

Autonomous coordination still honors App pause and explicit stop; reserve access
does not inherit the existing human-only pause exception.

Coordination uses an installed definition or existing authorized workspace and
must not require a new worktree for reads, priority decisions, funding review or
guarded closure. It has protected credits independent of exhausted ordinary
work. Business execution and decomposition still use ordinary assignment
budgets; they cannot be relabeled as coordination. If canonical storage cannot
persist a decision, report that failure through the existing operational path;
do not acknowledge an unrecorded commitment or claim autonomous recovery.

## Resource prerequisites and shared blockers

Check prerequisites at the boundary of the operation that needs them. For
example, worktree preparation uses its filesystem, repository/commit and measured
or declared footprint; source retrieval uses the relevant provider/access scope.
A failed prerequisite defers that operation with evidence and a recovery route.
It does not reject the business need, close a Task or stop unrelated operations.
Missing estimates remain explicit and use the existing bounded failure path;
a universal free-space threshold cannot establish every operation's eligibility.

Use existing Conditions and observations to reference a shared blocker by its
resource, relevant requirement and observed episode. Several assignments can
refer to the same capacity incident without merging caller promises, permissions
or budgets. Coalesce unchanged blocker notifications before invoking a model.
An inexpensive provider observation can recheck the prerequisite; wake affected
work on a relevant transition, explicit new requirement or justified review
deadline. An unchanged schedule alone need not purchase the same judgment again.
Preserve schedules that actually require new consideration under their agreed
business scope.

A prerequisite check that defers before execution does not spend an execution
start credit. A started attempt that fails preparation does spend one and remains
subject to the existing retry policy. A recovery observation neither renews
exhausted retries nor grants credits: it wakes an eligible waiting Task, or its
responsible agent for an explicit retry/funding decision. Retain the original
input, exact return path and accepted evidence throughout.

Storage and artifact retention remain separate resource responsibilities. Ending
a Task does not delete its records or restore disk space. Cleanup requires its
existing ownership and retention policy; spare slots and work credits cannot
substitute for physical capacity.

## Budget policy

For the first implementation, `B` counts coarse work credits. Charge one credit
for a newly created durable Task, one for each started Task attempt, and one for
each separately invoked bounded agent helper. The primary agent executing an attempt is
included in the attempt charge; nested calls add their own charges. Retries and
failed starts after dispatch count. Mechanical input delivery, reads and result
settlement need no execution credit; ordinary tool calls remain covered by their
attempt's per-call bounds. Keep per-call time/tool/token bounds and
observed usage alongside this quota: a work credit does not promise equal work,
fixed financial cost or a storage allowance.

The sponsor supplies ordinary credits and a protected coordination allowance
under declared grants for fixed daily UTC periods. Installation policy chooses
the grant sizes; pressure cannot silently enlarge them. Renewal is mechanical
and idempotent by agent, purpose and period. Unused daily credits do not roll
over. Normal Task creation and business work cannot spend coordination credits.
If the creation charge cannot be paid, retain the received input with a visible
funding disposition; accepting input must not silently promise funded execution.

Finite assignments retain a cumulative root cap `B` across days, retries and
reopening. A new daily agent grant does not reset that cap. An explicitly
authorized funding decision can increase it within the sponsor's resources,
preserving all prior spending. The sponsor or its authorized policy sets and
increases root caps within its grant; only the installation's authorized funding
control can enlarge that grant. Task creation or closure authority alone grants
neither power. Standing assignments and coordination use a
declared per-period root allowance under the same agent grant, retaining their
Task identity and historical charges. A wake or a change of structural parent
does not convert finite work into a renewed standing allowance. Funding decisions
do not change scope or grant creator authority.

Budget state belongs in the Host's existing SQLite-backed store. Tasks and
execution contexts carry a trusted shared budget reference. Atomically reserve
credits against both the root cap and the sponsor's relevant period balance,
with a stable operation identity and the applicable execution claim. Each
creation/start is charged once. Creation spends its charge when the new Task is
persisted. An execution spends its charge on dispatch, including preparation
failure; release an unused reservation only when non-start is established.
After interruption, uncertain starts retain their charge until reconciled.
Crossing a period boundary does not refund or reassign prior charges, double
grant credits or release execution capacity still held by live work.

Execution holds a capacity reservation, not a database lock. Recover that
capacity through the existing attempt ownership and confirmed-cleanup path;
reconcile credit reservations against the recorded operation. Child spending
does not mutate the root Task's execution version. There is one authoritative ledger for
the Host's runtimes; per-agent copies or a separate distributed lock are not
needed. These accounting choices remain unimplemented and bound work starts,
not monetary spending or indefinite retained storage.

## A simple capacity graph

Use the [interactive capacity map](agent-task-workload-graph.html) to vary `i`,
`j` and `k` for three identical agents. Every common interval `i`, each agent
receives on average `j` new independent Tasks and has capacity for `k` work
completions. Closed work leaves the live population; pending work uses no
execution slot. Treat contribution costs as already included in the rates.
This baseline accepts all arrivals without an admission limit or feedback; it
shows the pressure agents must interpret. Colors indicate demand relative to
capacity; they do not prescribe rejection or closure. Future feedback analysis
can separate required arrivals from discretionary expansion, since agents can
reduce the latter more directly. Record delivered outcomes, cancellations and
deferred demand separately rather than treating all disappearance as completion.

Total arrival rate is `lambda = 3j/i`; work capacity is `mu_work = 3k/i`.
With prompt creator closure, effective capacity is `mu = mu_work`. An optional
shared management limit changes it to `mu = min(mu_work, mu_close)`.
Load is `rho = lambda/mu`; excess demand grows at `max(0, lambda - mu)` Tasks/minute.
The fluid backlog after time `t` is `max(0, initial + (lambda - mu)t)`.

The graph uses `j` and `k` as its axes. Color can show load or growth per hour;
clicking selects the inputs for a backlog projection. With common `i`, the
worker load ratio `j/k` stays unchanged when `i` changes. Growth per minute and
the effect of a fixed management rate can change. Equal arrival and service
rates have no stochastic headroom: a flat fluid line is not a prediction of
zero random waiting. This is rate analysis, not a simulation of agent behavior.
The baseline assumes the prerequisites for its stated capacity hold. A disk or
access blocker can make the usable capacity for affected work zero even while
execution places are empty; the heatmap does not currently model that constraint.

## One example

Alex has execution limit `C = 2` and is working on a required repair and an
optional investigation. Both use their own finite root allowance `B`.
Its coordination Task receives a metric breach. Repeated evidence for the repair
updates that assignment. A critical new incident becomes a pending Task
even while both execution slots are occupied. Alex defers the optional
investigation at a safe boundary and advances the incident when credits and a
slot are available. Any delivery conflict is reported to the relevant creator.

The repair requests a diagnostic contribution from Bob with `c = 1`. Its parent
yields execution while waiting, so Bob can run within that root's shared budget
and his own limits. Delegation creates no capacity or credits. Workload pressure
does not make the repair complete while Bob's required result is outstanding.
An already sufficient result can receive earlier creator review; obsolete
optional work can be explicitly cancelled with its reason and caller disposition.

When useful runnable work becomes scarce and credits remain, Alex can consider
another improvement under authorized goals. If no worthwhile work exists, it
stays quiet. There is no requirement to refill a Task count.

If the incident needs a worktree and disk capacity is insufficient, it remains
pending on that prerequisite. Other Tasks needing the same resource reuse the
blocker evidence. Alex's coordination pass can still run from an existing
workspace, review priorities and report the exact missing capacity. A meaningful
capacity observation wakes eligible work; it does not create another repair
assignment or reset an exhausted retry allowance. A returning finite result
receives creator review even when the execution queue is otherwise quiet.

The reentrant-lock analogy applies only to shared budget attribution: children
reuse the root allowance rather than acquiring another independent budget.
Execution uses a shared concurrency allowance, so siblings may run together
when `c` permits it. The analogy grants no permission to bypass another agent's
limits, run concurrent attempts of one Task, or retain an execution slot while
waiting for a durable child.

## Implementation boundary and verification

This proposal changes admission and accounting policy, not Task identity,
Conditions, result correlation, creator authority or the existing recovery loop.
Direct and App-addressed input, Conversation handoff, durable delegation and
event mappings must pass the same accounting boundary. Reopening retains root
attribution and spent charges; additional funding needs authorization. Bootstrap,
standing work and historical imports must be accounted for explicitly rather
than become unrestricted creation paths.

| Capability | Current implementation and remaining work |
| --- | --- |
| Pending work, atomic claims, bounded retries and creator-controlled closure | Existing foundations; preserve them. |
| Capacity | Host and App limits and a human foreground reserve exist. Per-agent/root limits, helper accounting and trusted coordination access remain unimplemented. |
| Feedback | Scoped Task/child/wait reads and App owner reviews exist. The shared bounded workload summary and its use in agent decisions remain unimplemented. |
| Budget | Per-call limits and usage records exist. Shared attribution, credit grants, cumulative charges and renewal remain unimplemented. |
| Shared blockers | Individual Conditions and recovery exist. Operation-specific prerequisite admission and cross-Task coalescing need implementation at the affected resource boundary. |

First complete [idle disposition and the result path](#first-milestone-resolve-idle-work-and-complete-the-result-path)
using existing capabilities. Then address the existing accountable
resource-capacity work and make coordination reachable, trial the workload
summary through owner reviews, and implement shared accounting. No additional
controller agent is required.
This proposal defines intended behavior and initial units; it supplies no new
callable API or deployed instructions. Grant sizes, bounded review cadence and
resource-specific footprint estimates remain installation choices to verify.

Verify these contrasting cases before claiming the feedback improves behavior:

| Case | Expected behavior |
| --- | --- |
| Same required incident under light and heavy workload | Preserve its need in both; pressure changes priority and delivery expectations, not acceptance by Task count. |
| Same discretionary opportunity under light and heavy workload | Consider expansion when useful capacity exists; under pressure require enough value to displace existing work. |
| Idle execution with blocked assignments | Review actual blockers; do not infer missing business work from low utilization. |
| High backlog with an incomplete Task and an already sufficient result | Keep the unmet obligation; bring sufficient evidence to creator review without lowering criteria. Cancellation remains a separate disposition. |
| Repeated urgent arrivals while older required work stays ready | Make continued waiting and delivery conflicts visible during review; obtain an explicit commitment decision rather than silently abandoning it. |
| Burst of repeated metric observations | Reuse accountable work where appropriate, preserving exact caller obligations. |
| Nested cooperation with `c = 1`, including restart | Yield so the child can run; preserve shared charges, attribution and responsibility. |
| Concurrent claims, retries and exhausted credits | Enforce `B`, `C`, `c` and Host bounds without double charging; retain visible work and bounded creator coordination. |
| Parallel helpers, including an awaited helper with `c = 1` | Charge each helper; suspended callers yield or lend capacity, while parallel work respects all applicable limits. |
| Parent closure while a child remains unresolved | Preserve child obligations and active reservations until their actual disposition and cleanup. |
| Several Tasks hit one full filesystem or access blocker | Retain separate obligations and one shared blocker observation; avoid repeated unchanged model judgments and allow unrelated work. |
| Ordinary budget exhausted or a new worktree cannot be created | Bounded authorized coordination can use its protected allowance and existing workspace; do not claim a decision if storage cannot persist it. |
| A blocker recovers after retry exhaustion | Deliver the new evidence to the responsible agent without resetting retry counts, credits or caller obligations. |
| Daily boundary, restart and uncertain execution start | Grant once, retain in-flight reservations/charges, preserve finite root spending and renew only declared standing allowances. |
| An idle finite result and an idle standing Task | Bring the finite result to its creator for disposition; retain the standing purpose and declared wake. Neither is ended by phase alone. |
| No useful work after a planning pass | Stay quiet until relevant input or a justified review time. |

Use the same business scenarios under different loads and inspect actual agent
decisions, fulfillment, waiting, discretionary effort and review cost. Smaller
Task counts or more closures alone do not establish improvement. These are
proposed verification cases, not tests run, behavioral evidence or deployment
claims. Reconsider additional control machinery only if observed decisions or
resource enforcement remain inadequate.
