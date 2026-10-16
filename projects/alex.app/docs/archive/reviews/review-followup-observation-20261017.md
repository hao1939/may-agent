# Natural audit and review follow-up — October 17

The next scheduled audit retained correction effort and sent no duplicate owner
request. Natural reviews exposed a narrower App contract problem: four successful
reviews needed another reply because `followUp: {kind: "none"}` included a
message. The App now accepts a bounded optional explanation without changing the
explicit no-request decision. No Host change is needed for this fix.

## Scheduled audit

Session `s_1792173641058_376d198b-4268-4669-8375-f142760226c2` ran naturally after
the [audit guidance activation](audit-recovery-cost-20261017.md#verified-local-activation).
Its cut was `2026-10-16T18:00:39.691Z`, comparing the preceding and latest three
hours. It compared 75 versus 47 model sessions and 121 versus 79 Task attempts,
inspected six of the latest 20 evaluator sessions, and retained existing owned
findings without requesting another Task. This demonstrates live no-action
behavior; exact existing-owner delivery remains proven by the offline trial.

Independent correlation confirms three rejected finish calls across two sampled
sessions. One session corrected twice and succeeded; the other hit output
truncation, with the same subject succeeding in a later session. The three
immediate next replies used 19,143 input, 255,488 cache-read, zero cache-write and
4,231 output tokens: **278,862 total**. One legacy reply explicitly says
`finish() error` although `isError` is false. Reading only that flag undercounts
rejections. Call IDs and explicit rejection text establish rejection; repeated
finish calls alone do not. Count each next reply once. This is adjacent effort,
not proven avoidable cost; prices are unknown.

The audit also made two mistakes:

- It guessed ports and sent ISO date strings to `/api/context-usage`, then
  attributed rejection to clock drift. The endpoint requires integer epoch
  milliseconds. A read-only repeat at the configured reporting base succeeded.
  The preceding cohort has 75 invocations but a truncated 50-run listing;
  the latest 47-run listing is complete. Group totals are not truncated.
- It repeated an old completed Task's source-only/unauthorized rollout status,
  overlooking later verified activations. Current release and exact deployment
  receipts must establish installation; missing evidence does not prove missing
  authorization. Prior authorization does not authorize an unrelated deployment.

The evaluator instructions and audit reference now state the existing reporting
base (`MAY_REPORT_BASE_URL`, otherwise `http://localhost:8080`), numeric query
parameters, bounded reads and deployment-evidence check. The live audit used 45
tool calls; these guidance changes have not yet demonstrated lower audit cost.

## Natural review observation

The fixed read-only snapshot at **2026-10-17 03:41:15 Asia/Shanghai** contains 11
started reviews: ten completed/published and one still in progress. Six completed
on their first finish; four needed one correction each. Two completions preceded
Host #374 and both finished first try. Among the eight later completions, four
finished first try and four corrected. This is a small mixed deployment cohort,
not a controlled comparison of #374's effect.

The entire started cohort, including the unfinished review, used 817,406 input,
1,935,424 cache-read, zero cache-write and 82,936 output tokens at that cut.
DeepSeek prices remain unknown. Use completed reviews as the acceptance-rate
denominator; do not count the unfinished review as a failed first finish.

All ten published pairs passed the production integrity reader and current
judgment schema. Review against supplied evidence and retained tool results found:

| Publication event | Supported conclusion and limit |
| --- | --- |
| 6676114 | Adverse metric breach, 28 against threshold 5; the existing follow-up was retained |
| 6676227 | Deployment was awaiting a fresh below-threshold sample; no premature recovery claim |
| 6676339 | Latest metric 2 and resolved alert establish observed recovery; attribution limits remain explicit |
| 6676476 | Scout library observer awaited a new tick after 25 accepted facts; no age-only failure claim |
| 6676552 | A concrete human review wait is supported; retained git/hash reads corroborate integration |
| 6676801 | The observer then completed a new cycle with new evidence, rather than repeating the prior report |
| 6676829 | Agentfootprint publication is backed by retained git and pinned-source reads |
| 6676857 | Renor publication is backed by retained git and pinned-source reads |
| 6676890 | The finite cleanup wait names the same 11 refs and outstanding decision as its pinned Task |
| 6676916 | Hygiene wait and next deadline are supported; failed external access is acknowledged |

This is a bounded semantic check, not a new exhaustive validation of external
sources. All ten dispositions are `assessed`; natural handling of an
`insufficient-evidence` disposition is still unobserved. The target of 50 natural
reviews remains open. No production review was generated to fill the sample.

## App correction

All four post-#374 rejections identify the extra `followUp.message` under
`kind: "none"`: three empty strings and one explanation that no intervention is
needed. Host #374 correctly enforced the App's declared shape, returning compact
diagnostics of 487, 487, 365 and 487 characters. Three corrected judgments only
removed the message. The fourth also changed two citations from `rawLine` to
`rawLines`; that prose edit was not a validation requirement.

The four immediate correction replies used 63,668 input, 231,360 cache-read,
zero cache-write and 7,016 output tokens: **302,044 total**. Their eventual
successful reports remain useful work. These tokens measure adjacent usage,
including cache reads, not established avoidable cost or future savings.

The shared App schema now permits an optional string message of at most 2,000
characters on `none`. Its original value is retained in JSON, and nonempty text
is rendered as explanation in Markdown. Only `kind` decides attention; even
request-like prose under `none` stays quiet. `request` still requires nonblank
bounded text. Wrong types, nulls, oversized strings and unknown fields remain
invalid. No coercion or text interpretation was added, and historical report
files are unchanged.

Task and metric reviews use the same contract. Publication retries retain the
same judgment and files without another model call. The real installed Host
runner accepts both empty and explanatory messages in one scripted reply with
the exact result preserved. No Host patch, schedule/model/budget change, Task
control, external model call or synthetic production review was needed.

## Verification and remaining evidence

The focused suites pass 142 tests / 833 assertions, including the real-runner,
publication retry, report integrity and quiet-routing cases. Strict TypeScript
checks cover the changed production graph, schema fixtures, App routing tests
and recovery trial; the repository's root typecheck also passes. A broader
strict check of legacy workflow test fixtures exposes existing context/mock type
errors, reproduced on the unchanged base. It is not reported as passing.
Read-only replay of the four original rejected judgments confirms that the prior
App reader rejects each and the new reader accepts each without changing a value.

Paired App/SDK artifact compatibility passes against the installed
`e982e7537712e58e06e0a3733152964b5689a0ec` SDK, loading all four source definitions
(including the sample App). This does not enable the sample App in production.
Design and whitespace checks pass; the design checker retains the existing
unclassified-root `reports` warning.

After activation, observe natural first-finish acceptance, retained explanations,
quiet routing, useful report quality and the next scheduled audit. Keep the
activation boundary separate from this ten-review baseline. Do not infer savings
from tests or from the size of a correction reply alone.

Private read-only evidence is retained under
`/home/hao/workspace-worktrees/may-token-review-20261016/`: the `audit-live-*`
records, `post-audit-observation-20261017.json`,
`post-audit-report-integrity-20261017.json`, and `followup-explanation-*` cases and
check logs. Original transcripts and published reports remain untouched.

## Verified local activation

App source `64f475cba79824cd804b0c921ab72a22edb8b600` was integrated into local
main and activated at **2026-10-17 03:50:06 Asia/Shanghai**. Normal reload request
`6676985` links to successful completion `6676989`, which names that exact
source. The active manifest matches it. Read-back verified the installed shared
schema, renderer, review workflows, evaluator instructions and audit reference
against committed bytes; DeepSeek receives the same evaluator instructions.

Readiness is true and the same three Apps remain registered: Alex, May and Scout
knowledge library. The App definition and both evaluator configurations match
the previous release, preserving schedules, models and budgets. Host remains
`v5.5.0 (e982e753)`. The release also includes the already-integrated design and
Scout publication updates since the previous release; it changes no other
executable App behavior. Existing unrelated untracked files were preserved.

The activation receipt and `followup-explanation-loaded-verification.json`
establish installation. They do not establish live savings or first-finish
acceptance after this activation. The ten-review observation above remains the
fixed baseline; subsequent natural observations must use this rollout boundary.
