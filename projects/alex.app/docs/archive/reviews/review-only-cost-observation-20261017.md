# Repeated review-only cost — October 17

The first natural review confirms the deployed no-action explanation fix. A
separate read-only investigation found recurring review-only work that consumes
tokens while making no progress on the assigned research outcome. Its individual
decisions comply with the installed policy; that does not establish useful work.
The next candidate belongs to **App strategy and agent judgment**, not Host
result validation or deduplication. No new production change is included in this
observation.

The subsequent [App implementation](progress-after-wake-20261017.md) restores
progress/recovery as the purpose of the wake and records the offline evidence
review and natural validation boundary.

**User clarification:** scheduled wakes intentionally give the agent an
opportunity to do its job. The defect to address is repeated lack of progress
after waking. Preserve that opportunity and improve what the agent does with it.
The earlier suggestion to suppress no-work invocations or prioritize review
selection is superseded by this clarification.

## Measured cohort

For invocation starts in
`[2026-10-15T19:54:02.260Z, 2026-10-16T19:54:02.260Z)`, the retained usage records
contain six Scout executions of `scout-knowledge-lib/explore-reddit` and nine
DeepSeek evaluations of that Task. All completed successfully.

| Consumer | Invocations | Input | Cache read | Cache write | Output | Total tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Scout source responsibility | 6 | 139,732 | 311,713 | 138,962 | 7,077 | 597,484 |
| Alex evaluations | 9 | 387,047 | 931,456 | 0 | 51,053 | 1,369,556 |
| Combined | 15 | 526,779 | 1,243,169 | 138,962 | 58,130 | 1,967,040 |

These are distinct model invocations, not parent workflow totals added to their
children. The two cohorts share a time window; their boundaries do not pair each
review with one of the six source executions. Cache traffic is included and is
not priced like uncached input. DeepSeek prices remain unknown. This is measured
usage, not a claim that all 1.97 million tokens are removable.

All six Scout finishes record `decision: review-only-no-op`,
`triggerObserved: false`, `httpScan: not-run` and `publication: no-change`.
Their retained calls read the standing policy/context and Task, then finish;
none invokes the exploration workflow. The same accepted ordinary-permalink
403 check from October 4 remains their source state. All nine evaluator reports
select `followUp.kind: none`.

The October 4 [source-owner decision](../../../../scout-knowledge-lib/reports/operations/reddit-source-contract-review-2026-09-24.md)
preserves the four-hour opportunity while suspending identical scans. Its three
exit triggers are newer ordinary-permalink success, a known runtime/network/
access-contract change, or an explicit request for a bounded recheck. Successful
compliance with that policy does not establish that repeated full model reviews
are inexpensive. Elapsed time alone is an inadequate token-cost proxy.

## Apparent duplicates are different Task states

Two pairs evaluated the same accepted source attempt twice:

| Outcome review | Later ongoing review | Actual changed evidence |
| --- | --- | --- |
| `6668801` | `6669277` | New pending scheduled input `6669248`; reconciled Task becomes ready/pending |
| `6675593` | `6675825` | New pending scheduled input `6675803`; reconciled Task becomes ready/pending |

The paired snapshots differ in status, readiness and the new pending input as
well as their administrative revision/time. The later reviews deliberately use
the ongoing rubric instead of the outcome rubric. Therefore this is **not** an
unchanged-evidence hash bug. Removing pending input from the identity would hide
real obligations, including important human or failure input, and is not a valid
fix. The selector currently selects open/pending work for ongoing review; the
observed repeated calls are consistent with that App policy.

## Corrected implementation target: useful work after waking

Start with Scout's assignment and recovery strategy. The declared outcome is to
research useful source-grounded signals, but the installed automatic-wake
acceptance makes honoring the blocked-source policy and finishing review-only a
sufficient local result. Repeated compliance can therefore leave the real
outcome unresolved. Returning the same no-op more cheaply would not repair that
failure to make progress.

Keep the scheduled agent opportunity. At a wake, the agent should use retained
evidence to choose useful work toward the assignment: advance the research,
investigate or repair a blocker through an authorized method, change an
ineffective approach, or resolve an outstanding owner decision. When external
help is necessary, make the concrete request through the existing owner route,
then preserve the genuine wait without duplicating requests. Existing source
access and evidence contracts still apply. Unrelated activity, repeated failing
probes and manufactured output do not count as progress.

Alex's evaluation should distinguish compliance with the last instruction from
progress toward the original outcome. A successful finish or authorized no-op
cannot by itself establish that a recurring strategy is useful. Inspect whether
the blocker is being resolved, whether available recovery work is being ignored,
and whether an obsolete or ineffective instruction needs an owner decision.
Keep the existing Task and accountable owner when follow-up is warranted.

A genuine external wait can still justify no action on a particular wake. The
evaluation must establish that useful authorized work is exhausted and the
dependency has an owner and return path; it must not demand progress that the
agent cannot make. Repeated unchanged narration remains visible as cost and
lack of progress, rather than being praised as productive work.

Before rollout, replay the six retained no-ops and contrasting cases: an
actionable recoverable blocker, a changed access fact, an explicit bounded
recheck request, a genuinely external wait already escalated, and useful
independent work within the assignment. Verify that the agent has a usable
progress/recovery path and the evaluator can distinguish a stalled strategy
from a justified wait. Then observe natural executions for verified progress or
an actionable resolved blocker; lower invocation counts alone do not establish
success. Schedule cadence, wake behavior, model and budget stay unchanged.

Review-selection efficiency remains a secondary question after this progress
failure is addressed. Preserve changed pending input in evidence and retain
coverage for failures, overdue obligations, starved queued work and explicit
review requests. Do not hide the observed stagnation by suppressing the agent
or its evaluator.

No schedule, Task control, source access, model route or runtime setting was
changed. No new owner request was sent. The next natural audit still needs to
demonstrate its updated evidence procedure, and the 50-review observation remains
open. Private evidence, including all 15 usage records, six source decisions and
the paired snapshot differences, is retained in
`/home/hao/workspace-worktrees/may-token-review-20261016/reddit-noop-cost-observation-20261017.json`.
