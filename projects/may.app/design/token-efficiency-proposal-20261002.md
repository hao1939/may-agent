# Prevent repeated execution and unnecessary reviews

**Supports:** [May metric follow-through](metric-condition-follow-through.md) and [system observability](../../may-agent.app/docs/2a-design/metrics.md). Reduce the cost of delivering useful outcomes while keeping unfinished work accountable.

**Choice basis:** [Value and cost](../../may-agent.app/docs/1-principles/design-philosophy.md#value-and-cost); [agent decisions and infra execution](../../may-agent.app/docs/1-principles/code-vs-data.md); [safe retry ownership](../../may-agent.app/docs/2a-design/system-boundary.md#retry-and-recovery-ownership).

**Design status:** Proposed efficiency follow-up and retained October 2 audit.
**Implementation status (2026-10-03):** Mixed; use the disposition and dated rollout evidence below. No new usage comparison has established sustained savings.

## Current disposition

| Slice | Source status and remaining evidence |
| --- | --- |
| Terminal helper completion | Host [#281](https://github.com/hao1939/may-agent/pull/281) is merged. Retain the acceptance cases below as regression requirements; do not reimplement the original defect. |
| Review clock | Apps `95e142b3d0` and current `metric-review.ts` use the immutable report completion time (`payload.createdAt`) plus the interval. Reused publication keeps that time. No new `reviewedAt` field is needed. A long publication delay can legitimately leave the next review due. |
| Meaningful reconsideration | Conditions and retained investigation identity exist. Better choice of wake predicates and measured review eligibility remain App policy and trial work. |
| Context size | Host [#288](https://github.com/hao1939/may-agent/pull/288) fixes a separate full-history Codex resume cost. It does not prove that optional Conversation reference enrichment is bounded or cheaper. Assess that path separately. |
| Continuing detection | The [October 3 inventory and October 4 implementation](metric-coverage-audit-20261003.md#october-4-implementation) supply catalog cleanup and two effort observations using existing invocation usage. Source verification covers report publication and accepted owner judgment. Effort alerts remain disabled for calibration; activation and a runtime comparison are pending. |
| Repeated delivery and correctable output | [Host `7b416af40`](https://github.com/hao1939/may-agent/commit/7b416af40) and this Apps companion add durable GitHub fact identity, groups same-result Topic returns, and validates direct-agent results before terminal finish. The owning [observer contract](github-pull-request-observation.md), [Conversation contract](../../may-agent.app/docs/2a-design/conversation-execution.md#routing-and-authority), and [completion contract](../../may-agent.app/docs/2a-design/execution-contributions.md) describe behavior and limits. |
| Duplicate hygiene timers | The companion removes the hard-coded App timer for the standing hygiene Task. Its already chosen `reviewAt` owns the cycle; the agent explicitly selects the next review. This preserves the existing Task and deadline without a state migration. |

The remaining sections retain the audit baseline and original implementation
plan. “Today” in that narrative means the October 2 audit, not the source state
after these fixes. Source integration, installed behavior and measured benefit
remain separate evidence.

## October 3 source follow-up

[Host `7b416af40`](https://github.com/hao1939/may-agent/commit/7b416af40), under
merged in [#295](https://github.com/hao1939/may-agent/pull/295), groups exact result
deliveries, runs pure App validation before terminal finish, and clears redundant
clock wakes when an attempt settles. The accompanying Apps revision supplies durable GitHub event
identity, actionable Condition examples, one hygiene timer and the updated
contracts/manual. Its exact revision is recorded in the Host PR. Integrate Host
first, then activate the Apps companion through the ordinary release path.
The App changes remain compatible with the older Host, but correction during
finish and grouped result delivery require the new Host.

The connected fixture runs the real observer, event journal, inbox and Task
admission against synthetic HTTP responses. Observer reconstruction suppresses
unchanged republication, a later provider transition arrives, and failed
publication is retried. A scripted model corrects one rejected finish in the
same invocation and stops after acceptance. Conversation tests retain one result
for 15 linked Topics, preserve independent Requests, survive reopening, honor
legacy receipts and deliver to late links. Query-plan coverage verifies indexed
receipt lookup; metric follow-through tests retain quiet samples and owner wakes.

The runtime batching check supplies three pending human messages to one agent
call. Ten wake signals during that call cause one later state check and no
additional agent call, including after storage reopen. Existing batching uses
no collection timer. A new regression first reproduced the extra attempt caused
by a clock wake during execution; settlement now clears that wake while keeping
unseen facts and allowing a later scheduled review. The grouped-delivery fixture
also covers 105 Topics across the 100-link limit and restart. Validator-only
callers activate the same correction path without needing an output schema.

These source and fixture results do not measure live token savings, prove agent
comprehension, or rewrite already pending duplicate inputs.

## October 3 rollout verification

After explicit operator authorization, merged Host #295 was deployed at
07:37 Shanghai. The exact receipt is
`/app/projects/may-agent/.state/deploy-receipts/merged-295-metric-handoff-20261003.json`:
source `8fa6eddc2f540ae0bf68ff1327b773397661a986`, phase `succeeded`, healthy,
and `duplicateDeploy: false`. The receipt, staged provenance and live binary
agree on SHA-256
`74057dfb0e6e68478a9db05c23ccd91221c0e75d1d72f4db7f864fe6c51c8f72`.
All three long-lived services were running and HTTP readiness passed.

The combined #295 App companion and receiving-owner metric fix were merged
locally as `2b9e2d5b7e1c8740d0de7127748833e454b5c874`. A source-pinned normal
reload returned that same commit in `runtime.reload.finished` event 6632518;
the active immutable release manifest and metric workflow bytes match it.
Evidence is retained under `/app/.state/metric-handoff-rollout-20261003/`.

Before integration the combined May suite passed 176 tests with one optional
skip and no failures; App type and design checks passed. After merging the
concurrent equivalent source fix, the 24 affected tests and design checks passed.
The regressions exercise real Host settlement, same-input recovery, restart and
quiet samples with scripted owner decisions. They do not prove model quality or
sustained savings. The original replaying Task had already been moved to an
agent executor by May; its later convergence cannot be attributed to this
workflow activation. No synthetic repair event or direct Task-store mutation
was used to claim live recovery.

At 07:48 Shanghai, merged [#296](https://github.com/hao1939/may-agent/pull/296)
was deployed as Host `4031c7027c25475229d61cab11dfe49e98684bf4`.
Receipt `/app/projects/may-agent/.state/deploy-receipts/merged-296-20261003.json`
reports success, healthy and no duplicate deployment. The receipt, provenance
and live binary agree on SHA-256
`7efb0bbeacfb5b7d0af08d30f479d77a669b55485252d01cbfd597111910cdde`;
all three services and readiness passed. App source remained the release above.
Evidence is in `/app/.state/conversation-validation-rollout-20261003/`.
This activates the current Topic/Request selection guidance from May's existing
reviewed candidate. It does not include the subsequent pre-finish validation
candidate or establish recovery of the original invalid selections.

## Proposed outcome

May should stop a completed invocation, retain unresolved work without repeatedly reasoning about unchanged evidence, and make unusually costly execution visible to an accountable owner.

The agent decides what work is useful and what change should invite another judgment. App code validates and records that decision. Host executes the existing completion, Condition, observation and delivery contracts.

Verify the integrated completion and review-clock repairs, then assess tighter review policy, bounded context and reusable consumption monitoring. Keep the current Task and investigation identities; no additional scheduler or issue registry is required.

Deployment claims apply only to the exact slices in the dated rollout record.
The remaining proposals still require implementation or outcome verification.

## Evidence and confidence

The audit covers October 1 00:00 through approximately October 2 00:24, Shanghai time. Cost figures below are recorded model estimates, not provider bills.

| Finding | Evidence | Confidence |
|---|---|---|
| Ordinary helpers can continue after valid completion | Two sessions called `finish` 183 and 218 times; approximately $380 of estimated usage followed their first finishes. Saved metadata has `requireFinish: false`. | Confirmed in traces and a local reproduction using the real runner |
| Metric review deadlines can already be overdue | 111 of 113 retained completed DeepSeek metric reviews had a past `nextReviewAt` at completion. | Confirmed in retained results and deployed App source |
| Existing waits repeatedly invite unchanged judgment | The AKS investigation had 348 attempts, including 167 triggered by missed Condition checkpoints. Other investigations repeatedly wait for any newer metric sample. | Wake mechanisms confirmed; individual reviews require judgment before calling them waste |
| Reference expansion makes routine context large | One preparation expanded eight referenced Tasks into approximately 126 KB of JSON. | Confirmed in saved preparation and context-builder source |
| Result status misses execution anomalies | Both large finish loops ended with an aborted model response but were retained as `done` because they had a valid result. | Confirmed; retaining a valid result is still desirable |

The full investigation at `/app/.state/token-audit-20261001/DEEP-DIVE.md` contains source locations, session IDs, limitations and reproduction results. Those supporting artifacts are local and ignored by Git; this proposal retains the review-critical findings independently.

## Responsibilities and invariants

| Responsibility | Owner |
|---|---|
| Decide whether to work, wait, seek help or change approach | Agent, within the App's policy and authority |
| Validate decisions, choose review eligibility and coordinate related concerns | May and Evaluation Apps |
| Stop an invocation after valid completion; preserve inputs and result receipts | Host execution layer |
| Sample resources, evaluate declared Conditions and deliver events/checkpoints | Existing Host observers and Task machinery |
| Record usage and execution anomalies | Host |
| Interpret costly recurrence and select an intervention | Owning App; Evaluation supplies independent assessment |

An **invocation** is one admitted call to an agent. A durable session can contain later invocations. Finishing a helper completes its contribution; it does not settle the parent Task or its unanswered requirements.

Preserve these invariants:

- A valid finish ends its invocation; a rejected finish remains correctable.
- New requirements and pending inputs remain durable and accountable. Compaction or a helper finish cannot check them off.
- Late observations remain history for closed Tasks. An authorized explicit continuation can reopen the same Task with its new requirements.
- A Condition match invites judgment; it does not prove recovery or fulfill the original request.
- Useful retries remain permitted. Usage and recurrence can trigger owner review; they do not themselves authorize cancellation or impose a retry cap.
- Result validity and execution efficiency remain separate facts.

These follow the existing [system boundary](../../may-agent.app/docs/2a-design/system-boundary.md), [Task contract](../../may-agent.app/docs/2a-design/task-resource-engine.md), [metrics contract](../../may-agent.app/docs/2a-design/metrics.md) and [failure follow-up process](failure-follow-up-proposal-20260919.md).

## 1. Unify terminal completion

Today the base `finish` tool validates and records the result but returns an ordinary tool result. The workflow wrapper adds `terminate: true`; ordinary helpers without a required output schema bypass that wrapper.

Move terminal completion into the shared base finish contract. Keep caller-specific schema and semantic validation in the existing wrapper. A valid result with any supported completion status ends the invocation; validation errors do not.

Apply this behavior through ordinary `agents.call`, workflow calls, managed execution and direct execution. A persistent session remains available for a later admitted invocation.

The current runner also checks tool batches and queued steering after a turn. A terminal flag alone must not be assumed to cover every path: its batch logic currently requires every tool result to be terminal. Use the existing runner stop-after-turn hook where needed to honor a validated terminal receipt before another model request. Preserve completed tool results and durable pending inputs. Define and test mixed batches explicitly so a finish cannot silently authorize later tool effects or lose an unexecuted obligation.

The decisive receipt is successful tool validation/execution, not the presence of the word `finish` in model output. Do not stop on rejected arguments. Do not change a valid result into failure merely because cancellation arrived during shutdown.

**Acceptance:**

- A plain helper and a schema-backed helper each make exactly one scripted model request when that request returns a valid finish.
- Invalid-then-corrected completion takes the corrective request and stops immediately afterward.
- Refreshing the same Task, an internal ready event and a queued follow-up cannot prolong a finished helper contribution; relevant input remains available for reconciliation.
- Direct, managed, persistent-session and mixed-tool-batch cases preserve their result and input contracts.

Five local reproduction cases already demonstrate the plain/helper difference and an in-memory base-tool correction. They are evidence for this proposal, not a production implementation. Existing wrapper tests pass and need integration coverage for ordinary helpers.

## 2. Separate evidence time from review time

Today `nextReviewAt` is computed from the observation cutoff. An hourly cutoff plus a five-minute interval can be in the past before the reviewer starts.

Keep the existing evidence cutoff and immutable evidence hashes. Use the retained immutable report completion time (already `payload.createdAt` in current source) and derive:

```text
nextReviewAt = retainedReport.createdAt + reviewInterval
```

For the first change, reuse the configured interval so the clock correction can be assessed independently of cadence tuning. Reviewer budget eligibility remains a separate existing control; a budget allowance is not proof that another review is useful.

Capture that time once for the completed review and retain it through publication recovery. Replaying a retained report must neither invoke the model again nor keep moving the deadline forward. Do not rewrite historical evidence or reports. Older reports remain readable; no second clock field is required.

**Acceptance:** old evidence and queue delay still produce a future review deadline; immediate periodic reselection is skipped; publication retry preserves the completed judgment and time; explicit new requirements retain their supported admission path.

## 3. Investigate breaches, not samples

The metric service collects samples and evaluates status in code. A new breach
episode invites investigation; a recovery status change can update the existing
owner. Newer measurement timestamps, ordinary value changes and repeated breach
notifications update evidence without another investigation call.

When no intervention remains, record `no-change` and finish the review while
collection continues. Existing investigations use Conditions for actual work:
repair results, human decisions or a status change bound to the exact episode.
Deliberate checkpoints belong to outstanding work, not passive sample review.
An explicitly requested post-change measurement can use the generic measurement
capability; it does not justify an open-ended investigation polling loop.

[Metric follow-through](metric-condition-follow-through.md) owns the source fix:
reject sample Conditions on its result/handoff path, guide the owner to retire
old waits explicitly, and preserve repair, approval and original-input obligations.
Existing generic Host observation mechanics remain unchanged.

**Acceptance:** repeated fresh and stale samples cause no investigation calls.
A new breach enters the normal route once; an exact recovery status, repair result
or human decision reaches existing work. One accepted owner result retires a
legacy sample wait; it stays retired after restart and independent approval still
returns. Scripted integration tests prove mechanics; live adoption and useful
agent decisions require separate evidence.

## 4. Bound optional context after enrichment

Conversation references currently expand into full Task observations after the recent-conversation budget is applied.

Default referenced Tasks to identity, a compact current summary and an exact read handle. Fetch detailed evidence when the task is explicitly in focus or the agent requests it. Apply the presentation budget after optional enrichment, using explicit omission markers and links to retained detail.

Treat required current input, acceptance criteria and obligation identities separately from optional historical context. If required detail cannot fit, retain a readable artifact and clearly identify what must be read before deciding. Do not silently truncate requirements or imply that observing input settles it.

**Acceptance:** eight references stay within the configured optional-context budget; the current assignment remains accountable; a targeted read returns complete detail. Compare preparation bytes and provider-reported cache categories before and after. Do not promise a cache-hit improvement without measurements from the actual gateway.

## 5. Detect recurrence through existing metrics

**Status:** Implemented in source after the [October 3 audit](metric-coverage-audit-20261003.md#october-4-implementation), with isolated verification.
The two observations start without alert thresholds. Nothing was activated in
the stopped installation. Runtime calibration and adoption of an attention
threshold remain pending. Existing terminal-completion repairs stay regression
requirements; new completion-lifecycle counters remain deferred.

Start with an ordinary question: **which Task is using enough model effort to
deserve a closer look?** Host already retains cumulative usage for each managed
invocation, including updates while it runs. Apps can measure that evidence and
ask for review. The reviewer decides whether the effort is producing value.

### Observation definition

Measurement: **maximum observed model replies for a Task's recently active
invocations**. This deliberately measures effort, not progress or failure.

| Property | Source implementation |
| --- | --- |
| Source | Existing `execution_usage`, one cumulative row per invocation. |
| Cohort | Rows with `updated_at` in `[cut - 1 hour, cut)`, including unfinished invocations. Read at one fixed cut. |
| Calculation | Sum `data.totals.replies` by exact `(app_id, task_id)`; take the maximum in the declared responsibility scope. Count each invocation once. |
| Unit/type | Observed assistant replies; gauge. These are not provider-request counts or exact within-hour consumption. |
| Scopes | `may.max-task-recent-model-replies` covers non-Evaluation Apps; `may.evaluation-max-task-recent-model-replies` covers Evaluation only. They follow the existing failure-metric responsibility split. |
| Cadence | Existing five-minute source collection and decoupled rule evaluation. No model call to collect or calculate. |
| Trial threshold | Observe without an alert first. Candidate attention rule: at least 100 replies (`> 99`) in the defined cohort. The audit cut selected two May Tasks; one is a human Conversation. Calibrate with useful-work examples before adoption. |
| Sample evidence | Fixed cut and cohort definition, represented invocation count, number of qualifying Tasks, top five Task groups with exact read references, token/pricing coverage, and unsupported paths. Report truncation. |
| Missing evidence | Read/parse failures are unavailable; they are not zero. A successful empty cohort means zero **observed** replies, not proof of no work or universal accounting coverage. |

A long-running invocation contributes its whole saved total while it remains
recently active. This catches effort accumulated before the hour boundary, but
can keep an expensive productive run above the threshold. An invocation ages
out an hour after its last update. The calculation is a review heuristic; do not
label it “hourly spend,” sum successive values, or infer exact historical rates
from overwritten cumulative rows.

Use the latest calculated gauge initially: its cohort already collects effort
over a window. If trials demonstrate noisy transitions, use the existing
calculation/sustained-condition configuration. Do not add another smoothing
engine. Capture the evidence with the sample so a later review does not silently
recompute a different cohort.

Keep metric identities few: two scopes, with Task identities in bounded evidence,
not a new series for every Task. Multiple causes can coexist in one scope. A new
expensive Task during an open breach updates evidence without another breach;
routine daily review or an already justified investigation checkpoint examines
changed membership. This first version does not promise immediate independent
notification for each Task. Trial that delay before deciding whether finer App
scopes are worth their review cost.

### Review and follow-through

The existing transition path remains:

```text
usage facts -> periodic sample -> metric condition -> breach/recovery
             -> Evaluation review (or May for Evaluation's work)
             -> May disposition -> existing accountable improvement work
```

The non-Evaluation signal uses Evaluation's existing metric-review subscription.
Declare the Evaluation signal with explicit responsibility and add it to May's
existing direct operational route; it must not depend on Evaluation assessing
itself. A breach supplies the existing `metricId`, `alertId` and observation cut.
Repeated samples stay quiet. Routine metric reconsideration remains daily.

The review starts with the bounded effort summary and exact Task references,
then reads current requirements, accepted results and linked evidence as needed.
Include covered inputs, intermediate artifacts, unanswered requirements, waits,
failures and relevant new input independently. A new Task version or rewritten
summary is not itself evidence of progress. Conversely, no newly fulfilled input
does not invalidate useful partial work. A busy Conversation can be worthwhile.

Evaluation proposes an evidence-backed explanation and smallest worthwhile next
action. May decides whether to pursue it, reuse a fitting investigation, record
no change, or request human approval under the existing improvement policy.
The accepted disposition retains that decision and its exact linked work.
Useful outcomes per review cost matter as well as detecting repetition.

Recovery means the attention rule cleared. A completed invocation aging out,
paused execution, or administrative alert resolution cannot prove the original
request is fulfilled or the cause is fixed. Validate actual useful work after a
change; preserve remaining requirements and independent Conditions.

### Responsibility and implementation cost

- **Host:** retain factual usage and expose normal evidence reads. Add an ordinary
  `updated_at` index for the selected usage query and verify its plan before
  scheduling collection. The audit query scans the table today. No new usage
  table, transcript scanner or rollup service is proposed.
- **May App:** declare the two scoped source queries, candidate thresholds and
  independent Evaluation route, alongside existing reliability metrics. Keep
  the metric semantics and selected examples explicit in the source result.
- **Evaluation App:** reuse metric selection, immutable evidence/report storage
  and publication. Add concise review guidance about effort versus useful work;
  preserve the separate reviewer budget and daily routine cadence.

The first scope is limited to measured managed invocations. Native `codex-goal`
attempts and persistent chat are not established as covered. Report that gap;
extend the existing Host usage adapter separately when trustworthy native usage
is available. Missing prices are unknown, and zero estimates do not mean free
work. Failed/code-only attempts remain visible through existing outcome metrics.

This costs two metric definitions, bounded periodic reads, one appropriate index
and review capacity. It gains attention to expensive accepted work without
changing Task admission, retries or what counts as a valid contribution. It will
miss cheap semantic failures, some unsupported executors, and hangs before any
reply; the existing failure, age and periodic Task reviews remain necessary.

### Trial and acceptance

First correct the existing stale threshold and obsolete catalog entries identified
by the audit. Then measure in calibration mode before enabling the candidate
threshold during a separately authorized runtime trial.

Use four cases: repeated accepted work with little useful change; productive
expensive partial work; an expensive long-running invocation crossing the hour
boundary; and a quiet legitimate wait. Include Evaluation as a subject for the
independent May route. Verify exact effort accounting, unchanged-sample silence,
one retained alert episode, and explicit unknown coverage. Reopen storage and
check that collection continues without duplicate usage or investigation.

The connected trial must reach a published review and accepted owner decision,
with linked follow-through when worthwhile. Compare the quality and cost of
those decisions, not just the number of alerts. A useful expensive run must
remain valid, and a cheaper stalled run must not count as an improvement. The
single historical calibration cut establishes neither precision nor savings.

## Delivery plan

| Slice | Scope | Evidence before adoption |
|---|---|---|
| A — Host completion | Shared terminal semantics and converged execution paths | Real-runner integration tests, including late input and mixed batches; bounded ordinary-helper trial |
| B — Evaluation clock | Completion-based next-review time and idempotent publication recovery | Old-cutoff/delayed-review fixtures and observed future deadlines |
| C — App reconsideration | Condition selection and coordinated review eligibility | Retained-trace replay, meaningful-change fixtures and bounded agent trial |
| D — Host context | Compact optional references and final presentation budget | Context composition checks, targeted-read correctness and measured size comparison |
| E — Continuing detection | Catalog cleanup, existing invocation usage and App attention policy | Bounded accounting, useful-work comparison, independent routing and accepted follow-through; then a controlled runtime trial |

A and B address the confirmed bugs and should be reviewed first. Keep each slice independently reviewable and use the existing candidate, review and deployment process. During rollout, compare the same Task/trigger populations over at least a full chosen review interval; raw lower token totals alone do not prove preserved functionality.

Retained old Conditions will not change merely because new guidance is installed. During slice C, have the owning App reconcile the identified investigations through normal Task operations and revise only the relevant waits. Preserve approval packets, unrelated requirements and historical evidence. Do not edit runtime database rows directly.

Rollback restores the prior code/policy revision without deleting Tasks, inputs or evidence. Added accounting/result fields must tolerate older readers. App policy reversals use ordinary reconciliation to restore affected waits.

## Related recovery and independent oversight proposal

The later October 2 investigation confirmed the container Codex sandbox failure and reproduced two additional defects: stale context after resume and an immediate stale-result loop with a bounded event backlog. It also identified gaps in owner escalation and independent coverage of Evaluation's own operational work.

The [recovery and independent oversight proposal](../../may-agent.app/docs/proposals/reliable-recovery-and-independent-oversight-20261002.md) owns those fixes and their connected verification. It reuses the existing caller feedback, metric and Condition paths. This token-efficiency proposal continues to own completion, review scheduling, reconsideration and optional context budgets. Neither document claims deployment, and no global retry limit is proposed.

## Decisions for reviewers

1. Is terminal completion consistently owned by Host, including ordinary helpers and persistent sessions, while Task fulfillment remains with the caller/App?
2. Does the App policy express meaningful reconsideration through current Conditions and retained results without introducing bookkeeping for the agent?
3. Do the replay/trial criteria cover both avoided repeated work and the new information that must still reach the owner?
4. Is the proposed order appropriate: fix completion and the review clock, then improve reconsideration/context and install continuing detection?

Review disposition: retain A/B as integrated-source regression requirements. C–E remain proposed follow-up; prioritize them using measured outcome, review cost and coverage evidence.
