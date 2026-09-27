# Evaluation owner feedback — September 28, 2026

## Finding and scope

After reviewing Host PR #263, source inspection and a direct production-route
probe showed that `evaluation.review_failed` reaches the standing operational
owner, but `project.task.reconciled` with `incomplete`/`retrying` for Evaluation
reaches neither that owner nor May. The external self-assessment exclusion was
also suppressing operational feedback. Ordinary Task retry still exists.

The read-only latest 24-hour sample contained 482 Evaluation reconciliations and
no `incomplete`/`retrying` disposition. Historical failure event `6419604` remains
inspectable; its same review Task later has converged event `6431016`. That alone
does not prove the identical evidence snapshot was recovered. No current stuck
review or universal recovery claim follows from these observations.

The isolated change reuses the existing owner input and standing Task. Only a
canonical Evaluation App identity selects operational feedback; evaluator agent
names are not App ownership. External semantic review keeps its existing flag,
reviewer selection and exclusion. The owner instructions distinguish operational
maintenance from assessing its own judgment.

## Trial

The new route regression failed against baseline `bb6fe0cb42`: expected the
existing owner input, received `null`. Local log:
`/tmp/evaluation-owner-feedback-before.log`. The initial command omitted `./`
and matched no tests; only the subsequent exact-path run is reproduction evidence.

The owning App suite tests the actual production input/intent functions and
Host Task store. It exercises local execution failure, alias/ownership controls,
normal waits and recovered outcomes, then an owner-provider failure followed by
retry on the same Task with the same unconsumed event. Further events arriving
during active ownership keep the generation stable and remain available to the
next attempt. These are deterministic mechanism tests, not a model-quality or
live activation claim.

Candidate verification: syntax/build, TypeScript, all **220 Evaluation tests**
(1,164 assertions), and the common design checks passed. The direct route probe
now returns the standing owner for reviewer execution failure and still returns
no work for owner self-failure or healthy recovery; external assessment and the
existing acquisition-failure route are unchanged. Logs use
`/tmp/evaluation-owner-feedback-*` in the author's environment.

The full App check is not green: formatting reports the same five files recorded
in the prior baseline (`app.ts`, `public-task-evidence.ts`,
`task-process-evidence.test.ts`, `task-process-evidence.ts`, `task-report-store.ts`).
No formatting-only sweep or live activation is included.

May independently reviewed exact source `3745784375` through ordinary Task
`may/goal/app_60e4b484-06c5-4bf3-bbec-fdd15382ed7d`. Her private-archive
verification passed TypeScript, syntax, **220 tests** (1,166 assertions), design
checks and whitespace checks, with **no findings**. The initial archive lacked
the linked Host source needed by App integration tests; after adding that
dependency link, the complete suite passed. This setup failure is not hidden as
a successful run.

Her first finish retained an uncommitted review artifact, so the existing Task
runtime rejected completion. Ordinary recovery resumed the same Task; May read
the saved result, committed only her artifact as `f65a3a8d60`, verified a clean
worktree and completed without a manual wake or repeated semantic review. The
artifact is `artifacts/evaluation-owner-feedback-review-3745784375.md` in her
Task workspace, SHA-256
`9ffd4f05690cdda035827facbebb98d3f9d251c0850dab44846430a78d6453cf`.
This is one observed recovery, not proof that every failure recovers.

Candidate source and design are committed on
`fix/evaluation-owner-feedback-20260928`; they have not been integrated into the
local App checkout or activated. Host PR #263 remains separately ready for human
review, unmerged and undeployed.

## Remaining independent gaps

Automatic fallback when the owner/App is unavailable remains a disclosed
common-design limit. This patch does not install it or claim human notification.
The previous `evaluator-heartbeat` helper remains unsuitable: its failed result
can converge and its prompt restricts useful diagnosis. Current owner intent
uses ordinary agent execution, so this change does not reactivate that helper.

The #263 review also exposed mixed Conversation input loss. Input
`app_560dbe5a-83cb-4147-a457-a0242d1a6036` was fully present in session
`s_1790534775161_bf30106c-22d7-43a1-889e-523b5a8311f5`, but only the newer report
was addressed. Settlement marked both inputs handled, and the PR review had no
accepted Request. The ordinary Task path completed the recovered review.

An isolated SQLite trial on Host `8952003b` reproduced the settlement boundary
for system/system, human/system and human/human pairs: a scripted result covering
only the selected primary input was accepted; the other supplied input became
`done`, had no Request, and left zero recovery candidates. Human priority changed
which input was primary but did not change batch consumption. This exercises
production preparation and settlement, not model judgment. The local harness and
results are `/tmp/conversation-batch-audit.ts` and
`/tmp/conversation-batch-audit.jsonl`; the live session above supplies the separate
observed model failure.

Investigate the existing Conversation context and Request contract before
adding another acknowledgment mechanism: the prompt foregrounds a single reply
input while `inputs` contains the full batch, and settlement consumes the full
batch. A successful turn cannot mechanically certify that each ask was understood.
Compare a clearer batch presentation and use of the existing Request ledger
against a per-input acknowledgment requirement before choosing the latter's
schema, retry and compatibility cost. Keep that Host concern separate from this
App-only feedback connection; it also limits claims about any new May fallback.
