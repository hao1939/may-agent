# System-wide daily improvement review — 2026-11-16

**Latest observed state:** the 21:36 UTC manual early pass woke and rearmed, but
regressed to a May-only checkpoint and omitted explicit scope/incident history.
The canonical assignment still says May. System-wide continued operation is
not validated; see the final section. No corrective wake has been sent.

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

## Later update: small coordinator, finite work Tasks

The user approved splitting periodic coordination from actual work. The earlier
oversized draft was **not submitted**. Event **`6730297`** addressed the existing
standing Task; it did not create another recurring job or a Gym-only scheduler.
The accepted policy now selects or reuses at most one useful finite Task,
collects its disposition, retains links/cumulative budgets and rearms. It does
not implement the whole roadmap or automatically start the next work phase.
System-wide scope, retired-incident history and consumed allowances are unchanged.

The first finite assignment was **B2 calibration review/proposal only**:
`alex/input/appdep_171a4b38571d39cf68730bd2`, linked through stable caller request
`gym-b2-calibration-review-v4-20261116`. It reused the four-run comparison and
[v4 attempt report](outcome-v4-attempt-20261116.md), delivered a concise diagnosis
and exact proposed judge wording, and returned without implementation or model
evaluation. Its artifact is
`/app/.state/gym-periodic-split-20261116-01/b2-evidence/review.md`, SHA-256
`202962981af236d65b87b4d517389955ef05dd6150ffb4629dbec63b97387a94`.
The proposal remains **unapproved**. Its suggested two-judge calibration-only
experiment needs a separate bounded commission; no target or judge run occurred.

The normal child return woke the same coordinator, which collected the artifact
and recorded the approval blocker rather than creating speculative implementation
or evaluation Tasks. The coordinator is **waiting, generation 1, resourceVersion
51**. Its current accepted attempt
`r_1_d535b143-81c7-4dc0-a3ab-217bc142f222` retains **top-level
`reviewAt: 1794906000000`**, November 17 at 09:00 UTC. That deadline was verified
through the public accepted-attempt evidence, not merely checkpoint prose.
Automatic due-day wake and repeated unattended reliability remain unobserved.

The finite review is fulfilled and its Task is **idle, not terminally closed**.
The coordinator recorded a closure recommendation but lacked the supported
creator-side close operation in that attempt; it did not invent a successful
closure. Fulfillment, caller return and Task closure remain separate facts.

Three normal owner attempts—setup, finite review, coordinator return—used **23
replies** with a full scoped SDK model-cost estimate of **$1.9991664**. This
excludes the operator session; billing/operator cost remain unknown. Both
coordinator attempts initially submitted waiting results containing `response`;
SDK admission rejected them and they corrected within the same attempts. These
corrections and their usage are retained, not counted as first-try success.
There were no development workflows, benchmark/judge evaluations, source/truth
edits, plan edits or deployment actions. The `agents` call was a capability-list
read, not a specialist execution.

Evidence: `.state/gym-periodic-split-20261116-01/verification.json` links the
public Task/attempt/session/usage reads, admission, accepted checkpoint chain,
artifact hashes and unchanged incident accounting. The same directory retains
the actual submitted input and proposed wording. No new schema, work registry or
scheduler was introduced.

## Manual early-pass test — scope preservation failed

The user requested one immediate check of the small coordinator. Event
**`6730521`** woke the same Task; accepted attempt
`r_1_f023d010-3562-49f0-aba0-e49251d8ea67` ran from **21:36:39.058 to
21:37:48.307 UTC**. It returned waiting at generation 1, resourceVersion **57**,
with the same Host-accepted top-level deadline **2026-11-17 09:00 UTC**.
No new finite Task, benchmark, judge run or implementation was started. The
completed B2 review remained approval-blocked. Budget counters, the plan and
previous checkpoint link were preserved.

This was **not a clean success**. The accepted result changed
`system/improvement-review` to **`may/improvement-review`**, dropped
`currentScope`, and omitted `incidentHistory`. Its new checkpoint explicitly
says “May delivery and efficiency improvement review.” Earlier records remain
recoverable through public accepted evidence and the checkpoint chain; they were
not erased, but the current policy record no longer faithfully carries them.

The canonical Task outcome/acceptance still contain the original May-only
assignment. The system-wide correction had been stored in addressed inputs and
checkpoints rather than a formal specification rewrite. That conflict is a
plausible contributor, not a proved sole cause. The next repair should reconcile
the canonical requirements and retained policy, not merely add another reminder
or schedule another test. That repair was **not** authorized or performed by
this early-pass commission. The daily deadline remains armed; the observed
scope regression is unresolved.

Public Task, attempt, transcript, usage and before/after preservation checks are
retained in `.state/gym-coordinator-early-pass-20261116-01/verification.json`.
The one owner attempt used **seven replies**, **69.249 seconds**, and a scoped
SDK model-cost estimate of **$0.671136**, excluding this operator session.
Billing/operator cost remain unknown. A missing `python` command was recovered
with Node for checkpoint JSON parsing; no functional verification is implied.
There was no finish-envelope rejection in this attempt. This manual wake does
not establish automatic due-day behavior or repeated unattended reliability.
