# System-wide daily improvement review — 2026-11-16

Alex owns system-wide improvement. May was the first pilot, not the standing
scope boundary. The existing daily Task accepted this correction and is waiting
for **2026-11-17 at 09:00 UTC**. The cadence remains daily at 09:00 UTC.

Alex chooses the highest-value supported problem by its impact on reliable
useful delivery, attributable human correction effort, and total time and cost.
Installed agents and Apps, workflows, benchmarks/evaluation, tools and the
improvement process itself are eligible. May, Alex, Bob, Tech-lead and Scout can
all be subjects; May has no default priority. There is **one active problem across
the system**, not a requirement to review every agent or make a change every day.

Start from fresh existing audit, daily-work and evaluation signals, reuse
accountable work and inspect at most ten subject requests total and three
supporting records per review across selected targets. Choose a target's fitting
evaluation plan and whole purpose benchmarks. Unknown plan or score coverage
remains unknown; different roles do not become filters inside May benchmarks.
Unchanged evidence supports quiet no-change, without helpers or benchmarks.

Carry one incident and its cumulative limits across attempts and days: at most
two new whole-benchmark runs including retries, one development invocation, and
three automated review/repair rounds. A new day does not reset those limits.
Candidate work remains isolated and local; publication, PRs, merge, production
application, activation, deploy/restart, truth approval and baseline promotion
are outside this assignment. The owner wake can still consume model tokens.

| Observation | Verified scope-correction state |
| --- | --- |
| Owner | Alex |
| Standing Task | `alex/input/app_82bccb7e-cdab-4ea4-875b-7d99945fec93` |
| Scope-correction admission event | `6726836` |
| Accepted scope-correction attempt | `r_1_1b71258a-7ff8-4ae3-a489-a388c392171e` |
| Canonical state | waiting, generation 1, resourceVersion 12 |
| First review deadline | `1794906000000` = `2026-11-17T09:00:00Z` |
| Current policy identity | `result.periodicReview.identity = system/improvement-review` |
| Active incidents / new runs / development invocations | 0 / 0 / 0 |

Observe this Task through `app.task.get` with App `alex` and the ID above. Read
`currentObligations.reviewAt` for timing and `result.periodicReview` for current
scope, selection policy, checkpoint, counters and next action. Both the original
standing input and correction input retain the same deadline. Alex must return
the next future daily `reviewAt` after each review; no second scheduler was added.

The original durable outcome/title still describes the May setup. This was an
addressed input correction on the same generation, not a formal spec rewrite.
The accepted result explicitly records the superseding system-wide policy and
correction input identity for later wakes. Historical May evidence stays intact.

The [scope-correction audit](agent-reports/system-periodic-review-20261116.json)
links canonical receipts, the retained checkpoint and final session usage. The
correction used one Alex session, seven replies, 87.456 seconds and a $0.502192
SDK model-cost estimate. It launched no investigation, helper, candidate or
benchmark. Alex recovered a missing `python` command using Node and corrected a
rejected waiting-result response in the same attempt, without operator input.
Billing and operator effort remain unknown.

Setup and scope acceptance are verified. The first due wake, subsequent rearming,
restart recovery, system-wide target selection and hard cumulative-budget
enforcement remain unobserved. The old setup cutoff is bookkeeping, not an
exhaustive processing cursor; later discovery must overlap bounded evidence and
deduplicate actual identities so unseen work is not silently skipped.

The [original May setup](may-periodic-review-20261116.md) and
[finite hosted pilot](may-hosted-cycle-20261116.md) retain their dated scope and
evidence. The concrete review-accounting defect in Alex's evaluation plan remains
a valid lead; broadening scope does not preselect or replace that work.

The later [manual system-wide review](system-manual-review-20261116.md) exercised
selection and same-Task rearming before the deadline. It retained one local
reporting-rule candidate with an exhausted review allowance and no final
independent pass, exposing development-handoff and verification-environment
gaps. It preserved the November 17 deadline; automatic due-day behavior remains
unobserved. This later state supersedes the zero-incident setup snapshot above.
