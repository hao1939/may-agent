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
**Implementation status:** The supported accounting, execution-limit, feedback
and coordination paths merged in [Host #443](https://github.com/hao1939/may-agent/pull/443)
at `01ba70398c7b5a0454bf663115c9f758901d3dc6`. Subsequent simplification in
[Host #482](https://github.com/hao1939/may-agent/pull/482) removed work-credit
accounting, sponsorship and layered execution reservations. The corresponding
charging, renewal, installation and withdrawal sections below are historical
design and verification, not available current-source activation procedures.
Agent ownership, creator-controlled revision and closure, bounded attempts,
Host concurrency and scoped workload observations remain. Installed owner
follow-through and behavioral acceptance remain pending.
The [current-guidance correction](https://github.com/hao1939/may-agent/pull/497)
merged at `528cfeec32b5bb7b262857e02ddc57ccb8319938` and aligns shared executor
instructions with those remaining controls. Alex's own workload-review prompt
and agent guidance now use the same observation and authority rules; its current
fixtures report retired account and execution fields unavailable, while explicit
legacy-read cases preserve compatibility. Required work
stays owed under pressure; agents judge priorities, methods and discretionary
expansion. An observation reserves no execution slot, and unavailable fields
establish neither an allowance nor a denial. Creator-controlled closure still
requires evidence against the assignment. Source verification is not activation.
The [completion audit](../archive/reviews/workload-completion-audit-20261109.md)
maps the supported first path to its implementation owners and records the
remaining review, result-disposition adoption and behavioral acceptance gates.
The former source also verified one-way offline withdrawal; the later retirement
supersedes that operational path. None of these source checks establishes a live
cutover or online start exclusion.
Current durable admission still requires an App. The
[standalone-agent proposal](standalone-agent-tasks.md) owns that addressing change.

The [source and live-system review](../archive/reviews/agent-workload-gap-review-20261108.md)
motivates resource-health feedback and coordination that can start under stress.
Its observations are dated evidence, not proof of improved agent behavior.
The [implementation approach](agent-task-workload-implementation.md) maps this
direction to current source, narrows the first delivery and records the remaining
contract changes. Direct agent addressing is not a prerequisite for that work.
**First operational priority:** finish the existing idle-Task disposition work
and prevent new finite results from accumulating without a decision before
broader workload activation. Use the existing lifecycle,
bounded reader and guarded controls first.

**November 13 follow-through:** [Host #472](https://github.com/hao1939/may-agent/pull/472)
merged one explicit creator-discovery read, independent of grouping and ended
waits. Scout's committed guidance uses it on ordinary wakes; release and native
behavioral acceptance remain on hold. The
[owner comparison](../archive/reviews/workload-owner-comparison-20261113.md)
runs a separate local business fixture to verify applied decisions while
preserving the readonly advice pilot. Its first model cohort exposed duplicate
ownership between an owner operation and a pending child Task. The refined
contract records optional work on the owner and closes only already accepted
independent contributions. The corrected comparison verifies 20 model-driven
applied passes, including eight guarded finite-result endings with unfinished
and standing work preserved. Choices stayed equal under the available light/busy
capacity. The subsequent
[contention comparison](../archive/reviews/workload-contention-comparison-20261113.md)
first applied two useful optional investigations with supplied feedback across
twelve model passes, while both arms deferred under heavy load. A second cohort
with clarified root attribution produced six verified investigations: both arms
investigated under light load and deferred under heavy load, and each completed
one recovery investigation. Each also exhausted its request allowance on another
recovery pass. A third cohort made the decision helper's role explicit and
separated the original opportunity from the current wake. All 12 passes accepted
fresh decisions and produced eight verified investigations, with 18 requests
versus the second cohort's 34. Both arms adapted; supplied feedback saved one
discovery turn per pass with equal business outcomes. The earlier errors remain
evidence. A separate online receipt drill confirmed the existing recovery path
after SQLite contention using one runtime and an injected recovery clock, without
proving production latency or caller delivery.
The actual readonly pilot now uses that explicit helper role and return contract.
A scripted App integration verifies creator-owned result consumption, guarded
closure and return to the original Inbox input across restart. The default pilot
remains advice-only. Source now includes a separate opt-in to notify an exact
existing owner and retain its response through ordinary request/Condition
handling; activation remains held. Source checks do not establish installed
agent follow-through or external delivery.
Reliable adaptation, overall workload benefit and production adoption remain
unproven. The dated November 8
milestone observations below are historical snapshots, not current rollout state.

The [November 13 recovery-route review](../archive/reviews/recovery-route-lifecycle-20261113.md)
separates a finished repair cycle from its declared reusable input route. The
bounded disposition reader now recognizes Alex's App-created recovery routes
without hiding outstanding work. Source guidance asks owners to answer each
notice and become idle without polling. A native comparison found that generic
guidance was inconsistent with finite-sounding recovery requirements. The App
now declares the continuing route in each assignment's outcome and acceptance;
normal fresh admission adopts the clarification once while preserving old
receipts. A scripted controller/restart check verifies later incidents still
arrive. A second native comparison retained recovery routes and closed finite
assessments in both assignment arms; it shows compatibility, without measuring
an improvement. These source and bounded comparison checks do not establish
installed adoption or make ordinary finite work a standing service.

The [native creator-consumption drill](../archive/reviews/workload-owner-comparison-20261113.md#native-creator-consumption-after-runtime-restart)
exposes a separate acceptance gap: all four native owners handled the original
report correctly, but none inspected or closed its fulfilled finite contribution.
More explicit guidance did not fix the observed omission and remains branch-only.
The [creator-context refinement](../archive/reviews/workload-owner-comparison-20261113.md#creator-context-refinement)
merged in [Host #491](https://github.com/hao1939/may-agent/pull/491) at
`9cc9547c9237247f5060f67a35d82774e882236f`. It supplies a bounded fresh creator
page in the existing native decision brief,
using the same read and guarded controls. Identical App guidance on the baseline
again left both fulfilled finite contributions open. The candidate inspected and
closed both, including while its original final delivery remained owed, and
preserved unfinished and standing contributions. All four candidate cases passed
read-only evidence checks. This is one observation per case and revision in
disposable state, not installed or reliable fleet behavior. Business delivery
alone does not establish lifecycle follow-through; broader activation remains held.
The native brief stores the creator page separately from owner detail: changes
in a contribution must not duplicate the owner's unchanged input. Fresh read
times remain observation metadata, and truncated previews identify the correct
detail file. Independent storage failures remain visible and retain scoped-read
fallbacks; neither projection becomes Task or closure authority.

The [merged-source native cohort](../archive/reviews/workload-owner-comparison-20261113.md#merged-source-native-acceptance)
checks that wiring with current Alex guidance after runtime restart. All four
business outcomes were correct: fulfilled finite contributions closed, unfinished
and standing contributions stayed open, and original delivery and deadlines
were preserved. Three of four met every inspection check; the standing-service
case omitted the exact Task read and corrected an unsupported communication
proposal after Host rejection. Keep both qualifications. This bounded local
trial does not establish consistent inspection, ordinary installed follow-through,
external delivery or a workload benefit. Release and activation remain held.

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

A root Task represents one independent assignment. Newly commissioned
contributions inherit that assignment's account from trusted admission. A request
attached to an existing Task retains the target's account and its exact caller
link; requesting a service does not adopt its lifetime spending or transfer its
sponsorship. The root identity also identifies the contributions' shared
allowance; it introduces no second work lifecycle. A standing coordination Task
lets an agent consider input and review results through the ordinary Task engine.
Its work has a small, explicit allowance of its own. This is a proposed installed
role; the current Host does not provide a generic coordinator for every agent.

## Six rules

1. **Input reaches an agent before it becomes new work.** Human requests,
   metric breaches, schedules, observations and research findings are inputs.
   The responsible agent or its declared policy decides whether to advance an
   existing Task, admit an independent assignment or record no action. Repeated
   evidence can be batched while preserving exact caller obligations. A timer or
   metric alone grants neither authority nor another Task budget. A bounded
   step within an existing assignment stays in that Task's input and attempt
   result. Create a child for an independently accountable contribution, never
   to duplicate that step.

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
   Parallel helpers must count against applicable execution limits. A caller
   must not wait indefinitely for a helper that needs its own occupied place.
   The initial capacity implementation defers such a call before helper start;
   durable delegation can yield and resume. Lending a suspended caller's place
   requires a separate proven handoff and is deferred from the first version.

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

## Responsibility before Task admission

The receiving App's declared agent owns received input before a Task can be
created. Exhausted creation credits retain the original Inbox row, source and
exact caller route with its saved funding hold. This is pending admission,
not business rejection, fulfillment or an accepted result. An empty Task page
does not establish an empty workload.

The workload projection includes a separate five-item `unadmittedInputs` page,
with independent `inputCursor` continuation. It is scoped to the receiving App,
even when Task counts are filtered by agent. It exposes identity, input kind,
source, dates and saved funding reason/deadline; payload and transport destination
remain in the existing Inbox authority. The responsible agent can recommend an
authorized funding or disposition review from these facts. Exact business and
caller evidence must be inspected through the existing trusted Inbox read before
any decision. Missing projection or omitted oversized identities require visible
owner inspection, never an empty-work conclusion.

| Boundary | Retained authority and charge | Responsible decision and next change |
| --- | --- | --- |
| Creation funding unavailable | Original Inbox and caller route; no Task, creation debit or execution place. | Receiving App agent reviews need; authorized funding/policy change, exact Task creation/adoption or due UTC grant wakes existing admission recovery. |
| Required Task lacks bandwidth | Existing Task, inputs and creator authority; creation is already paid, no attempt debit/place. | Assigned agent chooses priority or method; applicable capacity release or method revision permits another admission check. |
| Retained Task lacks attribution under shared enforcement | Existing Task and inputs; no new attempt or execution place. | Trusted funding authority explicitly adopts future work; no historical cost is invented. |
| Attempt or helper ends with damaged process evidence | Original claim/reservation and sidecar remain; no refund or release. | Host recovery requires confirmed cleanup; business closure cannot supply that proof. |
| Finite result accepted | Existing result and exact caller obligations remain. | Creator inspects consumption and caller disposition before guarded ending; advice alone proves neither. |

The existing receipt/status read exposes a saved admission deferral. It must not
be presented as a completed App result or a caller notification. Any business
refusal or reduced promise still requires the App's authorized decision and exact
caller path. The readonly review pilot recommends that work; applied disposition
and actual caller delivery remain separate acceptance evidence.

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
[Host PR #398](https://github.com/hao1939/may-agent/pull/398) merged at
`88a98be236baf07bfcf100208cfb0dc1589dfa06`; companion App source integrated at
`9ed31e767f71fe5314b3b5b109350b4e01ed667e`. It requires an explicit evidenced
ending for finite message/goal assignments and preserves the admission-identity
fix. The [post-merge adoption check](../archive/reviews/task-result-closure-adoption-20261108.md)
demonstrates the paired source behavior and records a separate merge-CI failure.
The live Host remains #392 without the companion capability. Host deployment,
App activation and a live finite-result ending remain adoption steps.
Task-created reviews retain creator authority. The selector now has a bounded
source implementation to consume its own validated published finite assessments
through the existing guarded closure path, without another model call. Its
verification and remaining exclusions are recorded in the
[implementation evidence](agent-task-workload-implementation.md#implementation-evidence).
Activation and live proof remain outstanding; existing idle results are not
retroactively closed by these source checks.
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

Feedback changes the agent's choices about admission, timing, method and
cooperation. Business need, agreed acceptance and creator authority keep their
meaning at every workload. The following behavior is proposed; it does not
activate new instructions or capabilities in the running agents.

### Feedback available at decisions

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
A cooperation constraint includes its minimum simultaneous execution demand,
including the caller. A one-place method cannot run an inline helper simply by
retrying its caller. A mechanical recheck timestamp is not new business evidence;
changed demand, applicable capacity or an authorized method revision may justify
a new decision.

When available, page-scoped assignment counts use canonical account bindings:
root Tasks, contributions and unattributed Tasks are distinct. Missing historical
attribution does not establish an independent assignment. Distinct represented
roots can be outside the page or App, and the same root may appear on several
pages; summing those observations does not give a population total. These
provenance counts neither classify business need nor measure execution.

Shared Host execution and recipient occupancy have installation scope; controller
dispatch capacity is a separate observation. Current-root feedback belongs only
to the Host-bound Task, including its cross-App contributions. It does not
describe the roots of every commitment in a review page. Filling this root's
places does not itself delay an independently funded report if shared Host and
recipient capacity can accommodate both. Include the business method's declared
execution footprint and trusted account attribution when this distinction changes
the decision. Check actual runnable demand before claiming displacement: returned
work can still need creator review while requiring no new execution. Pending input includes
retained unanswered requests after their original triggers have been consumed,
including requests waiting for an external change.

Agents interpret these facts alongside business value, deadlines and expected
effort, using estimates only where useful. The first version needs neither a
universal pressure score nor a fixed admission formula. Existing App limits
continue to apply until per-agent and root limits are implemented.

Supply the summary in the existing attempt context when the agent considers
new work, selects what to advance or requests a contribution. A workflow must
pass relevant feedback to the agent making that decision. Reuse sufficiently
fresh context; obtain an exact scoped read when missing or stale facts could
change the choice. This adds neither a model call before each action nor an
extra admission approval. The Host still validates spending and execution
against authoritative state when the chosen operation is admitted. Ready work
should continue through ordinary dispatch while workload review occurs; optional
planning must not become another admission gate. Count planning/read overhead
when judging feedback value, as well as any saved business effort.

When a workflow calls a helper to judge a business choice, the brief should make
the helper's responsibility explicit: return the selected method and reason in
the caller's result contract. The workflow applies that decision through existing
authorized Host operations. Include the original opportunity, current wake,
relevant accepted evidence and trusted resource attribution so the helper can
distinguish them without rediscovering its contract or recovering input already
provided. A readonly discovery action supplies facts; it cannot commission work.
Use additional reads for a material missing fact within the bounded pass. A
failed helper leaves its obligation visible and follows the existing failure
and wake paths; a previously accepted result is historical evidence until a
fresh attempt records a new decision. This requires no additional model approval
or decision store.

Task count is supporting context. If `K` is used as a workload reference, crossing
it prompts review; it is not an automatic rejection or closure threshold. Hard
limits apply to spending, permissions and executing attempts (`C` per agent,
`c` across a root and its descendants, plus the shared Host limit). These limits
do not establish whether an assignment is valuable or complete. Any separate
installation intake or storage quota must return an explicit deferred or refused
disposition, preserving already accepted obligations.

### Behavior under different workloads

Interpret workload for the affected agent, assignment and resource. A busy agent
can coexist with another agent's usable capacity, while a shared Host or disk
constraint can affect both. These situations guide judgment; they are not new
Task states, Host-assigned modes or universal numeric thresholds.

| Situation and evidence | Creating or accepting work | Advancing existing work | Review and disposition |
| --- | --- | --- | --- |
| Spare capacity: usable resources and allowances remain after considering existing commitments. | Consider useful authorized improvements; no obligation to invent work. | Advance commitments and use worthwhile parallelism. | Consume results and review continuing responsibilities normally. |
| Busy: ready work competes for capacity, but delivery expectations still appear achievable. | Required work may wait as pending; optional work must justify the delay it introduces. | Choose by urgency, value, dependencies and waiting time. | Maintain bounded result review so completed work does not accumulate. |
| Overloaded: waiting or known resource shortages put commitments at risk. | Preserve required demand; defer or decline low-value expansion and make delivery conflicts visible. | Focus on the most valuable achievable outcomes; seek authorized changes to deadlines, scope, funding or capacity. | Bring sufficient results, duplicates and potentially obsolete work to creator review sooner; keep unmet obligations visible. |
| Idle because work is blocked: empty execution places coexist with missing prerequisites. | Inspect blockers and available results before expanding; independent useful work may still be admitted. | Coordinate useful recovery and run work whose prerequisites hold. | Retain genuine waits and their next relevant change; avoid repeated unchanged reviews. |

Required and discretionary describe business judgments, not new Task types.
Recognizing a required need does not promise immediate execution or a delivery
date. A pending Task still needs its creation charge; if that cannot be paid,
retain the input with its visible funding disposition under the budget policy.

Use an appropriate method and depth for the agreed outcome. Under pressure,
prefer the smallest sufficient method and defer optional depth; changing
acceptance criteria still requires creator authorization. Reprioritize at safe
attempt boundaries rather than discarding useful in-flight work on every load
change. Pressure advances review, not the definition of completion. Cancellation
or reduced scope needs the creator's explicit decision and its actual disposition.

Delegate when expertise or usable recipient capacity justifies the contribution
and coordination cost. Under pressure, avoid decomposition that merely moves
waiting work or competes for the same blocked resource. Cooperation retains the
root allowance, the recipient's limits and the caller's responsibility. A parent
with no useful independent work yields while awaiting its durable child.

### One bounded decision pass

A configured coordination Task reviews changed obligations and evidence; there
is currently no generic per-agent coordination Task or portfolio-control API.
An ordinary worker uses the same reasoning within its assignment and authority;
it does not acquire authority to reprioritize or close other assignments.

1. **Read the relevant facts.** Use the bounded summary, current assignment and
   changed evidence to distinguish runnable work, real waits, returned results
   and usable resources. Missing capacity facts remain unknown.
2. **Compare useful choices.** Consider existing promises, urgent new needs,
   older ready work, useful blocker recovery and results awaiting review before
   deciding whether discretionary expansion is worthwhile. Compare the expected
   benefit with the effort and delay imposed on other commitments.
3. **Choose within authority and allowance.** Advance existing work, accept a
   justified pending assignment, request a useful contribution, defer an
   opportunity, seek a commitment decision or stay quiet. Request changes from
   the responsible creator or funding authority when existing bounds cannot
   support delivery; the request itself does not change the commitment.
4. **Record consequential choices through existing paths.** When deferral or
   reprioritization puts a commitment at risk, retain the affected obligation,
   reason, expected delivery impact and next review event or justified time in
   its existing input, Task or caller feedback. Report estimates as estimates.
   Use ordinary result and authorized control paths for disposition; a model's
   recommendation is not a persisted priority change, funding grant or closure.
   When ending fulfilled work, the creator references an existing accepted
   result; a plan to produce evidence during this attempt cannot fulfill a
   different Task. Optional deferral may retain its input without performing prerequisite recovery.

These are reasoning steps within an existing pass, not four model calls or a
new decision ledger. Record enough to explain changed commitments without
requiring a separate report for every routine scheduling choice. Preserve
deferred demand even when it has not become a Task.

### From advice to the existing owner

An actionable recommendation needs an accountable recipient, not another Task
for the same obligation. On an ordinary authorized pass, a sender can read the
exact accepted advice and current subject, then use an ordinary Task request
addressed to an existing `appId` and `taskId`. Include the source result and
current evidence needed to judge it. This uses the existing Inbox, admission,
funding, queue and return path; it adds no dispatcher or management privilege.
The default pilot continues to record advice only. Source supports an additional
installation opt-in, `ALEX_WORKLOAD_REVIEW_NOTIFY_OWNERS=true`, alongside the
existing review opt-in. The readonly helper still returns one recommendation.
The workflow can submit that recommendation to its exact inspected Task, using
one ordinary request and Condition in the same settlement as its saved report.
A retained `nextStep` alone is not delivery or application. This mode is
implemented and locally verified, not activated.

Choose the recipient by the decision needed. A method decision belongs on the
subject's existing Task. A requirements or closure decision belongs to its
recorded creator or an explicitly authorized App/operator path. A funding
decision requires the declared funding authority. An executor name, parent link
or sponsor is insufficient to identify any of those routes. If no Task exists
for retained input, its receiving App keeps the demand and must provide the
authorized review path; do not invent a Task or transfer the original input to
make notification possible.

The initial automatic mode asks the subject's existing owner to consider its
method or remaining obligations. It does not interpret prose to discover another
creator or funding route; the recipient seeks that authority when needed. Only
`reconsider` or `opportunity` with an inspected `taskId` and concrete `nextStep`
can notify. These decisions describe follow-through: `retain` means the current
course needs no new owner action; `reconsider` asks for a method or obligation
review; `opportunity` proposes a useful optional action. Keeping required work
open does not itself mean `retain`. A method change can be worth notifying while
the Task and its original promise remain open.

The helper's per-pass schema permits at most one subject, using only the exact
Task IDs or unadmitted-input IDs supplied in that pass. The review request's own
input is not unadmitted demand. Invalid targets can be corrected within the
existing bounded helper invocation; the workflow still validates the returned
subject before saving or sending anything. This narrows the helper's contract
without changing retained review-state format or reinterpreting historical
advice as a new action. The workflow rereads the target after judgment and checks its
generation and live state. Targetless advice and pre-Task input remain retained
for their declared owner path, with no Task created as a delivery fallback.

Keep at most one notification outstanding. Other bounded reviews can continue
while that owner is busy; notification is a limited advisory channel, not a
queue promising every saved suggestion. The last notification identity is saved
beside review state. Identity derives from the exact recipient, generation and
recommendation content, so changing only observation time or unrelated workload
does not resend identical advice. Ordinary request receipts also make exact
replay safe after restart. The receiver uses its own ordinary funding and
execution limits; the coordination reserve grants it no execution allowance.
Notification can add an ordinary receiver attempt and a coordinator attempt to
retain feedback; avoiding another model call does not make those starts free.

On delivered completion, failure or progress, the workflow saves a bounded
feedback preview and exact request reference without another model call. Full
result evidence remains available through the existing App-result read. A
delivered event remains usable after its completed Condition has retired; the
Condition is a wake route, not the response's provenance. Pending feedback does
not establish application or original caller delivery. Turning notification
off prevents new sends while the same workflow still records in-flight returns;
do not replace it with an older source that cannot consume those returns.

For example, under pressure, ask the delivery owner to reconsider an optional
parallel cross-check. The owner checks current facts and may defer that method
while preserving the required delivery. It answers the advice's exact admitted
input; it does not answer the original caller or end the assignment. A request
Condition lets the sender observe that decision when follow-through matters.
Without that Condition, the receipt remains inspectable on an ordinary relevant
wake; there is no promised automatic response consumer. Retrying the same
handoff reuses its stable request identity, including after restart. A new review
of unchanged advice is not a reason to submit another notification.

If the target has closed, disappeared or cannot admit the input, return the
explicit failure to the sending Task. The sender retains the unresolved finding
and identifies the current owner or authorized route on its next ordinary
attempt. If no immediate action is useful, save a specific external wait or
justified review time. Do not reopen the target or create a replacement Task as
a delivery fallback. Acknowledgement proves consideration; only the owner's
accepted decision and any required effect verification establish application.
Closure and delivery of the original promise remain separate checks.

The App recovery fixture verifies an addressed method decision across restart,
separate settlement of the advice and original input, denied sibling closure,
and explicit closed/missing-target feedback without replacement work. The actual
workflow also runs through the Host adapter with notification enabled, covering
restart, a return during another review and opt-in withdrawal. Decisions are
scripted. A later [isolated model trial](../archive/reviews/workload-contention-comparison-20261113.md#model-decisions-through-the-actual-owner-notification)
verified two actionable recommendations through actual addressed notifications,
model owner-method choices and verified local effects. Two other reviews
retained the current course without a notification. All four original reports
remained owed until verified fulfillment, then their exact local Inbox requests
settled and App policy closed their finite Tasks. This is a small synthetic
business workflow, with locally driven input arrival and dispatch; installed
judgment, portfolio-wide follow-through and external delivery remain unverified.

Include old ready obligations in review so low-priority work cannot silently
disappear behind repeated urgent arrivals. The agent must explain continued
deferral or seek a changed commitment; queue age alone does not grant priority,
funding or a delivery guarantee. A bounded review must advance through its
selected commitments and discovery pages across passes; repeatedly inspecting
the same prefix leaves older work invisible. Retain review progress and bounded
unchanged-evidence memory in the existing accepted result, with explicit scope
and retention limits. Automatic priority aging is not required for the first
version.

When no useful authorized work remains, idle capacity is appropriate. Neither
maximum utilization nor minimum live Task count is the objective.

Relevant input, a returned result, a meaningful change in capacity or sustained
shortage of runnable work may wake coordination. Coalesce repeated notifications,
bound each review and use a cooldown after an empty planning pass. Routine
sampling and an unchanged idle condition do not each invoke a model. No separate
controller agent is needed. Limits and acceptance criteria do not automatically
change with the pressure signal.

A justified review time may revisit a delivery commitment without new capacity
evidence. Review the affected obligation once within the bounded pass; unchanged
overload alone does not justify repeatedly replanning the whole queue or
re-notifying its callers. Meaningful recovery lets the agent reconsider deferred
opportunities alongside current obligations; it does not automatically admit
all of them or restore an old priority ordering.

The expected benefit is less low-value expansion during overload, useful
exploration when capacity is spare and faster disposition of completed or
obsolete work. Feedback adds no physical capacity. If required demand exceeds
completion capacity, waiting grows until demand, commitments or capacity change;
the agent must surface that conflict. Deferring a request moves outstanding
demand elsewhere and must remain visible. Cancellation is a business decision,
not evidence of improved delivery throughput.

## Coordination that can run under stress

Shared Host enforcement covers the installation, including Apps outside a
feedback pilot. The supported first cutover uses an isolated configured
installation or a reviewed coverage plan for every enabled App, recipient and
method. Missing sponsor policy constrains new independent creation; retained
unattributed Tasks defer before a claim. A funded contribution may use its
creator's account across Apps. Unbound/direct and persistent execution remain
unsupported under shared enforcement. Enabling one App's feedback does not
promise that other unconfigured execution stays operational. Keep trusted
operator inspection and the documented offline withdrawal path available
outside constrained business methods.

A declared standing coordination Task considers input, selects useful work,
consumes results and brings finite assignments to their creator for disposition.
Use existing owner-review routes during migration. The installation declares
the accountable agent and trusted coordination role through normal definitions;
a Task name, priority or model-authored label cannot grant that role. A returned
result can wake the recorded creator's coordination Task, with repeated wakes
coalesced. App-created roots need an explicitly authorized App-policy control
path; the assigned worker never acquires closure authority by reviewing itself.

Reserve shared Host capacity for human interaction and bounded coordination.
One place is the default, but installation policy must leave enough for the
complete method: a workflow plus its inline model helper needs two execution
places, matching root and recipient limits, and two protected start credits.
For example, four total places with an ordinary background limit of two can
run that review while ordinary work is full. Reserving only its outer workflow
can start coordination without allowing a judgment. This reserve is shared,
not per agent, and gives helpers no exemption or slot lending.
Prefer human input at safe dispatch boundaries and give ready coordination
passes fair turns within their protected allowances. At each App selection and
shared controller-Host acquisition point, allow at most two human dispatches
while eligible coordination also waits, then offer a coordination turn. Background
dispatches do not reset this count; peeks and repeated wakes do not consume it.
Priority and promotion still order eligible peers, and ordinary work acquires no
coordination role from either. This preference is process-local and resets on
controller restart; it provides no wall-clock, cross-runtime or delivery guarantee.
Funding and all execution constraints still apply at admission. A one-place Host still
admits bounded ordinary work and invents no extra capacity; a two-place method
must be revised or wait for an authorized capacity change. Coordination
eligibility and accounting exist in the source increments recorded in the
implementation approach; production activation remains pending.
The declaration must cover App-local eligibility as well as Host capacity;
otherwise a saturated App can still prevent its coordination from starting.
Reserve eligibility grants no right to revise or close other assignments.
A managed readonly review must receive only Task read actions, with both its
advertised schema and invocation enforcing that scope. Returning advice cannot
publish facts, apply changes, revise or close work through the same Task tool.
Separately authorized writing executions retain their actual controls.

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
persisted. An attempt spends its charge when its durable claim commits, before
workspace preparation or executor dispatch. Controller selection, readiness
checks and spawning a worker that never claims are not charged attempts.
Preparation failure after claim is charged; release an unused reservation only
when non-start is established.
After interruption, uncertain starts retain their charge until reconciled.
Crossing a period boundary does not refund or reassign prior charges, double
grant credits or release execution capacity still held by live work.

Execution holds a capacity reservation, not a database lock. Recover that
capacity through the existing attempt ownership and confirmed-cleanup path;
reconcile credit reservations against the recorded operation. Child spending
does not mutate the root Task's execution version. There is one authoritative ledger for
the Host's runtimes; per-agent copies or a separate distributed lock are not
needed. These allowances bound work starts rather than monetary spending or
indefinite retained storage; source increments and activation gates are recorded
below.

Recovery follows active execution reservations even after the business Task
ends. A different runtime or an expired lease cannot replace a live worker.
Sessionless attempts require confirmed dead process-instance ownership; managed
execution also requires the exact primary and every helper and Bash descendant
to stop. Missing historical ownership remains occupied. App pause still permits
mechanical cleanup through ordinary dispatch capacity, without admitting paused
business work. App removal cannot orphan unconfirmed execution.

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

Use the same business inputs in each workload: an urgent incident requiring a
repair, an accepted report due tomorrow and an optional research opportunity.
Alex has execution limit `C = 2`; independent assignments have their own finite
root allowance `B`. Repeated metric evidence for the incident updates its repair
assignment rather than creating another commitment.

With spare usable capacity, Alex advances the repair and report and considers
research when its benefit justifies the resources. When busy, Alex can retain the
research opportunity for later consideration without promising to execute it.
Under overload, Alex defers the research, advances the incident at a safe
boundary and assesses whether the report deadline is still achievable. If it
is at risk, Alex reports the conflict and seeks a creator decision on scope,
deadline or priority. The report remains owed until an authorized change.

The repair requests a diagnostic contribution from Bob with `c = 1`. Its parent
yields execution while waiting, so Bob can run within that root's shared budget
and his own limits. Delegation creates no capacity or credits. Workload pressure
does not make the repair complete while Bob's required result is outstanding.
An already sufficient result can receive earlier creator review; obsolete
optional work can be explicitly cancelled with its reason and caller disposition.

When pressure subsides, Alex reconsiders the research against current commitments
and remaining credits. If it is no longer worthwhile, spare capacity can remain
idle. There is no requirement to refill a Task count.

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

### Integrate with the existing lifecycle

**Add workload accounting and feedback at shared operations, keeping one Task
lifecycle and its existing authority.** The [Task contract](../2a-design/task-resource-engine.md#controller)
owns the enduring transition and effect-preservation rules. Admission/revision,
dispatch/claim, execution/settlement, waiting/waking, ending/reopening and recovery
are responsibilities within that lifecycle. The
[source review](../archive/reviews/agent-workload-gap-review-20261108.md#lifecycle-integration-source-review)
maps their implementations and remaining convergence work; its counts describe
one source revision, not a required number of modules.

Use four integration boundaries rather than a separate workload rule in every
message, metric, schedule, Conversation or delegation adapter:

| Shared boundary | Workload behavior to add | Existing contract to preserve |
| --- | --- | --- |
| Task admission | Establish trusted root/sponsor attribution and charge actual new Task creation once, atomically with persistence. | Attaching input, revising an existing assignment and replaying an admission do not create another Task or creation charge. Delegation retains its exact creator and caller link. |
| Execution start | Reserve applicable capacity and charge the attempt with its durable claim; separately invoked helpers use the same accounting authority before their own start. | Controller checks and lost claims spend nothing. Claim and cancellation fences still apply; preparation failure after claim is charged. |
| Settlement and confirmed cleanup/recovery | Reconcile charges and reservations against the recorded operation and release execution capacity when the execution is confirmed ended. | Preserve accepted results, exact input answers and authorized closure under their transaction fences. Task closure alone does not release still-running descendants or their reservations. Uncertain starts retain their charge until reconciled. |
| Agent decision context | Supply the bounded workload summary to the agent deciding admission, next work or cooperation; use existing coordination for commitment review. | Read authority, freshness and unknown facts remain explicit. The Host enforces limits; the agent judges business need and priorities. Feedback does not add a queue, controller or automatic closure rule. |

The existing controller releases Host capacity after execution returns, while
the SQLite claim establishes durable Task ownership. Keep scheduling places,
attempt ownership and work-credit spending distinct when extending this path.
Reserve and validate through the shared Host authority; per-agent or worker
copies are observations, not independent ledgers. Helpers must use the execution
start boundary even when they create no durable Task.

Do not charge every resource-store commit. Lease renewal, session/workspace
bookkeeping, wake observations, reads and result settlement are not additional
charged work starts. A caller cannot gain credits by retrying, reparenting,
closing or reopening an assignment. The [budget policy](#budget-policy) owns the
charge units and renewal rules.

### Converge mechanics without merging decisions

Normal transitions retain the existing reconciler and fenced resource-store
commit. Conversation and other adapters preserve the shared operation's outcome
and effects, appending their authorized effects rather than replacing earlier
ones. The existing runner/control path publishes those effects after commit.
Keep App result policy and recorded-creator controls within their respective
authority; sharing mechanics grants neither worker self-closure nor automatic
ending of standing Conversation routes.

Wake persistence currently spans trigger admission, Condition observation and
exact-event persistence. Before extending the affected paths, compare their
closed-Task guards, generation/reopening checks, event replay identities, input
scope and retry pacing. Share matching wake mechanics within the caller's
existing transaction; retain the distinct relevance and authority checks of each
source. A wake records evidence for existing work; it neither creates a Task
nor replenishes its allowance. Recovery rediscovers retained work through the
same operations. Readiness indexes and event notifications are scheduling hints,
not another Task state authority.

An accepted result, its caller answer and an authorized ending must survive
adapter composition together. A failed transaction publishes none of its proposed
effects. A lost post-commit notification can delay discovery; exact stored reads
and indexed recovery must still recover the result. Preserve the shared effect
result and existing recovery before proposing another delivery queue or ledger.

Bootstrap, explicit operator repair and offline imports are named exceptions to
ordinary admission, not unrestricted work-creation routes. Give imported and
standing assignments an explicit root attribution, prior-spending treatment and
authorized allowance before enabling accounting for them. Preserve their input,
creator, accepted evidence and retry/closure history; accounting activation does
not itself authorize new work, reset retries or imply a fresh grant.

Retained work with a known creator remains in that creator's configured or funded
scope even when its recipient App is unconfigured. Require explicit attribution
before future claims, workflows or helper starts; do not silently infer a binding.
An independently owned service keeps its original account. Standing allowances
match the full App/Task identity. If another caller creates an exact requested
Task, release the retained creation hold for free attachment. Creation and that
wake commit together, and saving a hold rechecks existence. Adopting a child also
binds its root, so both exact assignments and their input holds must be woken.

### Adoption and verification

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
| Capacity | Draft source includes shared Host/recipient/root reservations, confirmed cleanup and active recovery, new-root defaults, full-method coordination reserve and real-worker one-place cooperation. Retained session continuation uses the bounded admission policy. Fresh-state initialization and externally isolated, cleaned retained-state installation have verified draft source. Operational activation and historical active adoption remain; direct/persistent sessions are unsupported under installed limits. |
| Feedback | Draft source supplies bounded readiness, retained input demand, scoped actual execution, controller dispatch and credit observations, including typed capacity and checkout blockers. App review coalesces unchanged mechanical observations. Live delivery and adaptive behavior still need adoption evidence. |
| Budget | Shared accounting foundations merged in Host #405. Draft source integrates creation, claims, seeds, primary/helper starts, caller deferrals, protected coordination and authorized root/sponsor funding changes. Offline installation preserves historical obligations without inventing spending; one-way withdrawal has verified draft source. Operational activation and historical active adoption remain. |
| Shared blockers | Draft source checks known Git checkout prerequisites before paying for an attempt and again at mutation, invalidates obsolete source/method requirements and retains scoped waiting evidence. Unknown samples and other physical resources do not establish spare capacity. |
| Lifecycle integration | The shared reconciler, fenced store and attempt runner exist. Wake writers require a focused consistency review; App closure and Conversation effect preservation merged in Host #398, with live adoption tracked separately. The workload hooks are being integrated incrementally; shared budget deferral and settlement recovery are under review, with no production activation. |

The [implementation approach](agent-task-workload-implementation.md) separates
feedback, reachable coordination, credit accounting and additional execution
limits into reviewable deliveries. No stage claims the later stage's guarantees.

First complete [idle disposition and the result path](#first-milestone-resolve-idle-work-and-complete-the-result-path)
using existing capabilities. Then deliver the bounded workload summary and trial
it through owner reviews, make coordination and resource checks reachable, review
affected wake/effect paths, and implement shared accounting followed by additional
execution limits. Repair demonstrated divergence where it is
owned; this order does not require rewriting the lifecycle or merging unrelated
modules first. No additional controller agent is required.
This proposal defines intended behavior and initial units; it supplies no new
callable API or deployed instructions. Grant sizes, bounded review cadence and
resource-specific footprint estimates remain installation choices to verify.

Verify these contrasting cases before claiming the feedback improves behavior:

| Case | Expected behavior |
| --- | --- |
| Same required incident under light and heavy workload | Preserve its need in both; pressure changes priority and delivery expectations, not acceptance by Task count. |
| Same discretionary opportunity under light and heavy workload | Consider expansion when useful capacity exists; under pressure require enough value to displace existing work. |
| Busy workload becomes overloaded, then recovers | Surface endangered commitments, defer optional expansion and reconsider it on meaningful recovery; avoid repeated whole-queue replanning or automatic admission. |
| Idle execution with blocked assignments | Review actual blockers; do not infer missing business work from low utilization. |
| High backlog with an incomplete Task and an already sufficient result | Keep the unmet obligation; bring sufficient evidence to creator review without lowering criteria. Cancellation remains a separate disposition. |
| Repeated urgent arrivals while older required work stays ready | Make continued waiting and delivery conflicts visible during review; obtain an explicit commitment decision rather than silently abandoning it. |
| Burst of repeated metric observations | Reuse accountable work where appropriate, preserving exact caller obligations. |
| Equivalent new assignments through ordinary input, Conversation, event mapping and delegation | Use shared admission/accounting mechanics with one creation charge per new Task and no charge on replay; retain each route's real authority, root attribution and caller link. |
| A Condition, exact Event and recovery scan rediscover the same work, including after closure or reopening | Preserve evidence and deduplication, respect the closed Task or current generation and retry pacing, and spend no new creation/start credits merely for waking. |
| App-policy closure and explicit Conversation controls settle together; reply persistence or notification fails | Preserve the combined effects. Transaction failure rolls back result, reply and endings; after commit, a missed notification cannot erase the stored disposition or exact caller answer. |
| Leases, session/workspace observations and result settlement update Task resources | Do not mistake storage mutations for charged starts; separately invoked helpers still pass the start-accounting boundary. |
| Nested cooperation with `c = 1`, including restart | Yield so the child can run; preserve shared charges, attribution and responsibility. |
| Concurrent claims, retries and exhausted credits | Enforce `B`, `C`, `c` and Host bounds without double charging; retain visible work and bounded creator coordination. |
| Parallel helpers, including an awaited helper with `c = 1` | Charge each started helper. When no place is available, defer before helper start rather than deadlock; durable contributions yield and resume. Slot lending is a separate later extension. |
| Parent closure while a child remains unresolved | Preserve child obligations and active reservations until their actual disposition and cleanup. |
| Several Tasks hit one full filesystem or access blocker | Retain separate obligations and one shared blocker observation; avoid repeated unchanged model judgments and allow unrelated work. |
| Ordinary budget exhausted or a new worktree cannot be created | Bounded authorized coordination can use its protected allowance and existing workspace; do not claim a decision if storage cannot persist it. |
| A blocker recovers after retry exhaustion | Deliver the new evidence to the responsible agent without resetting retry counts, credits or caller obligations. |
| Daily boundary, restart and uncertain execution start | Grant once, retain in-flight reservations/charges, preserve finite root spending and renew only declared standing allowances. |
| An idle finite result and an idle standing Task | Bring the finite result to its creator for disposition; retain the standing purpose and declared wake. Neither is ended by phase alone. |
| No useful work after a planning pass | Stay quiet until relevant input or a justified review time. |
| Missing or stale workload facts, including inside a workflow | Deliver relevant feedback to the deciding agent; make a scoped read when material, disclose unknowns and let Host admission enforce actual bounds. |

For a behavioral trial, hold the business inputs, acceptance and authority fixed
and vary competing load or usable resources. Compare the same workload with and
without the proposed feedback. Capture the facts the agent received, its chosen
action and reason, the recorded caller disposition and subsequent outcome.
Inspect required delivery and ready-work waiting time, discretionary effort,
result-review delay, repeated blocked attempts and coordination cost. Include
repeated observations to see whether unchanged pressure causes churn; one good
decision does not establish a stable policy.

The expected change is less low-value expansion during overload and worthwhile
expansion when usable capacity exists, with unchanged completion criteria and
visible required obligations. Persistent required demand above capacity should
produce an explicit delivery conflict, not a claim that feedback stabilized the
queue. Smaller Task counts, more closures or higher utilization alone do not
establish improvement. These are proposed verification cases, not tests run,
behavioral evidence or deployment claims. Reconsider additional control
machinery only if observed decisions or resource enforcement remain inadequate.
