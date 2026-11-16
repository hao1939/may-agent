# Cumulative review rounds in hosted Alex — 2026-11-16

The [source repair](alex-review-rounds-repair-20261116.md) is integrated and
active. A fresh hosted Task retained its allowance across four calls in one
live owner attempt: cumulative usage was **1, 2, 3, 3**. The fourth call returned
incomplete before any specialist, verification or new reservation. Alex resumed
after its helper returned, audited the result and closed both finite Tasks.

This verifies the specific accounting repair in hosted execution. The original
[seven-round delivery](gym-reporting-delivery-trial-20261116.md) remains historical;
this trial makes no claim of general unattended reliability or lower cost.

## Reviewed source and activation

Seven selected paths were reviewed at candidate
`94851c89fb1fa99005058b583be90179a91973ee`, based on
`30e1cb607012c299d78ad59c72b6167d82bd8145`. Workflow
`wr_1794837386256_3j0z` verified the exact clean candidate and received Bob's
independent pass. Its pre-activation workflow binding was the previous source;
it is source-review evidence, separate from the fresh runtime proof below.

Alex integrated the candidate over concurrent work as
`87615a2ff88c87642b1eaf357f15f0f7fd5ac527`. The integration receipt preserves
72 unrelated dirty-path entries and the unrelated index. The final independent
audit also matched all 103 admission-time file hashes; concurrent Scout commits
were retained. Two broken Gym instruction links and the outdated per-invocation
round description were corrected within the reviewed scope.

One pinned definition activation, request `alex-cumulative-rounds-hosted-20261116`,
was admitted as event `6727055` and succeeded as `6727059`. Active release:
`87615a2ff88c87642b1eaf357f15f0f7fd5ac527-definitions-v6`.
Selected candidate, integrated, staged and active hashes matched. The release's
source delta changes two callable implementation files; other captured deltas
are tests, documentation and the release manifest. Host PID/start identity and
enabled Apps remained unchanged.

Runtime source identities:

| File | SHA-256 |
| --- | --- |
| `develop-change.ts` | `7d38be06d97359f1eda93f89594414d90d7eab3df22dd63255805155e96451f6` |
| `lib/development-rounds.ts` | `3faf563a05a6baed4261e972e8307ff3833755754703d29b75bfacd0b95e6fbf` |

## Fresh hosted measurement

Owner Task: `alex/input/app_7358c630-4043-4d67-9710-e6c1faa1e6fa`.
Helper Task: `alex/input/appdep_ba9190cdd137e06728659913`.
All four calls belong to helper attempt
`r_1_fb8404c4-89b7-4df7-a986-819f604ec62e`, without Task settlement between calls.
Every public workflow record identifies the new release and source hash above.
The clean tested candidate, `0e64bf16796e20b1e1f9dd3625dc96c55860782e`, descends
from the integrated commit and contains the same selected bytes. No change was
invented to create work.

| Call / workflow | Cumulative rounds | Result | Actual work | Elapsed |
| --- | --- | --- | --- | --- |
| 1 / `wr_1794837605604_nidf` | 1 | converged | 55 tests pass; Bob design and independent review | 37.317 s |
| 2 / `wr_1794837695708_7zvc` | 2 | converged | 55 tests pass; Bob design and independent review | 39.757 s |
| 3 / `wr_1794837743501_95pj` | 3 | converged | 55 tests pass; Bob design and independent review | 36.722 s |
| 4 / `wr_1794837801652_vhbh` | 3 | incomplete, expected | no specialist or verification | 0.145 s |

The first verification command was:

```text
bun test --tsconfig-override /app/.state/alex-review-rounds-hosted-20261116/installed-sdk-tsconfig.json ./projects/alex.app/agents/alex/workflows/develop-change.test.ts ./shared/tools/task-evidence.test.ts --timeout 45000
```

Call 2 reversed the files. Call 3 restored their order and removed the first
path's leading `./`. Call 4 restored that prefix and reversed the files again.
The changed exact argv required new verification without renewing the allowance.
All three executed receipts exited 0 with 55 passes, zero failures and 327
assertions. Bun emitted a nonfatal directory-mismatch diagnostic, retained in
the raw receipts.

Immediately before and after call 4, specialist sessions remained **6**, summed
specialist operations **15**, verification records **3**, reservations **3**.
The independent public fourth workflow has no steps or children, and its
hash-bound aggregate contains no verification or review. Its incomplete result
honestly retains unfinished acceptance. The audit Task itself could finish
because measuring this stop was its assigned outcome.

## Follow-through, checks and cost

Dependency event `6727141` is an actual `app.dependency.updated` event with the
helper's done result linked to the exact parent. Alex's second owner attempt
resumed at `14:04:44.820 UTC`, independently inspected the helper archive,
closed the helper at resourceVersion 5 and closed its own Task at
`14:06:40.731 UTC`. No operator correction message was sent after admission.
Admission through owner closure took about **10 minutes 39 seconds**; operator
preparation and the independent final audit are outside that duration.

The isolated candidate's `check:may-design` passed after fixing the links.
Focused candidate checks and the hosted receipts passed. The first operator
command put Bun's tsconfig option before `test`, invoking the broader package
script instead: 151 passed and two evaluator tests failed. Both logs are
retained; the corrected focused command passed. No aggregate CI success is
claimed.

The owner and helper summaries incorrectly call the focused passing command
`check:ci`. That command was never run. The raw receipts support only the
explicit 55-test command above. This is a separate reporting defect, retained
for later triage; agent guidance was not tuned during this experiment.

Public Task-scoped context-usage reports captured after closure cover all
**11 completed model sessions**: two owner attempts, two source-review Bob
sessions, one helper owner and six helper Bob sessions. Model estimates are
**$4.907078** for the owner Task and **$3.7579188** for the helper, **$8.6649968**
combined. Queries ended at `14:06:55.738` and `14:06:55.786 UTC`, with no group
or run truncation and no remaining live session tail. The helper's public
attempt link list was truncated; workflow-step links recovered all six Bob
sessions and matched the usage session set. These are model price estimates,
not billed cost; operator and external costs are excluded. Alex's own handoff
had only operation counts at its earlier live cutoff; the later public reports
supply these estimates. No cost improvement is established.

## Evidence and remaining direction

Audit root: `/app/.state/alex-review-rounds-hosted-20261116/`.
`final-verification.json` records independent checks against public Tasks,
workflow records, active source and retained content hashes. `public/` retains
all exact attempts, sessions and usage reports. `alex-evidence/` contains the
source review, integration/release receipts, per-call archives and Alex's
final disposition. All three archive manifests validated: 8 source-review
files, 139 helper files and 2 final handoff files. Alex supplied a custom
disposition, not a generated `cycle-record.json`; the cycle-record validator
does not validate that custom schema.

The existing standing system-wide review Task
`alex/input/app_82bccb7e-cdab-4ea4-875b-7d99945fec93` remains exactly unchanged:
waiting, generation 1, resourceVersion 12, identity `system/improvement-review`,
due **November 17, 2026 at 09:00 UTC**. The next step is to observe that review's
evidence-based selection, bounded action or quiet no-change, and same-Task
rearming. No new schedule, experiment or activation was started.

Restart and archive/workspace-replacement recovery, cross-Task incident budgets,
and repeated daily reliability remain unverified. This controlled trial used
an unchanged candidate; it does not demonstrate a fresh software repair under
the bound. Alex's plan now references this operational evidence without adding
a benchmark run, selecting a baseline or promoting a benchmark result.
