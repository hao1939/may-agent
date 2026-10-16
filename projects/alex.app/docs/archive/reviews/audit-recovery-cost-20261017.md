# Audit of recovered correction cost — October 17

Existing retained records expose correction effort separately from successful
outcomes. No Host instrumentation gap was demonstrated. The App audit procedure
now specifies bounded reads of that evidence and exact targeting of existing
owner Tasks. A connected offline trial verifies retention and request delivery;
it does not prove that a model will choose the right disposition.

## Historical evidence

The last accepted standing audit used a fixed cut of
`2026-10-16T12:00:18.079Z`, comparing 06:00:18–09:00:18 with 09:00:18–12:00:18 UTC.
It reported 32 then 34 DeepSeek invocations and kept recovered incidents distinct
from recurring patterns, but did not count finish corrections. A read-only replay
of those exact invocation-start cohorts found:

| Observation | Preceding three hours | Latest three hours |
| --- | ---: | ---: |
| Invocations / readable transcripts | 32 / 32 | 34 / 34 |
| Successful invocations with rejected finish calls | 15 | 18 |
| Rejected finish calls | 17 | 18 |
| Immediate next replies | 17 | 18 |
| Next-reply input tokens | 218,433 | 303,387 |
| Next-reply cache-read tokens | 855,040 | 908,992 |
| Next-reply cache-write tokens | 0 | 0 |
| Next-reply output tokens | 36,509 | 39,624 |

All 33 affected invocations eventually completed successfully. The 35 immediate
next replies total 2,361,985 tokens including cache reads. This is
**correction-adjacent usage, not measured avoidable cost**. Successful outcomes do
not erase it, and these historical results do not measure #374's benefit. Each
reply is counted once, even if it follows several tool errors. Rejections are
established by correlated error results, not merely multiple finish calls.

All 66 transcripts fit the replay's per-file bound; the replay allowed at most
100 invocations and 8 MB per transcript. The public context-usage endpoint
independently returned both complete cohorts without group/run truncation. A
representative public transcript exposed the same rejected/accepted call IDs,
error flags and per-reply usage as the retained original. No new observation
schema or transcript export endpoint was needed.

Totals are retrospective invocation-cohort reads, not a reconstruction of what
was known at the old cut. None of these invocations was updated after that cut.
One of the preceding cohort's 120 replies lacks measured usage; the latest has
157/157 measured replies. Both cohorts have zero priced replies: their money
cost remains unknown. The audit does not score evaluator semantic outputs.

## Follow-up routing and installed guidance

The prior audit named an existing Alex Task in prose/context but omitted the
request's `taskId`. Admission consequently created an additional intake Task
`input/appdep_30f208c648571c08ccdc2166`; the named existing owner was
`input/appdep_17f2f23dab68e23f5edae6a6`. That intake did reconcile through existing
ownership, so this is not evidence of a duplicate implementation. Its retained
invocation used 674,325 tokens including cache reads; that entire amount is not
proved avoidable. The Host already supports directly targeting an existing Task.

The [audit procedure](../../evaluation/systemic-pattern-review-20260927.md#six-hour-cross-task-operational-audit)
now specifies the existing usage/session reads, coverage limits, correction
correlation and measured token categories. It also says to set `taskId` when a
finding belongs to an existing open Alex Task's accepted scope. Merely mentioning
an owner does not route input to it. New assignments can use ordinary intake;
unchanged findings remain saved without a request.

The retained audit workspace was at source `650753398d`, so a canonical reference
document edit alone would not establish that the next attempt reads it. The key
rules are also in Evaluator's installed instructions, which take precedence over
an older workspace reference. Their verified activation is recorded below.

## Connected verification

The new case in [recovery-contract.test.ts](../../../recovery-contract.test.ts)
uses the real Alex definition, file-backed Host admission/settlement and targeted
requests with a scripted executor. It runs three audit inputs through the same
standing Task: a transient with no action, new recurring evidence delivered to an
existing repair Task, then an unchanged finding with no request. Across restarts,
the next attempt receives the preceding accepted audit result. Replayed input
creates neither another audit execution nor another owner request. The final
fixture has exactly two Tasks and one targeted request.

Eight recovery tests (112 assertions), 16 App-routing/systemic-review tests
(82 assertions), and a strict TypeScript check passed. A fixture type error for an
optional schedule input was corrected with an explicit presence check. Policy
choices are scripted; the trial proves transport, identity and restart behavior,
not model judgment or savings. No external model calls or live Task controls were
used, and no schedule, model, or budget was changed.

At **2026-10-17 01:22:51 Asia/Shanghai**, natural Proposal B observation remained
2/50 reviews with 2/10 reports inspected, both preceding #374. The next naturally
due standing audit must still demonstrate use of the updated instructions and
useful dispositions. Do not create extra production reviews to fill that gap.

Private evidence is retained under
`/home/hao/workspace-worktrees/may-token-review-20261016/` with `audit-*` prefixes:
cohort replay, public usage/transcript reads, routing evidence and check logs.

## Verified local activation

App source `7e50a70b599160540e2715f480ca36ea293d7c20` was integrated locally and
activated at **2026-10-17 01:24:49 Asia/Shanghai**. Normal reload request event
`6676296` links to successful completion `6676297`, which names that exact source.
The active release manifest matches it. Read-back verified that installed
Evaluator instructions and the audit reference document exactly match the
committed bytes; the App definition and evaluator configuration are unchanged
from the previous release. All three Apps remain registered and readiness is
true. Host remains `v5.5.0 (e982e753)`.

The reload also includes already-integrated design/manual changes since the
previous App release. No executable App workflow, schedule, model or budget
changed. Design-integrity checks passed with the existing unclassified-root
`reports` warning. This establishes installed guidance, not yet a model-backed
audit using it; the natural observation requirement remains open.
