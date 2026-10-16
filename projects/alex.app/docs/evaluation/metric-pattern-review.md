# Metric observations in the existing review loop

**Design status:** Accepted for the first implementation.
**Implementation status:** Activated on October 3 in Apps release `1e97bd70e1`
with Host `14491241d`. Live collection, breach and recovery reached the same
Evaluation Task; its completed report reached May and was handed to the existing
investigation. Sustained repair verification remains separate; see the
[live verification](../proposals/responsive-host-recovery-20261002.md#october-3-merged-host-and-metric-loop-rollout).

**October 16 refinement:** Transition-only automatic selection is implemented in
the candidate Apps source and tested locally, but has not been activated. Earlier
source also selected ordinary changes and reconsidered open alerts daily. The
contract below describes the correction; deployment must be verified separately.

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
Task leaves evidence unavailable; it does not authorize replacement work. Later
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
