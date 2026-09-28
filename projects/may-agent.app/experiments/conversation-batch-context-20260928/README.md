# Conversation batch context — September 28, 2026

## Finding and bounded change

A live May turn received an older independent review request and a newer
Evaluation report. The older request was present in the model context, but May
answered only the report. Settlement marked both inputs handled. No accepted
Request remained for the review, so ordinary pending-input recovery had nothing
to retry. The review was later completed through a durable May goal.

The owning evidence is recorded in
[Evaluation owner feedback](../../../evaluation.app/experiments/owner-feedback-20260928/README.md#remaining-independent-gaps).
This is distinct from Event metadata persistence in Host #263: a delivered input
can still be overlooked during judgment.

Baseline Host `6c856911211031d291d94e552c4069bfa03a30eb` foregrounds a single
top-level `input`, then includes the entire batch in `inputs`. Candidate
`aab469a2a7cd1ca951f47dae6933bf73a57e734e`,
[PR #264](https://github.com/hao1939/may-agent/pull/264), presents the complete
claimed batch first and labels reply identity separately. It reminds the agent
to retain unfinished accepted asks through existing Request tools. Core still
selects and orders the batch, validates authority, and settles the whole turn.
No SDK schema, acknowledgment list, scheduler, or Request executor is added.

The [Message Lifecycle](../../docs/2a-design/message-lifecycle.md) owns the
contract. PR #264 merged on September 28 as
`edc43e16b481e88ef1cca67dffb68dd1e4dd76f7`; its tree matches the reviewed
`aab469a2` candidate. Local Host source and the companion design/evidence were
integrated while preserving concurrent Scout commits. This source integration
does not restart the Host or activate a new definition release; deployment
remains separate.

## Authorized local rollout

After the user authorized continuation, the standalone deployment script built
merged Host `edc43e16b481e88ef1cca67dffb68dd1e4dd76f7` from its immutable
archive. Its 64 deployment-boundary tests passed. The exact receipt is
`/app/projects/may-agent/.state/deploy-receipts/conversation-batch-edc43e16-20260928.json`;
it settled at `2026-09-28T03:27:12.302Z` with `phase: succeeded`,
`health: healthy`, and `duplicateDeploy: false`. Expected and loaded artifact
SHA-256 both equal
`872c97c2f93e7ae9fe682c0f4e0c1e8253f6bf7520edf35474bd17a8bf3c6b3d`.

The running container independently reported `may-agent v5.2.0 (edc43e16)`
and the matching binary hash. Runtime, Web and maintenance services were
running; HTTP readiness returned true. SDK and UI links both select releases
named for the full merged Host commit, and installed Console bytes match the
staged Console. The operator shell is outside that container; its older local
binary and absence of `supervisorctl` are not evidence about live service health.

App activation was separate. Ordinary `runtime.reload.requested` event
`6465890` pinned workspace commit
`ced848549f3fd5131bbb12f0e1c8dd5b0bef3be6`; correlated completion `6465891`
reported success, eight updated agents and four App addresses. The active
immutable release is `ced848549f3fd5131bbb12f0e1c8dd5b0bef3be6-definitions-v4`.
This includes the reviewed Evaluation owner-feedback change. See its
[activation evidence](../../../evaluation.app/experiments/owner-feedback-20260928/README.md#local-activation)
for the narrower claim about that connection.

Local rollout preparation and build output are retained in
`/tmp/conversation-batch-rollout-edc43e16-20260928.json` and
`/tmp/conversation-batch-deploy-20260928.log` in the operator environment.

## Installed Conversation trial

May performed the live trial under ordinary Task
`may/goal/app_96c9cd44-114c-4083-b987-a9ab2a8c2171`. Inputs used normal socket
admission and dedicated `may-console` Conversations, without Telegram delivery,
direct database writes, or a runtime pause to force batching. Actual session
prompts establish that each initial pair was claimed together with both
`inputs` before `replyTo`. The installed manager, worker processes, full tool
catalog and `gpt-5.6-sol` ran these turns.

The first two Conversations (`trial-conversation-batch-20260928-a` and `-b`)
passed available-file review plus calculation, and missing-file review plus
calculation followed by file supply. However, their human text explicitly
reminded May not to skip an ask or to retain the Request. They are assisted
smoke checks, not evidence of unprompted recognition. Supervisor feedback
through the same May Task requested ordinary wording; May incorporated it
during her ongoing attempt.

The neutral Conversation `trial-conversation-batch-20260928-c` asked only
“Please review [absolute file path] for correctness risks” and “What is
91 * 13?” The file did not exist yet. May answered **1,183**, checked the
missing path, and saved the review as an open Request without being told to
retain it. The arithmetic answer needed no extra durable Request. A later
ordinary message said the file was available and asked for review. May read it,
identified the synthetic export design's missing account-authorization check,
and closed the original Request, revision 2 to 3. No replacement goal or
handover was created.

Exact neutral-trial identity:

- Conversation Task: `may/conversation_cc05bdae06b7876908553264`.
- Review Request: `app_7af93c52-4b01-4189-b947-4236fa3d94cd`.
- Initial session: `s_1790566262478_ea472f4d-67ca-4639-8b6b-c864056f3db5`.
- Continuation: `s_1790566303770_203a8324-989e-4b30-97b4-280fc26116b6`.
- Before/after snapshots: `/tmp/trial-batch3-neutral-before-supply.json` and
  `/tmp/trial-batch3-neutral-after-supply.json` **inside the runtime container**.

Independent operator inspection checked visible replies, actual prompt batches,
the same Task and Request identities, and stored completion. These are small
synthetic live checks. They establish the intended path worked here, not a
production omission rate or autonomous polling of missing material. The earlier
controlled baseline comparison remains the evidence for before/after behavior;
the old binary was not re-deployed for this trial.

May committed the [full live report](../../../may.app/docs/reviews/conversation-batch-live-trial-edc43e16-20260928.md)
and refined its interpretation after supervisor review, final commit
`71e9d9140365a19221ce8ed9f6dd4e4e9de8274d`, report SHA-256
`b8bf5ddf4ae3f3d2a0d070612e692360181a47c5682e17aac4fdd8702d5cb886`.
The review corrected an initial claim that the direct arithmetic answer needed
a closed Request row. That is permitted by the existing capability contract;
admission IDs, accepted Requests and visible answers are different evidence.
No additional lifecycle or source fix was justified by these observations.
May's supervising Task subsequently converged with `ready: 0`, no active
attempt and no open input waits. A final reconciliation checked the existing
report rather than repeating the model trials. The updated common design,
example and canonical-App checks passed with zero errors or warnings.

## Controlled model comparison

Both variants used `gpt-5.6-sol`, with fallback disabled, and the same installed
May/shared instructions from definition source
`5eeda30eb12729be450a65e50073acc3b8a2363a-definitions-v4`. Combined instruction
SHA-256: `8b6824017ddc81fa684402ce5fca95fd37ad6f4b8885889b91ac7f997a5a9acf`.
The trial used production admission, claimed-turn preparation, prompt rendering,
model/tool execution, Request writes, and settlement, with temporary SQLite and
fixture files. Tools were limited to read, finish, Conversation context and
Request updates. It did not exercise the installed manager/process lifecycle or
the full production tool catalog.

Each case ran once per variant, alternating which variant went first. Outcomes
below were reviewed from visible model/tool output and saved database state;
they are not scores from another automated judge.

| Case | Baseline | Candidate |
| --- | --- | --- |
| Two human asks: code review, then calculation | Answered only the calculation; older input done, no Request | Read the fixture, identified the unreachable final-error check, answered the calculation, closed both asks |
| Two system asks with the same work | Answered only the calculation; older input done, no Request | Reviewed the code and answered the calculation; both asks accounted for |
| Missing design file, then independent calculation | Answered only the calculation; review disappeared from pending work | Answered the calculation, disclosed the missing file, kept the review Request open |
| Human correction from mean to median | Answered the corrected question | Answered the corrected question; one closed Request, no duplicate open ask |
| Repeated healthy observation without a request | Quiet, no Request | Quiet, no Request |

All ten turns settled successfully. That itself does not establish semantic
completeness: the baseline's three omissions also settled successfully.
The candidate review responses differed on whether `retries` counts total or
additional attempts; this trial supports recognition of both asks, not a claim
of uniform review quality or agreement on unspecified code semantics.

Candidate independent-work turns took 11.5–13.4 seconds; their baseline turns
took 3.5–4.2 seconds while doing less work. Control timings varied in both
directions. This small sample is not a throughput, cost, or reliability estimate.

An earlier pilot used relative fixture filenames. One candidate searched the
installation paths named in its instructions and retained the review as blocked,
despite the fixture existing elsewhere. That pilot exposed a harness context
defect and is not proof of completing both tasks. The table above uses the
corrected absolute fixture paths. Preserve this failed setup when interpreting
the comparison; it was not silently retried until green.

## Ordinary continuation

A separate three-turn check repeated the missing-file pair, then supplied the
file to the candidate in a later human input. The baseline again dropped the
older review. The candidate saved `input-0` at revision 1 before work, retained
it open at revision 2 with the missing-file explanation, then read the supplied
design and closed the same Request at revision 3. The Conversation Task identity
was unchanged. No handover, replacement Task, or new acknowledgment mechanism
was used.

This was input-triggered continuation, not an autonomous scan. An open Request
is durable accountability and future context; it is not an executor or a
promise to schedule another turn by itself. A genuine wait for missing human
material should remain a wait.

## Verification and review

The prompt regression failed on baseline: the one-input presentation lacked
`inputs`, and the batch presentation lacked separated reply routing. After the
change, all **102 focused tests** passed with **1,190 assertions**. Initial
runtime-fixture failures came from scripted responders still parsing the old
top-level input; their shared decoder now selects the exact reply input from
the presented batch and preserves the full batch for assertions. The renderer
test inspects the actual prompt directly, without that compatibility view.

May independently reviewed exact `aab469a2` through ordinary Task
`may/goal/app_0a979f67-2417-41c1-be3b-d21304cf85f8`. She found no correctness
issues and independently passed the 102 tests and `check:ci`. Her committed
review artifact is
`projects/may.app/docs/reviews/conversation-batch-presentation-aab469a2-review.md`,
commit `e25e8351720c462f81f2ff8fd740728148bd7622`, SHA-256
`fcb172791a64aea5fcacb4ecf34eaec7c274ca22c5a747b68ffa5ebdb282cda9`.
May finished the review Task as converged, with no active attempt or pending
retry. The common design checks passed. Full local CI on unchanged `aab469a2`
passed: **3,277 tests**, **16,029 assertions**, **0 failures**, and **3 expected
installation-dependent skips** across 311 files. GitHub Quality and Container
also passed on that exact revision, run `36353225840`. These hosted checks
validate source and an isolated image; they do not activate the installation.

## Reproduce and inspect

The active [trial harness](run.ts) takes baseline Host source, candidate Host
source, installed instruction root and a new output directory. Use matching
dependencies and explicitly authorized model credentials. It writes only
temporary fixture state and its chosen output directory; it does not admit
live work or activate definitions.

```sh
bun --env-file=/path/to/model.env run.ts /path/to/baseline-host /path/to/candidate-host /path/to/definitions /path/to/new-results
bun --env-file=/path/to/model.env run.ts /path/to/baseline-host /path/to/candidate-host /path/to/definitions /path/to/new-continuation-results unfinished-human
```

The second command runs the missing-file pair and candidate continuation. The
first runs the five-case comparison. Output includes prompts, visible model/tool
messages, results, Request records and temporary state locations. Provider
reasoning internals and credentials are excluded from saved messages. Preserve
this branch's harness and exact evidence references when retiring the trial;
it is not a production workflow or required CI test.

Local evidence from this review:

- `/tmp/conversation-batch-model-results-20260928`: relative-path pilot.
- `/tmp/conversation-batch-model-results-v2-20260928`: corrected comparison.
- `/tmp/conversation-batch-model-continuation-20260928`: saved-Request continuation.
- `/tmp/conversation-batch-context-before.log`: baseline regression failure.
- `/tmp/conversation-batch-context-focused-v2.log`: focused source checks.
- `/tmp/conversation-batch-context-ci.log`: complete local CI log.

The remaining limitation is semantic recognition. A model may still overlook
an ask or judge fulfillment incorrectly; code cannot prove understanding from
a successful finish. This evidence supports repairing context first rather
than adding another per-input lifecycle. Reconsider stronger enforcement only
with demonstrated residual failures and a clear value/cost tradeoff.
