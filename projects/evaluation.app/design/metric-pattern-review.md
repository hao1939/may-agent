# Metric observations in the existing review loop

**Design status:** Accepted for the first implementation.
**Implementation status:** Source candidate; isolated App tests, source-SDK type
checks, syntax build and design checks pass. The paired Host endpoint is reviewed
and validated through its separate PR.
No installation activation or model-backed judgment trial is implied.

Persistent failures should receive investigation and an accountable response while
Host retries continue with backoff. This extends the existing
[systemic review](systemic-pattern-review-20260927.md) to observations that do not
have a Task, including failed input admission. It reuses
[metrics](../../may-agent.app/docs/2a-design/metrics.md) and May's
[improvement loop](../../may.app/design/evaluation-improvement-loop.md).

## Ownership and flow

Host preserves input, Task and attempt facts. Its optional reporting adapter
provides `GET /api/metrics/:id/evidence`: current metric definition, observations
before a fixed cut, two adjacent windows, code-calculated changes, bounded sample
examples, collection failures and freshness. A missing metric returns unavailable;
old observations remain visible even outside both windows. Sample counts/minima/
maxima cover the whole retained window while examples are explicitly bounded.
Changes compare values, not sums of rolling counts or inferred counter rates.
Current definitions are not historical definition snapshots. Retention and missing
intervals remain evidence limits.

May declares the initial sources and attention thresholds: current unresolved
input recovery count, oldest unresolved recovery age, rolling failed Task attempts
with the exact terminal denominator, and unfinished Evaluation review age. These
read existing records, preserve exact examples and exclude Evaluation from its own
semantic review population. Age includes old unfinished work; a count of zero with
no observations is not a successful-work percentage. The thresholds request
attention and do not cap retries or choose a repair.

Evaluation explicitly subscribes to metric breach, recovery, stall and collection
failure events. They wake its existing selector when automatic review is enabled;
the existing periodic schedule supplies another opportunity to notice persistent
concerns. The selector alternates metric and Task opportunities, visits a bounded
number of declared external App metrics, and retains its cursor in its ordinary
Task result. It can select open alerts, changed observations, missing/stale samples
or collection failures. An event is a prompt to reread current evidence, not a
request for a new model call for every retry.

One stable Evaluation Task per metric/reviewer retains the requested cut, shared
review allowance and next review point. Pending review work takes precedence over
routine sampling. Budget exhaustion retains a timed wait; failed reads/reviewer
execution remain incomplete and report through the existing owner path. Ordinary
Task sampling can continue when metric evidence acquisition fails. Fixed evidence
and staged report bytes let publication retry without repeating the model call.
Completed reports suppress duplicate publication; later due observations can
reconsider an unchanged concern.

Metric reports use the existing judgment schema, immutable report storage,
publication marker, bounded reader and May intake. Their subject is
`{appId, metricId}` under `metric-observation-v1`; Task subjects and old paths
remain unchanged. No placeholder Task is used as evidence. The metric report hash
binds its captured observations; altered report bytes or mixed subject/rubric
identities are rejected. May reads the publication and fresh metric evidence before
judging present relevance. Historical findings are not silently treated as current.
Oversized judgments or current metric evidence are explicitly omitted from the
bounded intake result and require reading the exact source before a decision.

May owns disposition and intervention. It reuses linked work when the scope fits;
otherwise an independently owned outcome uses an ordinary Task. Unresolved concerns
retain an owner, next action or justified wait, next review boundary and evidence.
One metric can contain several causes: a correlation key is not a claim that all
findings have the same cause. Acknowledgment, a proposed patch and improvement in
an aggregate do not prove fulfillment of the original input.

The unfinished Evaluation review metric routes its initial alert directly to May,
not to Evaluation for semantic self-assessment. Changed-value repeats do not create
another May message every sample. May owns continuing follow-up using its existing
Task controls and review boundaries. The age threshold is an attention policy, not
a promised response deadline. Zero queued reviews does not prove review coverage.

## Verification and limits

The source checks cover pre-admission evidence without an execution Task, recurring
failed attempts after later success, coherent denominators, stale observations,
publication failure/replay, integrity rejection, review allowance waits, periodic
reconsideration and stable review identity. HTTP tests exercise the shared read and
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
