# Repeated review-only cost — October 17

The first natural review confirms the deployed no-action explanation fix. A
separate read-only investigation found that recurring review-only work remains
expensive even when its decisions are correct. The next candidate belongs to
**App execution and review policy**, not Host result validation or deduplication.
No new production change is included in this observation.

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

## Next implementation target

Start with Alex's review selection: distinguish a routine newly queued schedule
opportunity from a changed result, failure, unresolved wait, or overdue
obligation that warrants another semantic assessment. Preserve the ability to
notice starved queued work and to honor explicit review requests. Reuse the
existing Task/report identities and periodic audit; do not add a Host suppression
rule or silently remove pending evidence from snapshots.

Before rollout, replay these exact pairs alongside contrasting cases: a changed
human request, failed attempt, material result, deadline crossing, and a queued
Task that remains unserved. The candidate must reduce the redundant routine
queue-phase reviews while retaining each contrasting case's review route.
Report reused assessments honestly; a retained earlier report is not a fresh
assessment of new input. No change to schedule cadence, model or budget is
required to test this selection policy.

Scout's repeated known no-op is a second candidate for a cheap workflow decision.
It must preserve all three exit triggers, independent pending obligations and
fallback to the agent when the source state or input is ambiguous. The current
policy's prose and recorded decisions are evidence for designing that boundary,
not sufficient grounds for a generic hardcoded skip of Reddit work.

No schedule, Task control, source access, model route or runtime setting was
changed. No new owner request was sent. The next natural audit still needs to
demonstrate its updated evidence procedure, and the 50-review observation remains
open. Private evidence, including all 15 usage records, six source decisions and
the paired snapshot differences, is retained in
`/home/hao/workspace-worktrees/may-token-review-20261016/reddit-noop-cost-observation-20261017.json`.
