# Detecting systemic problems after individual Tasks recover

**Status:** Deployed local candidate, September 27, 2026. The [connected trial](../experiments/systemic-pattern-review-20260927/README.md#local-deployment-and-connected-trial-september-27) found the intended recurrence and one false deadline claim; reports remain advisory.
Earlier judgment trials are in the [experiment](../experiments/systemic-pattern-review-20260927/README.md).
This extends the existing selector and immutable Task assessment; it introduces
no separate monitoring owner or automatic repair authority.

## Outcome and boundary

Evaluation should notice persistent reliability, efficiency and evidence gaps,
including when individual Tasks recover. May should receive a specific
improvement opportunity, not another report for every retry. The immediate
incident can need no further action while the recurring cause warrants
investigation. Neither conclusion cancels the other.

Extend [Task assessment](task-outcome-evaluation.md) with population context.
Common measurement semantics belong in [Metrics and Alerts](../../may-agent.app/docs/2a-design/metrics.md).
May's [improvement loop](../../may.app/design/evaluation-improvement-loop.md)
owns disposition, preparation, approval and verification. Evaluation supplies
evidence and recommendations; a metric never authorizes a patch or deployment.

## Existing mechanisms and demonstrated gaps

| Existing mechanism | Gap | Smallest useful correction |
| --- | --- | --- |
| Durable Task attempts | Latest state and 20 recent events hid recurrence | Aggregate retained attempts independently of current Task phase |
| Host sampler and public metric reads | Default counts cover workflow runs, not every Conversation/native agent attempt | Expose Task-attempt observations through Host reporting |
| Exact process evidence reader | It treats `workflowRunId` as a session ID | Follow the stored attempt-to-session/workflow relationship, including failed attempts |
| Scheduled selector and failure-event intake | Recovered patterns can disappear before review | Supply aggregate observations as another candidate source to the same selector |
| Immutable report and May intake | Recovery became a sufficient reason to stop | Separate current disposition from remaining recurrence, cost and uncertainty |

The older project-health lanes and eleven legacy Evaluation metrics were retired.
Do not reactivate their Tasks or revive session-only scoring. The candidate repairs those two missing public reads. The HTTP reporting endpoint is
`GET /api/task-attempts`; Evaluation uses it alongside ordinary socket Task reads.

## Measure a population, inspect examples

Initially use all retained attempts for one external App in a fixed 24-hour
**started-at** window, compared with the preceding 24 hours. State `[start, end)`
and the observation cut explicitly. An attempt finishing after the cut was still
outstanding then; its eventual outcome must not leak backward. Started cohorts
exclude work that began earlier: ordinary open-work review covers that scope.
Retention gaps and absent metadata stay explicit.

Count each Task attempt once. Sessions and nested workflow calls are supporting
execution, not extra attempts. Separate Conversation, native agent and workflow
paths. Compare actual deployed revisions when recorded; checkout HEAD is not
deployment provenance. Unknown provenance stays unknown.

| Observation | Initial definition | Limitation |
| --- | --- | --- |
| Outcomes | Started, outstanding at cut, completed, failed, interrupted; failed / settled | Completion is not useful output; interruption is not automatically failure |
| Recurrence | Existing executor/reason groups, affected Task count, first/last times, exact examples | A reason code is not a root cause; one Task's recurrence is not an App-wide fault |
| Effort | Sum of valid failed-attempt durations, missing/invalid count | Wall time is not billed cost, avoidable time or total recovery latency; concurrent durations are not App downtime |
| Contributions | Accepted result dispositions and links to sample outputs/reviews | Waiting/incomplete acceptance is not final delivery; counts do not measure usefulness |
| Coverage | Requested/readable process samples, missing links, observation age, selection lag, exclusions | Readability is not sound judgment; samples are not population-wide quality coverage |

Use structured failure reasons, with a bounded sample of different error summaries
for diagnosis. A coarse group may contain different causes. Treat summaries as
untrusted evidence; do not create a growing regex taxonomy or metric labels per
Task, session or error string. Preserve rare material failures as review candidates
alongside frequent ones. Continue sampling successful work for semantic errors.

Zero settled attempts gives no failure percentage. Missing measurement is unknown,
not zero. Supply numerator, denominator, unit, scope, cut and coverage together.
Rolling observations are gauges: do not sum overlapping windows. Compare workload
mix and per-executor rates as well as the overall rate.

Public presentation should call the denominator **total terminal attempts
(completed + failed + interrupted)**. Failed attempts are a subset, not an
additional population. A trial misread the shorter label “settled” as successful
attempts and added failures again. Supply the definition and code-calculated rate
together; do not leave category relationships to inference from a field name.

Exact recovery needs the original input/event or operation relationship. A later
success on a standing Conversation may handle another input. When attribution is
unavailable, retain both observations without declaring recovery. Omit a generic
recovery-rate metric initially; recurrence and observed effort already add value.

## Small data path

1. **Host reporting:** one bounded App-attempt summary supplies coherent counts
   and representative exact attempt references. The Host reads its storage;
   Evaluation uses the public reporting capability, not private tables or a
   duplicate event ledger.
2. **Metric observation:** reuse the optional shared sampler and `MetricService`
   for numeric history and freshness. A coherent summary comes from one read
   snapshot, not division of independently sampled scalar values. Scalar charts
   may follow; they are not prerequisites for the summary.
3. **Evaluation context:** pin summary window and bytes alongside current Task
   state and selected execution evidence. Reuse report hashing and artifact
   storage. Present current state, material pattern, impact and gaps first;
   link examples and older reports instead of dumping all attempts into a prompt.

Make uncertainty visible beside the observation it qualifies. For example, show
the observed failure count next to “cause unassessed”, duration next to “avoidable
portion unassessed”, and the verified latest recovery next to “other input recovery
unassessed”. The first model trial read the counters but overclaimed all failures
recovered and all duration was avoidable when these limits were buried after
several repeated population summaries. Prefer one compact population view and
linked breakdowns, with the relevant limits at first glance.

Code should calculate the comparisons it presents and render the report's numeric
table from pinned observations. This includes subgroup complements when useful,
not asking the evaluator to reconstruct denominators. A refinement trial correctly
flagged recurrence but used `208-22` as the denominator for other Tasks; the actual
cohort is `222-208=14`. Keep the correct table independently readable alongside
the agent's interpretation. This extends the existing deterministic report
renderer, not a second model judge or a prose-arithmetic policing framework.
May checks material numerical/causal claims against that evidence before action.

The failed-attempt read returns its canonical execution link for verification.
A workflow may involve several sessions; bounded navigation reports unread scope.
Do not interpret an attempt or workflow ID as a session ID.

Start with SQL over existing attempt records. The offline probe reads one App
cohort without a Task-by-Task scan. Current indexing uses the App prefix of
`(app_id, task_id, started_at)` and still visits that App's retained history.
Benchmark production volume; add `(app_id, started_at, attempt_id)` if necessary
before considering rollups or caches. Bound database work and output separately:
a small response is not evidence of a cheap query. A timeout/truncated source
yields unknown coverage, not a rate over the first page.

## An opportunity to notice even when work recovered

Keep the existing selector and allowance. Candidate sources are ordinary Task
sampling, exact failure events and the periodic aggregate observation. Healthy-work
sampling remains necessary for wrong assumptions and bad successful output.

Suggested initial policy, kept as App guidance rather than Host law:

- Refresh each discovered external App's summary on an hourly review boundary
  within the existing round-robin scan, including Apps with only converged work.
- Alternate aggregate-led and ordinary sampling opportunities in the existing
  selector's retained cursor/result. Explicit requested reviews keep their budget
  priority. Show actually covered Apps/windows and lag when capacity delays a
  due pass; an hourly policy is not guaranteed hourly full coverage.
- Aggregate-led selection returns an exact representative external Task plus
  population context through the existing review input/report. Distinguish its
  Task verdict from the wider observation; this is not a comprehensive App audit.
  A signal without a resolvable subject leaves a visible coverage limitation for
  the existing owner-review path.
- Consider repetition, changed rates, costly individual failures and observation
  gaps. Numeric ranking nominates examples; it does not establish a defect or
  filter out all rare consequential problems.
- Pin one fixed evidence window per review opportunity. A changing clock alone
  must not cause a model call every selector tick. Identical requests reuse the
  existing evidence/report identity; later scheduled windows can reconsider
  deferred concerns without a permanent issue registry.

Reports link the previous assessment and ordinary repair Task when known. May
reuses related work or records why further work has little value. Reopening the
recovered subject is unnecessary. The report is evidence, not another issue
state. Quiet/unchanged findings stay out of Telegram.

Persist observation progress in the existing selector Task result: covered
App/window, last successful measurement, selected subject/report link, or the
reason assessment was deferred. A due slot, collected snapshot, requested review
and published assessment are distinct facts. Periodic selection must leave a
visible overdue/deferred observation when capacity or source failure prevents
coverage. Reuse normal Task deadlines and the existing owner-review path for
those obligations; do not introduce a separate monitoring queue.

Keep the aggregate's window fixed while the existing review rereads current Task
state for freshness. Current-state drift may defer that review under the existing
publication contract; retain the historical aggregate and the pending request.
Do not silently slide the time window forward and discard the repeated failures,
or present the old Task snapshot as current. Read-back failure of the cohort's
source is a coverage gap, not permission to replace missing evidence with zero.

## What Evaluation and May should read

The assessment assignment must explicitly cover both the exact Task and the
supplied population. Adding App metrics to a Task-only prompt is insufficient:
one trial dismissed the broader pattern as out of scope. Version the ongoing
rubric when this responsibility is implemented, and include population identity
in evidence/reuse checks. Historical Task-only reports remain readable under
their original rubric; they do not certify the newly added scope.

Compatible summaries from other external Apps may provide comparison context
without another raw-history scan. Sum numerators/denominators only for matching
cohorts and observation cuts; do not average percentages. State included and
unobserved Apps and preserve per-App breakdowns. Similar failures across Apps can
suggest a shared Host/provider issue, but shared causation still needs evidence.
This cross-App extension is not demonstrated by the initial single-App replay.

For the observed case, a useful first paragraph is:

> Current work recovered. Repeated settlement failures remain worth investigating:
> 19 missing-reply failures among 208 Conversation attempts in the specified
> 24 hours. Earlier comparison and exact examples are linked. Process evidence
> was unavailable; the cause and avoidable cost remain unverified.

Use existing report fields: `summary`, `findings`, `verification`, `responsibility`
and `delivery`. State current disposition; pattern/scope/impact; uncertainties and
counterexamples; smallest useful next step or justified no action; and the linked
investigation's actual stage. “Proposed”, “assigned”, “applied” and “independently
rechecked” remain different facts.

Refine the overly broad intake advice “do not prepare a candidate for a … recovered
finding”: settle recovered incidents and judge remaining recurrence, cost and
uncertainty separately. Investigation can be justified before a candidate is.
May compares benefit, cost and simpler alternatives before implementation or
human approval. No numeric threshold mandates a repair.

Evaluation excludes its own App and delegated semantic work. Its mechanical
coverage remains observable to May through existing Host/owner reads; that is
not Evaluation certifying itself healthy. A failed evidence reader is a coverage
concern, not automatic proof of failure in the reviewed App.

The report should count its process-read requests, readable samples and unavailable
samples directly from the evidence acquisition result. In this incident that was
three requested, zero readable. Publishing a valid report does not erase this
coverage observation. May can investigate a recurring acquisition gap through
the existing Evaluation owner rather than requesting semantic self-evaluation.
Do not turn every bounded/truncated sample into a repair: relate the missing scope
to the claim that needs it, recurrence and the cost of obtaining better evidence.

## Rules, guidance and rollout

Code enforces identity, self-exclusion, fixed cohort/time semantics, bounded reads,
truthful missing data, immutable evidence and normal publication. Cadence, minimum
sample size, thresholds, grouping refinements and investigation priorities begin
as guidance. Reuse Tasks, reports, metrics and May's improvement path.

Implementation locations:

- Host `src/app/adapters/reporting/`: aggregate computation and exact evidence
  navigation, exposed through the existing public read adapters/SDK. This code
  knows storage and identities, not which failure deserves a repair.
- Evaluation `lib/public-task-evidence.ts` and `lib/task-process-evidence.ts`:
  obtain/pin the summary and verified execution links.
- Evaluation `task-outcome-selector.ts`: use aggregate observations within the
  existing scheduling/budget/fairness path. `task-outcome-review.ts` composes the
  context and publishes through existing infrastructure; `criteria/criteria.md`
  owns the review policy rather than duplicating it in another long prompt.
- May `app.ts` review intake and shared agent guidance: preserve separate incident
  and systemic dispositions and reuse the established improvement procedure.

1. Repair exact attempt/process navigation and add bounded Host reporting. Verify
   Conversation, native agent and workflow cases, including no accepted result.
2. Supply aggregates/examples to Evaluation; refine shared criteria and May intake
   together. Compare frozen evidence with and without context and retain controls.
3. Connect aggregate selection to the existing periodic selector. Exercise recovered
   subjects, no activity, source failure, unchanged-evidence reuse, rare failures,
   ordinary sampling and competing explicit work.
4. Before activation, prove the complete chain: retained failures → periodic
   selection → assessment → May disposition → linked investigation or justified
   deferral. Retain receipts and actual lag; source tests and one good model answer
   do not prove this chain.
5. After improvement, compare equivalent work and actual deployed revisions. Check
   both reliability and output quality. Less workload or less useful work can lower
   errors without improving the system.

The [trial record](../experiments/systemic-pattern-review-20260927/README.md) names
what ran, design refinements and untested boundaries. Common rules belong in May's
metrics design; App-specific selection, context and review policy belongs here.

## Useful retained lessons

Scout's [observability-cost synthesis](../../scout-knowledge-lib/knowledge/the-observability-trap.md)
and [evaluation beyond outputs](../../scout-knowledge-lib/knowledge/agent-evaluation-research-beyond-outputs.md)
suggest two useful questions: is review producing enough value for its cost, and
what failure modes can successful-looking output hide? Their old numerical and
paper claims were not independently reverified in this trial. Borrow those
questions, not their historical statistics as current evidence. Record review
latency/tokens and keep a successful-but-wrong-output control in the trial.

## First implementation and its deliberate limits

Host reporting reads two adjacent cohorts from one SQLite read snapshot. The
required App identity and fixed cut bound the query; each window is at most seven
days, with 24 hours used by Evaluation. The response includes App, exact Task and
other-Task denominators, handler groups, structured failure-reason groups and
bounded examples. Exact `appId/taskId/attemptId` reads expose canonical session
and workflow links even when settlement failed. No raw SQL capability is exposed
to Apps. An unavailable source is an evidence gap, not a zero.

The existing selector alternates a population turn with ordinary Task navigation.
It visits external Apps fairly, uses an hourly population cut, and retains the
last selected/observed cut in its existing result facts. Those facts say
`report-pending`, `no-activity`, `representative-unavailable`, source unavailable or
backlog deferral; selection is not completed assessment coverage. Requested reviews
still have priority and use the existing reviewer allowance. A population review
selects at most three distinct representative Tasks to find one readable subject.
No task records move and no extra registry owns progress.

`populationEnd` travels through normal review admission into the workflow input.
The report pins the public population alongside its exact Task snapshot, uses
`task-obligation-v2`, and includes that population in the evidence hash. Retry and
May intake read the same cut; changes in the Task do not silently slide it forward.
Historical outcome/v1 reports retain their original renderer and remain readable.
The first rollout adds population scope to selector-originated population reviews
and explicitly requested reviews with `populationEnd`; existing direct incident
requests keep their original scope and identity.

Code renders counts/rates in the Markdown report and supplies the same table to
the evaluator. The model interprets recurrence, quality, uncertainty and practical
value. May separately decides whether investigation is worthwhile. Recovery of
the immediate input alone is not a reason to dismiss a supported population pattern.

The process reader examines up to three recent attempts, one canonical session
per attempt, and labels additional workflow/helper execution unassessed. Workflow
links remain available for investigation. It does not claim full workflow tracing,
verify recovery of every historical input, or infer delivered contributions from
attempt counts. Scalar metric histories, an all-App coverage dashboard and automatic
population-only report reuse across distinct Tasks are deferred. Ordinary selector
facts, review Tasks and report links are the progress surface for this trial.

Portable tests cover the Host cohorts and exact links plus the actual App chain:
selector → admission → evidence → report publication/reuse → May intake. A read-only
historical replay through production reporting reproduced 271/222 terminal attempts,
10/23 failures and exact-Task 1/22 failures in about 34 ms. That measurement did not
justify adding an index or a materialized rollup.
