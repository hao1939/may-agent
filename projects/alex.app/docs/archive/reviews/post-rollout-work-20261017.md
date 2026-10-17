# Post-rollout work review — October 17

**Supports:** [Useful agent work and recovery](../../proposals/unified-agent-recovery-20261017.md)
and [Proposal C](../../../../may.app/design/token-efficiency-proposal-20261002.md#c--reuse-an-owner-decision-with-explicit-scope).

## Conclusion

The fixes work at the inspected selection boundaries, but the repeated metric
judgment problem is not solved. The unrelated-producer fix now yields stable
evidence for the previously over-reviewed waiting Task. Proposal C is loaded
and conservatively declines unsupported reuse, so this metric still pays for
another model judgment on a new transition. A separate owner recommendation
also failed to enter the metric decision projection. More measurement alone
would not close that result-to-reader gap.

## Window and accounting

The follow-up covers October 17 **10:13:15–11:37:12 UTC**, or
**18:13:15–19:37:12 China time**, after the previous audit cutoff. The
unrelated-producer fix activated at 10:42:52 UTC; Proposal C activated at
11:27:04 UTC. Only about ten minutes of this window use Proposal C. Current
release remains `03cfc3546f`; later evidence reads are identified as current
readbacks, not additional executions within the fixed cohort.

All usage pages are untruncated. There are 18 model invocations: 13 Evaluator,
3 May and 2 Alex. Recorded usage is 1,197,766 input, 4,227,584 cache-read and
108,599 output tokens; no cache writes. These cumulative reply counts are not
unique context or billed cost. DeepSeek's missing price estimates are not free
execution. Workflow and Task counters are separate from model invocations.

## What is working

- All 17 selector Task attempts completed without a matching model invocation.
  Five of 13 metric-review attempts also completed without a model. Inspected
  allowance deferrals retained due work without polling with an agent.
- Alex's waiting Task `input/app_c16ddfaa-d95f-4c03-bbfa-9a89ab326132` received
  one review after the evidence-normalization rollout, at 11:10 UTC. Its new
  hash `c7ccd01224c5e745…` matches a fresh read through the loaded code. Only
  the two genuine May dependencies remain; ongoing Scout producer activity
  is absent from that identity. The one new review establishes the normalized
  baseline; no further review of this Task occurred before the cutoff. Scout
  did no new work in this short window, so future producer churn is covered
  by the retained replay, not a new live churn trial.
- Proposal C's live 11:31 metric attempt records
  `reuseEligibility: latest-decision-has-no-valid-scope`, then retains the due
  review until allowance is available. This is the intended fallback, not
  an accidental suppression of changed evidence.

## What still consumes repeated work

Eight model reviews of `metric.source-query-worst-ms` used **1,971,199 recorded
tokens**, including 1,557,696 cache reads. Six returned `followUp.kind=none`,
using 1,418,294 tokens. The other two requested follow-up; the 11:15 report's
publication failed at a stale-attempt fence, while the 11:25 report reached
Alex and May. Report creation, publication and owner action are distinct.

The **11:35 review ran from the Proposal C release**, used 55,104 input,
230,720 cache-read and 10,035 output tokens, and again requested no owner action.
It reexamined the mild threshold oscillation and previously investigated
multi-second spikes. Its wider DB read corrected an omitted example in the
packet, but those two query fingerprints were already covered by the owner's
retained investigation. No accepted scope exists to avoid this repeated
judgment. The short window does not establish a long-term usage trend, but it
does demonstrate that this concrete loop still spends model tokens.

## A separate decision did not reach the metric reader

The 11:25 report prompted Alex Task
`input/app_c45a0ed0-6294-4348-ba70-29c373831c58`, which commissioned May Task
`goal/appdep_1a481a134e3509e2eb2263a1`. May recommended changing the alert
boundary from 100 to 250 ms and retaining reconsideration for sustained median
growth or renewed >1 s spikes. Alex accepted the returned decision. This was
separate from the authorized Proposal C scope request.

Their accepted results explicitly state `configurationApplied: false`.
The current metric still exposes threshold 100. Completing a decision-only
request is legitimate; it does not implement the recommendation or reduce
review traffic. The recommendation's merits still need review against the
performance target, not just the observed frequency of crossings.

More concretely, May retained a custom `metric-disposition` with unsupported
`disposition: recalibrate-threshold` and no `alertId`. It is an ordinary accepted
Task fact, but it does not satisfy the existing metric-disposition projection
contract. A current public evidence read omits it and still exposes the earlier
unscoped no-change decision as newest. The Host view accepts the four established
dispositions and requires an explicit null or positive alert ID. App completion
did not establish that the downstream consumer could read the decision.

Close this through the existing typed `metric-response` composition and
readback contract. A proposed configuration change can be retained as linked
work with a valid supported disposition; making every free-form label a new
Host lifecycle value is unnecessary. Ownership, remaining implementation work
and the return route should stay visible on the existing Tasks. This review
does not apply the threshold recommendation or commission another agent call.

## Evaluator still conflates compliance with useful policy

At 11:30 UTC Evaluator reviewed Scout's Reddit Task and concluded that recurring
review-only no-ops were justified because the owner policy mandates them. It
requested no follow-up. The previous reviewed snapshot had a pending scheduled
input; this snapshot includes its accepted no-op result, so this is not evidence
of duplicate selection on identical Task state.

The judgment correctly recognizes the restriction and the earlier operator-led
feed success. It does not resolve the value question: repeatedly reading the
same access restriction creates no research, recovery or new decision. Evaluate
worker compliance and the usefulness of the governing policy separately. Alex
should own any policy improvement; Scout should preserve its restriction until
that decision changes. No Scout attempt or new research publication occurred
in this follow-up window, so it cannot validate fresh research behavior.

## Reliability and next priority

One of 41 Task attempts failed: the 11:15 metric review hit a stale-attempt
publication fence. Later generations completed and the review Task reads done;
there is no stuck attempt demonstrated here. The failure preceded Proposal C,
and the exact invalidation cause was not traced in this review. Successful
continuation does not prove the earlier report's intended follow-up was delivered.

The next priority is App follow-through: ensure accepted metric decisions reach
their declared reader and make remaining implementation explicit on existing
work. Then let Alex scope the minimal Host measurement needed for an owner-
justified reuse policy. Evaluator should assess the recurring policy's value
without reopening the same unchanged investigation. Do not claim token savings
from a loaded feature, a quieter scalar, or an unapplied recommendation.

## Evidence

Read-only public API/control snapshots and report summaries are retained at
`/home/hao/workspace-archive/may-post-rollout-review-20261017T1136/`:
`window.json`, `usage-*.json`, `summary.json`, `workflows.json`, `attempts-*.json`,
the six exact Task reads, `metric-reports-summary.json`,
`old-wait-current-evidence.json` and `metric-live.json`.
The [preceding rollout](recent-app-work-20261017.md#owner-decision-reuse-activation)
retains activation hashes and loaded-code tests. This review made no runtime
changes and commissioned no additional model work.
