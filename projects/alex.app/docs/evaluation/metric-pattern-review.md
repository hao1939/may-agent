# Metric observations in the existing review loop

**Design status:** Accepted for the first implementation.
**Implementation status:** Activated on October 3 in Apps release `1e97bd70e1`
with Host `14491241d`. Live collection, breach and recovery reached the same
Evaluation Task; its completed report reached May and was handed to the existing
investigation. Sustained repair verification remains separate; see the
[live verification](../proposals/responsive-host-recovery-20261002.md#october-3-merged-host-and-metric-loop-rollout).

**October 16 refinement, verified October 17:** Transition-only automatic
selection is active. The source and loaded release were compared in the
[recent App review](../archive/reviews/recent-app-work-20261017.md#follow-up-existing-fixes-and-remaining-work).
Earlier source also selected ordinary sample changes and reconsidered open alerts
daily. Repeated actual breach/recovery crossings remain a separate issue;
the [owner-decision reuse proposal](../../../may.app/design/token-efficiency-proposal-20261002.md#c--reuse-an-owner-decision-with-explicit-scope)
is not yet implemented.

Persistent failures should receive investigation and an accountable response while
Host retries continue with backoff. This extends the existing
[systemic review](systemic-pattern-review-20260927.md) to observations that do not
have a Task, including failed input admission. It reuses
[metrics](../2a-design/metrics.md) and May's
[improvement loop](../../../may.app/design/evaluation-improvement-loop.md).

## Ownership and flow

Host preserves input, Task and attempt facts. Its optional reporting adapter
provides `GET /api/metrics/:id/evidence`: current metric definition, observations
before a fixed cut, two adjacent windows, code-calculated changes, bounded sample
examples, collection failures and freshness. A missing metric returns unavailable;
old observations remain visible even outside both windows. Sample counts/minima/
maxima cover the whole retained window while examples are explicitly bounded.
Changes compare values, not sums of rolling counts or inferred counter rates.
Current definitions are not historical definition snapshots. Retention and missing
intervals remain evidence limits. Recorded alert episodes and accepted owner
decisions are returned with their exact identities and bounded-history limits.
An optional `alertId` read finds that exact episode and its decisions even outside
the recent list, with earlier decisions supplied separately as possible related work.

May declares the initial sources and attention thresholds: current unresolved
input recovery count, oldest unresolved recovery age, rolling failed Task attempts
with the exact terminal denominator, and unfinished Evaluation review age. These
read existing records, preserve exact examples and exclude Evaluation from its own
semantic review population. Age includes old unfinished work; a count of zero with
no observations is not a successful-work percentage. The thresholds request
attention and do not cap retries or choose a repair.

Evaluation subscribes to metric breach and recovery transitions. Samples update
metric values and retained evidence; changed values within an open alert, stall
observations and individual collection failures do not commission another review.
A declared stale-metric alert retains visibility into missing samples and
collector failures. Legacy breach events marked `repeat:true` are ignored by
this subscriber.

A transition carrying `metricId`, `alertId` and `measuredAt` routes directly to the
stable per-metric/reviewer Task. It pins the exact alert and the end-exclusive
evidence cut at `measuredAt + 1`, including the triggering observation. It still
respects shared reviewer capacity. If capacity is occupied, the same Task retains
its requested observation and an ordinary timed wait. Signals without an explicit
observation time use the existing bounded selector. No target queue or new timer
is added.

The selector alternates metric and Task opportunities, visits up to three active
metrics per opportunity, and retains its cursor in its ordinary Task result. It
looks for the latest recorded breach or resolution, using `createdAt` or
`resolvedAt` plus one as the exact observation cut. It selects that transition
only when it is newer than this reviewer's completed observation. This repairs a
missed notification without turning later samples or an unchanged open alert into
new model work. Numerical change, freshness and collection errors remain evidence;
attention requires a declared alert transition or an explicit review request.
An event is a prompt to read evidence, not a demand for another model call.
Metrics with only an owner, or with
unresolved attribution, remain visible. Declared owners resolve against the
installed App catalog (an exact App identity, or an unambiguous worker owner).
A project label is a fallback only when no owner was declared and it resolves to
an installed App. Unknown/ambiguous/unavailable responsibility remains explicit;
Evaluation-owned observations are excluded from semantic self-review.

One stable review Task per metric/reviewer retains the requested cut, shared
review allowance and `reviewedThrough` in its accepted result. That boundary
advances after the report publishes; it does not claim that the metric is healthy
or that the finding is resolved. Quiet completion, capacity waits and failed
assessment retain the previous boundary. A late older report cannot move it
backwards. Neither elapsed time nor continuing breach schedules another review.
Agents can explicitly request reassessment or retain a relevant Condition on the
investigation Task. Reviewer capacity remains separate from this admission rule.

The fallback observes the latest transition in bounded active-metric history; it
is not an exhaustive replay of historical episodes. Truncation and unavailable
history remain explicit. Old results without `reviewedThrough` can receive one
ordinary transition assessment; no migration registry is needed. At-least-once
consideration is acceptable. Existing automatic requests without an alert settle
without a new assessment. If such a request already staged a judgment, publication
recovery finishes that exact report instead of discarding it. Explicit requests
can still review any valid observation, including metrics without alerts.
Pending review work takes precedence over
routine sampling. Budget exhaustion retains a timed wait; failed reads/reviewer
execution remain incomplete and report through the existing owner path. Ordinary
Task sampling can continue when metric evidence acquisition fails. The report store
retains the first source bytes under the exact metric/cut/reviewer request before
assessment. Retries read those bytes before consulting mutable sources, then reuse
the immutable assessment. Task and metric reports share publication/marker handling.
Definition edits, later ownership changes and source-read failures cannot redirect
publication recovery to a second judgment of the same requested observation.
Completed reports suppress duplicate publication; later transitions or explicit
requests can reconsider an ongoing concern.

Metric reports use the existing judgment schema, immutable report storage,
publication marker, bounded reader and May intake. Their subject is
`{metricId, alertId?}` under `metric-observation-v1`; responsibility is separate
evidence, not part of metric identity. The optional alert ID identifies the triggering episode for a transition review,
or the latest recorded episode for an explicitly requested observation; other episodes remain evidence, not
an assertion of shared cause. Existing Task subjects and historical report paths
remain readable. No placeholder Task is used as evidence. The metric report hash
binds its captured observations; altered report bytes or mixed subject/rubric
identities are rejected. May reads the publication and fresh metric evidence before
judging present relevance. Historical findings are not silently treated as current.
Oversized judgments or current metric evidence are explicitly omitted from the
bounded intake result and require reading the exact source before a decision.

May coordinates disposition and intervention with the accountable App. It reuses linked work when the scope fits;
otherwise an independently owned outcome uses an ordinary Task. Unresolved concerns
retain an owner, next action or justified wait, next review boundary and evidence.
One metric can contain several causes: a correlation key is not a claim that all
findings have the same cause. Acknowledgment, a proposed patch and improvement in
an aggregate do not prove fulfillment of the original input.

## Breach identity and retained response

Effort observations use this same review path. The reviewer reads named Tasks,
accepted results, intermediate artifacts, remaining requirements, new input and
Conditions before judging value. High effort and partial fulfillment can coexist
with useful work. Recommendations compare the smallest correction's likely value
and cost, including no change. Unsupported accounting and unknown prices remain
evidence limits; aging out of a rolling population is not verified recovery.
May's [effort definitions and calibration](../../../may.app/design/token-efficiency-proposal-20261002.md#5-detect-recurrence-through-existing-metrics)
own attention policy. Evaluation's own effort routes independently to May when
enabled; it is excluded from this semantic self-review path.

One ongoing breach has one existing `alertId`. Changed values update that alert;
recovery closes it, and a later breach gets a new identity. Manual resolution or
configuration changes can also close an alert, so closure is not recovery proof.

Direct operational handling and May's report intake use the same `metric-response`
workflow. It reads accepted decisions by metric/alert, checks the exact linked App
and Task, and returns their current contents for scope judgment. A missing linked
Task leaves evidence unavailable; it does not authorize replacement work. Published
reports still require review even when they join the same investigation. A new
episode can point to the same investigation after owner judgment; no automatic
reopening or one-Task-per-sample behavior is introduced.

The owner chooses an ordinary Task result and its metric judgments together.
May's `metric-response` composes `review: {task, decisions}` into that complete
result, filling `linkedTask` from the owning attempt. Passive metric collection needs no Task wait. Investigation requires submitted
work, useful continuation, or an actual repair, dependency or human wait. A metric
Condition is appropriate only when a future observation can change the next action. From Conversation the same review travels in
an ordinary `followUp`; a new goal selects `metric-follow-through`. Its initial
attempt saves the selected result, and later evidence asks May for judgment.
Existing Tasks retain their executor and use the same complete-result helper.
See [May's composition](../../../may.app/design/metric-condition-follow-through.md).

Only accepted Task results supply the `metric_dispositions` projection. The
compact version 1 fact retains metricId, alertId (null without a breach),
disposition, reason, evidence, and the exact owning Task. Unresolved facts also
retain nextAction and `followThrough:"task"`. New facts omit duplicate deadlines:
current Task obligations and Conditions' `observation.reviewAt` own them. Legacy
nextReviewAt remains historical, even if no Task wait exists. A report, prepared
handoff or workflow return alone is not accepted handling. No incident registry
or additional decision store exists.

The evidence endpoint, dashboard and daily digest read that projection. They
retain the source App, Task and accepted attempt, plus the linked investigation.
Historical `metric.alert_judged` observations remain readable for old consumers;
new Evaluation publications are never relabeled as owner judgment. Task-report
and metric-report intake share exact-publication reuse, while breach decisions
also connect different reports and entry paths.

The latest accepted decision is discoverable even after its owner handles other
work. Read history is bounded and is not universal discovery or a global lock.
When another App owns the concern, May returns evidence through its existing
owner path instead of commissioning a competing repair. Agents still judge
scope, changed responsibility, the significance of a new observation, and whether
the original requirement is fulfilled.

The unfinished Evaluation review metric routes its initial alert directly to May,
not to Evaluation for semantic self-assessment. Changed-value repeats do not create
another May message every sample. May owns continuing follow-up using its existing
Task controls and review boundaries. The age threshold is an attention policy, not
a promised response deadline. Zero queued reviews does not prove review coverage.

## Reusing an accepted owner decision

**October 17: activated locally; query-cost scope adoption needs measurement.** App release
`03cfc3546f` includes implementation `a57c006813`; reload completion event
`6679582` confirms activation. The existing query-cost owner Task completed
the scope review and accepted an unscoped no-change decision: current evidence
does not establish complete workload coverage or absence of contention;
see the [rollout evidence](../archive/reviews/recent-app-work-20261017.md#owner-decision-reuse-activation).
This optional App contract addresses repeated real transitions. It does not
change the Host's metric collection, alert rule, Task recovery or event delivery.
The existing transition-only filter and emission-provenance fix remain separate.

An owner can supply `reuseScope` on a decision in May's existing
`metric-response` input `review.decisions`. The shape is:

```json
{
  "concern": "The inspected fixture workload remains within these bounds",
  "applicability": [
    { "field": "source.workloadId", "equals": "fixture-42" },
    { "field": "source.coverage", "equals": "complete" },
    { "field": "latest.value", "lte": 120 }
  ],
  "reconsiderWhen": [
    { "field": "source.failures", "gt": 0 }
  ]
}
```

These are illustrative fields and bounds, not new measurements or a policy for
query latency. The owner judges what scope covers the concern and supplies the
necessary source/cohort identity and coverage checks. A query ID alone does not
establish equivalent workload, absence of contention, or complete evidence.

Each predicate uses `field` and exactly one of `equals`, `notEquals`, `anyOf`,
`gt`, `gte`, `lt`, `lte`. Equality is scalar and type-strict; ordering is numeric
without coercion. Applicability requires every predicate to match. Reuse ends
if any reconsideration predicate matches; an unavailable operand also prevents
reuse. An empty reconsideration list adds no boundary beyond applicability and
the current Task obligations. There is no executable expression language.

Fields use exact dot paths under `latest`, `calculation`, `current`, `previous`,
`comparison`, or `freshness`. `source` decodes the latest sample's JSON note;
it requires an explicitly untruncated note and refuses declared truncation
anywhere in that note. Plain note strings, missing values, object comparisons
and prototype paths cannot establish scope. Historical example-list truncation
does not invalidate independent complete scalar observations; those examples
are not an eligible predicate source. The scope has at most 12 applicability
and 8 reconsideration predicates, and the existing 4000-byte fact limit remains.

Code checks fresh evidence during result preparation and binds `basis` to the
inspected cut/hash, the measurement's `measuredBy`, and a hash of the complete
exposed metric definition, alert/calculation rules and resolved responsibility.
The owner supplies no `basis`. A completed Conversation can accept the fact
without creating a Task; a waiting handoff carries the proposed scope for the
receiving owner to judge again. The ordinary Task workflow also validates fresh
evidence before composing a scoped fact. Preparation is never acceptance.

Before spending semantic allowance, automatic `metric-review` reads current
unfiltered accepted dispositions across episodes. The newest decision by May or
the current accountable App supersedes the older scope, including a new decision
with no scope. Missing provenance, tied latest decisions or an uncertain bounded
history edge prevent reuse. Earlier omitted history is harmless only when it
cannot tie the newest owner decision. The existing projection supplies source
App, Task, accepted attempt and timestamp; no additional decision store exists.

Both the pinned requested observation and a fresh observation must satisfy that
scope and its definition/responsibility/source binding. Code then reads the
source Task and exact structured `linkedTask`, if distinct, using public
`app.task.get`. Each must supply current obligations, untruncated pending input,
and complete Condition observations. Running/pending/attention work, pending
input, due Task/input/Condition review boundaries, or unknown/newly satisfied
Conditions prevent reuse. False Conditions must be observed at their current
generation. An older Host that omits these reads leaves reuse unavailable.
Reads are bounded snapshots, not a cross-service transaction; owner events and
normal recovery remain responsible for changes arriving afterward.

A matching decision yields `disposition: "decision-reused"` on the existing
review Task, with owner provenance, declared scope, requested and current
observation hashes/cuts, and inspected Task revisions. It advances
`reviewedThrough` monotonically, without a model call, allowance claim, evaluator
report or owner request. This records reuse, not assessment or health. A failed
check leaves the existing bounded evaluation path eligible and records its
reason. Explicit review bypasses reuse; already-staged reports finish publication
first, even if newer scope would allow skipping a fresh assessment.

Conditions and request returns still wake the original owner directly. Deadlines
stay on that Task. Reuse creates no wait, scheduler, repair or escalation path.
Old decisions and prose `revisitWhen` gain no automatic scope. In particular,
`metric.source-query-worst-ms` currently lacks an accepted observable scope;
its truncated examples do not establish the owners' uncontended/equivalent-trial
criteria. May confirmed that gap in accepted attempt
`r_1_feaef4b5-0ef9-460c-a313-cfe04d15dfdc`; no numeric proxy or automatic
scope was adopted. Runtime adoption needs adequate measurement followed by a
new explicit owner decision, not migration of that prose. See [Proposal C](../../../may.app/design/token-efficiency-proposal-20261002.md#c--reuse-an-owner-decision-with-explicit-scope).

## Verification and limits

Reading a retained metric observation does not require resolving its App owner.
May's metric watcher reads that observation directly; Evaluation adds current
App responsibility when preparing a review. Missing catalog access is explicit
coverage information for judgment, not a reason to lose an otherwise valid
sample. Cancellation reaches pending HTTP and socket reads so a stopped
observation does not leave its requests running until separate timeouts.

The source checks cover pre-admission evidence without an execution Task, recurring
failed attempts after later success, coherent denominators, stale observations,
publication failure/replay, integrity rejection, review allowance waits, missed
transition recovery, quiet repeated scans and stable review identity. HTTP tests exercise the shared read and
reject mutation/invalid windows.

This mechanism supplies evidence and a recurring opportunity for judgment. It does
not guarantee complete review coverage at a configured allowance, correct model
diagnosis or autonomous repair. Sampling remains optional; absent reporting is an
explicit coverage failure, not health. Semantic decision quality and original-outcome
recovery require later connected evidence. No new monitoring service, failure-count
stop, metric-specific repair lifecycle or automatic reopening authority is added.

Deploy the reviewed Host evidence endpoint before activating the paired May and
Evaluation definitions. Existing automatic-review settings govern scheduling and
spend; source checks do not enable the feature in a running installation.

## Routine activity measurements

For Task checking frequency, read the actual sample duration, raw outcome counts
and the bounded exact Task references. A skipped check can preserve a valid wait
or recover state; a claim does not establish progress. Compare cost and accepted
Task evidence before recommending an optimization. Recent references are leads,
not a top-offender ranking. The Host evidence read supplies the existing
calculation rule and its value at the pinned cut alongside raw samples, so a
reviewer can distinguish a spike from the smoothed basis of an alert.

The first baseline review can be assigned explicitly through `metric-review`.
Later explicit requests and calibrated breach/recovery routes reuse the same
workflow and retained dispositions. The Host has no default skip-rate threshold.
