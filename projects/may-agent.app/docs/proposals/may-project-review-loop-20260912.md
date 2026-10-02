# A recurring task to review and improve May

**Supports:** [Agent improvement: an optional App integration](../2a-design/practice-learning-loop.md). Trials an ordinary Task for choosing worthwhile improvements from design and operating evidence.

**Choice basis:** [Applicable philosophy and convention](../1-principles/evolution.md#promotion-tests); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Design status:** Proposal for review, September 12, 2026.
**Implementation status:** A bounded pilot is authorized. Preliminary isolated
trials and a local-container navigation correction completed. Extending original
Task **`a447535d`** exposed lost scope and an unconsumed timed wait; that retry
was stopped. Corrected ordinary periodic Task **`3644b5a1`** completed three
reviews and two timed waits, with two extra clock-echo attempts. Its final state
is up to date with no remaining waits. The
[pilot record](../archive/reviews/may-project-review-pilot-20260912.md) separates
those execution surfaces and records outcomes and limitations. No standing
App review schedule or standing agent guidance was activated.

**Current contract:** future trials must choose Task `reviewAt` explicitly for
scheduled agent reviews. The Condition intervals recorded below describe the
older pilot Host; they do not schedule agent execution on the revised
[Task contract](../2a-design/task-resource-engine.md#conditions).

Use one ordinary May Task to periodically compare May's intended design,
implementation and observed execution, then carry the most worthwhile
authorized work through verification. Keep its findings and continuation in
that Task, and use the Host's existing timed-wait mechanism for later reviews.
Give it a concise method and current facts before adding orchestration.

The specific Host Operations `runtime/platform-owner-review` Task and its App
schedule are optional existing policy, not prerequisites. The first version
of this proposal overfit the design to that implementation. The local pilot
establishes a simpler starting point and exposes the lifecycle details that
still need care before wider adoption.

The [research record](../archive/reviews/may-project-development-method-20260912.md)
grounds this proposal in three Codex sessions, 23 PRs and their discussions,
current design documents, and the App's implementation. The
[design philosophy](../1-principles/design-philosophy.md) remains the authority
for tradeoffs; this proposal applies it to recurring work.

## Goal and sufficient first result

Help Hao get a simpler, dependable, understandable May with fewer repeated
reminders. Review must result in useful progress: a verified fix, a concrete
decision, a resolved uncertainty, or a justified decision to leave things alone.
It should also expose the difference between accepted plans, landed source
and what users are actually running.

The first useful milestone is one ordinary Task that can receive the
method, review current facts, continue an existing candidate across a wake,
and either verify a bounded authorized improvement or return a reviewable
decision. A later ordinary review must check its effect and use any relevant
lesson. This does not require an autonomous project manager or a complete
catalog of all possible checks.

Success means fewer missed obligations, repeated explanations and unnecessary
patches at reasonable compute and review cost. Counts of findings, reports,
commits or PRs are diagnostic activity, not success targets.

## Choice of mechanism

| Option | Benefit | Cost and limitation | Recommendation |
| --- | --- | --- | --- |
| Keep reviews manually initiated in conversation | Lowest implementation cost; excellent for open-ended discussion | Hao still notices drift and asks for follow-through | Keep for collaborative design and as the pilot baseline |
| Ordinary periodic Task owned by May | Already works in the local container; retains context and uses generic Task waits/recovery | Must make cadence, scope, useful results and stopping conditions explicit | Start here |
| Reuse Host Operations owner-review | Can combine review with that App's existing platform responsibility when active | Broader authority and retained work; currently excluded from the local container | Use only when that ownership actually serves the assignment |
| Add a dedicated review workflow or controller | Can enforce repeated collection or validation steps | More state, stale snapshots and duplicated process before the useful sequence is known | Consider a small helper/workflow only after repeated failures or measured collection cost justify it |

May can own and execute the ordinary review Task, as it did in the local
container pilot. An App owns its assigned outcome; that does not require a
dedicated App for every subject reviewed. Host Operations retains its specific
deployment/runtime authority. Review findings can lead to scoped work at that
owner when needed, without making all review depend on enabling that App.
Choose a specialist only when its expertise, authority or workflow helps.

## Ordinary periodic Task and existing wake path

The [Task contract](../2a-design/task-resource-engine.md#one-lifecycle-baseline)
uses one lifecycle for finite work, maintenance and Conversation. A Task can
retain its result and wait for a later review. `achieve` and `maintain` are
intent labels, not different lifetimes or scheduling capabilities. Periodicity
does not require a new Task type, a long-running agent or a new scheduler.

One review proceeds as follows:

1. Read the same Task's previous result, current assignment and changed facts.
2. Complete one bounded useful review/fix, or record why no change is warranted.
3. Save the outcome, unresolved work and references through the Task result.
4. While the periodic assignment remains active, return a timed wait using the
   existing Condition/review-deadline mechanism. The Host releases the worker
   and later reconsiders the same Task. Relevant new input can also wake it.
5. On a timed wake, consume the actual elapsed-time observation for that exact
   wait before requesting another one. At the assigned end, return the assessment
   without scheduling another review and verify that no old wait remains runnable;
   retain or close the Task through the ordinary owner path.

This is an approximate review interval, not a promise of exact wall-clock cron
execution. A timestamp in report prose alone does not schedule anything: verify
the accepted wait and its later attempt through Task readback. Preserve unrelated
external waits if a comment or timer triggers another review.

The retry established a crucial distinction: a review deadline wakes the Task
but does not make its Condition true. Returning `converged` while leaving an
unknown overdue wait caused an immediate extra attempt. The corrected bounded
trial uses the existing fenced event capability to publish an exact
`time.reached` observation after verifying UTC; the ordinary Condition tracker
can then satisfy the wait. No wall-clock observer was installed. This sequence
completed the bounded trial but produced an extra model attempt for each
self-addressed clock observation. Both echoes were handled safely, and no wait
remained after final settlement. The subsequent source candidate consumes the
current attempt's exact self-published receipt with its accepted result. Its
portable regression completes three reviews in three attempts through both the
executor and `tasks.publish` interfaces; installation remains separate. The
[pilot follow-up](../archive/reviews/may-project-review-pilot-20260912.md#source-fix-and-agent-behavior-follow-up)
owns candidate verification and the behavioral assessment. Durable owner
revisions remain a separate gap. These details should not become the user's
task-creation burden or require a special project-review service.

The running container already demonstrates this pattern with May task-hygiene
Task **`9071edf7`**, `goal/app_224ef63e-ddd6-4f4b-b159-26de9dd60107`.
Readback on September 12 showed two accepted review attempts about four hours
apart and a new four-hour Condition review interval (`reviewAfterMs: 14400000`).
Its intent label is `achieve`. This is evidence that the generic mechanism is
available; it does not prove the quality of project review or exact timer cause
for every attempt. The hygiene Task remains a separate existing responsibility.

The pilot's placement check found that the local container selects only May
and Scout, excluding Host Operations. Its retained owner-review row is not
live registration. No Host Operations activation is needed for an ordinary
periodic review Task. Put the selected cadence, scope and end condition in the
durable assignment. Merely attaching a new `goal` input with `targetTaskId`
does not revise the Task intent: in the failed retry, its next timer prompt still
contained the superseded one-pass constraints. The previous result carried the
continuation, but the executor followed the original instructions. A changed
assignment needs a supported owner revision, not reliance on a one-time steering
message or permission inferred from its own result. The stopped Task is closed;
the corrected trial uses one linked Task with the proper assignment from creation.

For comparison, [Host Operations app.ts](../../app.ts) maps `owner-review` to
`runtime/platform-owner-review` and declares an eight-hour review plus daily
heartbeat, both publishing `project.tick`. Those are domain policy choices.
The existing [owner-review workflow](../../agents/tech-lead/workflows/platform-owner-review.ts)
is not selected by ordinary owner-review mapping. None of these names, intervals
or workflow files needs to be adopted for the generic periodic Task.

Findings, experiments, checks and PRs are work within this responsibility.
Create a separate Task only for an explicit independent outcome with its own
authority boundary or external wait that warrants separate ownership. A timer,
a new comment, another attempt, or one more finding does not create a new goal.

GitHub review/CI notifications are useful wakes when an existing observer
actually delivers them. The App subscription alone does not establish a working
GitHub observer. Initially, reconcile GitHub on normal wakes using read-only
queries; use the Task's next review deadline as fallback. Consider the existing
[observer proposal](observer-feedback-and-resource-conventions.md) only if
measured delay or repeated polling makes that integration worthwhile.

## The review method

### 1. Refresh the facts and resume the obligation

Read the current goal, current instructions, accepted Task input/result, open
candidates and waits. Use the last review to find references; verify mutable
facts again. Check whether someone else has already implemented, superseded or
taken ownership of a finding before starting work.

Keep these distinctions explicit for the change being judged:

| Question | Source to check |
| --- | --- |
| What behavior is intended? | The owning design document and latest scoped human decision; distinguish accepted contract from proposal |
| What is in this checkout? | Repository, branch, commit and relevant uncommitted changes |
| What has landed? | Current remote main and merge revision |
| What is being proposed? | Open PR head, diff, discussions and checks for that revision |
| What is loaded? | Installed Host/App/agent source and activation facts, where available |
| What actually happened? | Relevant Task/attempt, durable result, trace or observed scenario |

Bind each revision to its repository. The first container report accidentally
queried the outer workspace remote and labeled its revision as May Host main.
Use an explicit repository path or URL for each lookup, then check whether the
object already exists locally before declaring the tree unavailable.

Unknown deployment status stays unknown. Do not infer it from Git, a successful
reload request, an old proposal's status paragraph, or a daemon socket merely
answering. Refresh a failed read before reusing stale data as a current fact.

Begin with deltas and unfinished work. When there is no urgent delta, select
one neglected boundary for deeper review using the existing project notes.
There is no need to reread all history or scan the entire repository on every
review. Periodically revisit the whole model when the accumulated changes
suggest a boundary has shifted.

### 2. Review from outcomes to mechanisms

Use three connected views:

- **Design:** Does the current contract serve a real scenario? Could a simpler
  guarantee, removable capability or existing path satisfy it? What ability
  would be lost? Are two owners or lifecycles doing the same job?
- **Implementation:** Does the actual path match that contract? Trace its
  callers, data and failure behavior. Look for duplicate authority, obsolete
  compatibility, misleading names, unowned scripts and tests that exercise
  copied logic rather than shipped behavior.
- **Execution:** Did admitted work run, remain steerable and produce the
  promised result? Are there stale waits, repeated failures, unused guidance,
  unobserved results, or claimed outcomes that exceed the facts?

A suspicious file size, failing metric or review comment is a lead. Record
the concrete case and consequence before calling it a defect. The findings
from earlier cleanup proposals must be checked against today's PRs; already
fixed findings are not a fresh backlog.

### 3. Choose the smallest worthwhile next move

Explain the comparison in a few sentences: unmet outcome, available facts,
simplest sufficient option, accepted cost or limitation, and what would change
the decision. Use the [existing tradeoff rules](../1-principles/design-philosophy.md#how-to-decide-a-tradeoff),
not a new numerical scoring system.

Prioritize a real broken obligation, lost result or costly repeated failure
over cosmetic cleanup. Prefer finishing useful accepted work to opening more
candidates. Value a simplification by the maintenance and failure paths it
removes, accounting for migration and capability lost.

| Situation | Useful action |
| --- | --- |
| A current candidate already addresses the need | Resume its verification, review, integration or follow-up |
| Clear defect, understood remedy, within current authority | Make a focused fix and verify it |
| Valuable behavior change with a tradeoff still to settle | Produce a concrete proposal: before/after, alternatives, cost and acceptance |
| Important claim with insufficient facts | Run a bounded investigation or experiment with a stated question |
| Motivation removed by another design or merge | Retire the finding/candidate and retain useful learning |
| No change earns its cost | Record a brief no-op and the fact that would justify revisiting it |

An open implementation PR does not automatically block an independently
authorized documentation correction. The preliminary pilot needed this
operator correction. Keep volatile inventories and candidate facts at their
owning proposal where practical, with navigation pointing to it; repeatedly
copying counts and PR heads creates another review obligation.
Historical trial counts can still establish what a particular experiment
exercised. Keep their revision and limitations; do not turn the navigation lesson
into a blanket instruction to delete numbers.

If the fix keeps growing, reconsider the contract before adding machinery.
Keep an expensive corner case separate when the common path can progress and
the accepted outcome permits that limitation. Do not quietly drop agreed work
because one subset is easier.

### 4. Implement and review the actual candidate

Use an isolated checkout based on current main for source work; preserve
concurrent changes. Read the repository's current AGENTS and CONTRIBUTING
instructions. A workflow named `verified-coder` is not proof that isolation,
verification and integration occur; the
[workflow review](workflow-practices-review.md) records those boundaries.

Write the smallest useful change, update the owning contract when behavior
changes, and test the failure or scenario that motivated it. Run required
repository checks before readiness claims. Tests should invoke actual behavior:
the historical adapter rollback needed a rejected reload; the escaping dispute
needed a displayed-text browser assertion. Do not add tests that merely restate
an implementation or repeat broad tests without a reason.

Treat every review comment as a claim to investigate. Accept, partially accept,
or reject it with a trace or reproduction. An accurate observation can still
suggest the wrong remedy. If the candidate changes, reevaluate relevant checks
against its new revision. Update the PR title and body around the final result,
including remaining limits and Host/App integration order where applicable.

### 5. Continue across waits and verify the outcome

Keep a compact continuation note in the current Task result/state through the
supported task interface. It needs only the current conclusion, candidate and
fact references, next useful action, exact external waits, and relevant
authorization. This is a content convention, not a new runtime schema.

For example, while waiting for CI on a PR revision, a new review comment can
wake the same task. Re-read the comment and current head, investigate it, and
preserve any still-relevant CI wait. If a fix changes the head, old passing CI
does not certify the new revision. A wait for one PR also need not stop useful
work on another existing candidate.

Use current Task outcomes, typed actions and Conditions; let the Host apply
them. Do not write the Task database directly or copy old child-return and
`needs-owner` protocols from shared guidance. A failed attempt records a
failure and its useful facts; it does not close the ongoing responsibility.
The App/assigning owner controls closure under the
[current Task contract](../2a-design/task-resource-engine.md).

On an unchanged timer wake, a quiet no-op is enough. Do not send another owner
message for the same obligation. Follow the assigning App's actual delivery
rules; where delivery is authorized, inspect prior receipts before repeating it. Escalate
when a material decision, missing information or external action is actually
needed, with a concrete reviewable result and reason.

After integration or activation, check the promised behavior at the relevant
boundary. “Merged” can finish source work; it cannot prove deployed behavior.
If the result requires deployment, retain that follow-up with its actual owner
and authority. Do not reopen completed source work just because activation is
still pending elsewhere.

## Scope and authority

Hao subsequently authorized a bounded pilot with local may-agent. That covers
the finite trial and its scoped documentation work, not the proposed standing
service or production changes. For the pilot,
carry the actual assigned scope into the existing task and continue all work
it already covers. Do not repeatedly ask about routine investigation or fixes
that the user has authorized.

Historical preferences are guidance for judgment. “Breaking changes can be
acceptable” does not authorize arbitrary removal, and “wait for human review”
on two historical PRs does not impose a new permanent approval gate. Apply
current session authorization and applicable repository rules. Host source
work follows its existing PR/check/review process; publishing, merging,
deployment and changes to standing agent behavior have their own actual scope.
Prepare the concrete candidate and validation before any required decision.

Open design discussion stays in conversation. The recurring task can bring
facts and a proposal back to that discussion without taking the conversation
away from the human. It should continue independent authorized work while a
specific decision is pending.

## When the review finds a problem in its own execution

### Duplicate delivery must be harmless

Hao clarified the general requirement after the pilot: workers should avoid
unnecessary duplicate wakes, and callers must handle repeated notifications
safely. Duplicate events are expected. This follows the existing
[execution-feedback contract](../2a-design/execution-feedback.md#execution-feedback-and-agent-wakes);
it is not a periodic-review-specific instruction or an exactly-once delivery
promise.

The producer publishes a result or fact with a stable identity and reuses it
when retrying the same publication. Reporting something already known to the
active attempt should not create an automatic self-wake. A caller's no-op must
not produce a new notification merely to acknowledge the duplicate and thereby
start another loop.

The receiver uses durable current state to decide whether any work remains.
Already handled input can be acknowledged without repeating the review, action,
notification or progress increment. Exact duplicate identities should be handled
by the Host before a model call where the existing admission state permits it.
Different events may also describe the same already-handled fact; the App owns
that judgment. A worker that is nevertheless invoked must be able to return a
safe no-op. Preserve unrelated input and waits; a Task having a previous result
does not make all later input a duplicate.

Record handled input together with the accepted state change. If execution is
interrupted before that commit, recovery may deliver it again. An external
action that may already have happened needs its stable action key or a check of
its result before retry, rather than an assumption that event deduplication
prevents every repeated effect. Reuse existing Task results, input identities
and operation evidence instead of adding another work lifecycle.

The correctness requirement is **no repeated effect or false progress from a
duplicate**. Avoiding unnecessary model runs is a separate efficiency goal.
Three reviews in three attempts is a useful regression for the controlled
self-echo case, not a universal invariant for a system that permits retries,
concurrent input and duplicate delivery. A bounded extra attempt that records a
no-op can be correct; repeated self-triggering without new work remains waste
worth fixing.

Host [PR #175](https://github.com/hao1939/may-agent/pull/175) now covers the
shared Host mechanism: exact self-publication receipts and durable receiving
Task identities. Regressions reproduce the former failure during execution,
after acceptance/restart, and when a real child settles before its parent relay.
The owning design now records [duplicate handling](../2a-design/execution-feedback.md#duplicate-delivery-and-safe-reconsideration),
[Task input](../2a-design/task-resource-engine.md#event-input-and-checkpoints),
and [storage/upgrade limits](../2a-design/storage.md#record-ownership).
This candidate does not deploy the fix or establish semantic deduplication for
every App. A later ordinary review should assess both accepted outcomes and
execution cost against the source actually installed.

### Review outcomes and execution cost separately

In the bounded trial, May completed three reviews and safely handled two extra
wakes. The operator traced the avoidable self-echo and initiated the Host fix.
May's report-only scope explains why it made no source patch; it does not define
the duplicate-handling contract. The self-addressed clock recipe came from the
operator's assignment. Its report should have distinguished the successful
outcome from the extra execution cost, without treating every duplicate event
as a new defect or asking the owner to decide every harmless no-op.

For the next comparable case, use existing Task, attempt and event evidence to
compare intended progress with actual execution. Record the exact triggering
fact, preserved result/wait, observed effect and uncertainty. A repeat wake is
not another completed review. Preserve the original deadline, accepted work and
stable publication key; do not repeatedly publish, broaden scope or schedule
more work just because another attempt started.

If the assignment covers source repair, reproduce the defect on current source,
make the smallest fix at the owning layer, test the broken contract and relevant
recovery cases, then follow the existing PR process. If repair is outside scope,
retain a concrete proposal and the next action in the same responsibility's
result/report. Seek only the missing decision when one is necessary. Do not
create a Task per anomaly, edit storage directly or deploy a source candidate
as part of diagnosis. A recurring defect that defeats the pilot's work or cost bound should
be surfaced for an owner decision rather than hidden behind repeated success
summaries. The owner controls revision or closure of the assignment.

Verify improvement against the original observation: a portable source check
can prove removal of the redundant attempt in its fixture; an installed trial
is needed to establish that behavior in the container. Updating this proposal
is retained learning, not proof that May adopted it. Test adoption in a later
bounded case without supplying its diagnosis in advance.

## Put each durable result where it belongs

| Result | Home |
| --- | --- |
| Current obligation, continuation, waits and accepted result | Existing Task resource and linked input/result facts |
| Accepted design or limitation | Its owning principle/design document |
| Unresolved design choice or implementation plan | One linked proposal; update it as the candidate changes |
| Completed experiment or historical rationale | Dated review/archive with question, method, result, limits and source revision |
| Review discussion and candidate validation | The PR, linked from the relevant Task/proposal |
| Reusable judgment method | Existing relevant skill, or a small scoped skill if reuse proves necessary |
| Repeated deterministic operation | Maintained test, tool or workflow at its actual owner |
| One-off scripts, raw transcripts and fetched PR packets | Temporary/ignored research data; retire after extracting useful facts |

The [script retirement proposal](poc-retirement-and-knowledge-20260912.md)
already owns the detailed disposition of PoCs and reusable scripts. This task
should follow that decision rather than create another archive of runnable
experiments. A regression belongs with the maintained code it protects; a
reusable operational command needs a clear purpose and owner.

Capture a preference as a short decision with its source, scope and exception
only when it helps later work. When evidence changes, revise or retire it.
Do not feed all session history into every review. The research record and
canonical design provide an entry point; retrieve the relevant original turn
or PR discussion when interpretation matters.

## Small implementation slices and pilot

These remain the broader adoption plan. The
[dated pilot](../archive/reviews/may-project-review-pilot-20260912.md) records
the narrower work actually performed: one preliminary comparison, operator
correction, isolated continuation/timer wake, and a visible container trial.
It does not establish all five steps. Each step should leave a useful result
even if the next step proves unnecessary.

1. **Establish the actual path.** Inspect the ordinary May Task and loaded
   definitions. Trace the assigned input to a fresh executor and accepted result,
   then an accepted timed wait, later execution and consumed wait on that same Task. Preserve
   existing inputs and active work when extending the bounded pilot. Acceptance:
   the executing agent can identify the assigned outcome and method from the
   real input/context path, without an operator pasting missing steps midway.
2. **Teach only what is missing.** Start with the draft task instruction below
   and links to canonical guidance. Align stale lifecycle instructions actually
   selected on this path. Reuse applicable investigation and verification
   guidance already available to the executor; keep project-specific explanation local. Acceptance:
   a fresh ordinary execution selects/reads applicable guidance and produces
   a valid current Task result. Updating a file or catalog is not adoption proof.
3. **Compare judgment on a small case set.** Run the same available facts with
   ordinary current guidance and with the proposed method, at comparable effort.
   Keep the historical disposition and later facts out of the worker's input;
   use them to assess its reasoning, not to force the same answer. Use temporary
   fixtures/reports, not a new benchmark platform.
4. **Follow one real scoped improvement through.** Prefer an existing worthwhile
   candidate over inventing work. Under its actual authorization, review/fix,
   validate and continue across a wait. Record source integration separately
   from any activation. Acceptance: a concrete outcome plus an honest account
   of what remains, with no duplicate Task or unnecessary owner notification.
5. **Observe recurrence and learning.** Observe at least two later ordinary wakes,
   including one with no useful change, before considering wider automation.
   Check whether a relevant correction helps the next comparable case and
   whether the review consumes less human attention. If repetitive collection
   is the expensive part, extract only that helper; if judgment is poor, fix
   context or guidance before encoding more process.

The corrected local trial now covers two timed wakes, unchanged-file reviews,
preservation of a future wait on an early wake, and final quiescence. It does not
prove independent task selection, unattended scope changes, PR/CI continuation,
or reduced human attention. The failed extension and two clock-echo attempts
remain part of its cost. Keep the bounded Task approach while resolving those
specific gaps; do not treat the three reviews as approval for indefinite rollout.

Suggested cases for step 3:

| Case | What good behavior demonstrates |
| --- | --- |
| #154's recovery-budget candidate after the #158 design change | Notices supersession and avoids implementing an unnecessary feature |
| #145's rejected adapter after rollback | Reproduces the real defect and fixes the publication boundary |
| #174's double-escaping allegation | Evaluates the reviewer independently and verifies visible behavior |
| #172's read-only/WAL contract dispute | Distinguishes an honest sufficient contract from extra machinery |
| Local checkout behind remote main; deployment unknown | Reports separate facts and avoids a duplicate/stale fix |
| New comment while CI for the current candidate is pending | Makes progress while preserving still-relevant waits; validates the new head if it changes |
| Interrupted attempt followed by another wake | Resumes the same responsibility using durable context without duplicating work or delivery |
| Quiet review with no worthwhile issue | Produces a justified no-op without manufacturing cleanup |

Assess useful outcomes, missed or invented defects, unnecessary patches,
quality of tradeoff explanations, human corrections/reminders, repeated
notifications, time, compute and review effort. Separate mechanism failures
from bad judgment and unavailable facts. An eight-case pilot is evidence about
those cases, not a reliability percentage. Record the baseline before setting
targets; keep the method only if its benefit earns its recurring cost.

If guidance does not improve judgment or continuation, revise or remove it.
If recurring reviews mainly repeat stale summaries, narrow the input and cadence
before adding another controller. If the installed Task path is broken, repair
that specific gap with a focused proposal/fix; do not build a second scheduler.

## Draft kickoff instruction

This is text for an ordinary May Task assignment, not a new input schema or an
executed command. Supply scope, authority, review interval and pilot end condition
with the assignment and verify delivery through the admitted-input path in step 1.

> Review and advance the May Host project using the current design philosophy
> and this proposal. Start by reading current Task inputs/results, active work,
> relevant code, PR discussions/checks and available runtime facts. Distinguish
> accepted design, local source, remote main, PR head, loaded source and observed
> behavior. Resume an existing worthwhile candidate before opening another.
>
> Choose the smallest useful movement: investigate, propose a concrete tradeoff,
> make and verify an authorized fix, retire superseded work, or record a no-op.
> Question an expensive contract before adding machinery. Treat review comments
> as claims to verify. Preserve the ability and user scenarios that matter.
>
> Continue within the authority of this assignment and existing accepted work.
> Keep discussion interactive; bring back only decisions that need the human.
> Follow repository review rules and keep integration and activation claims
> separate. Preserve concurrent changes and continue independent work during
> external waits.
>
> Return the actual result through the supported Task interface: what changed,
> facts that establish it, important limits, current candidate references and
> the next useful action or external wait. Reuse this responsibility across
> wakes. While the assigned periodic pilot is active, use the supported timed
> wait for its next review and settle the exact elapsed wait on its later wake;
> stop scheduling after its stated review count or end time. Preserve the bounded
> assignment and completed-review count in the durable context. At a later review,
> check whether the improvement helped and retain only
> the learning that makes future work better.

## Checks performed for this proposal

Research sources and the source mapping are recorded in the
[dated review](../archive/reviews/may-project-development-method-20260912.md).
At proposal creation, two existing App mapping tests passed with 16 assertions.
`bun run check:may-design` passed with zero errors or warnings;
all 21 local links in the two new documents passed a separate path/anchor
check. The new navigation links also resolved and whitespace checks passed.
Subsequent model executions, task admission, failures and bounded validation
are recorded in the pilot review. The preliminary explicit-method arm showed
no initial judgment advantage, so there is no basis yet for a wider rollout.
