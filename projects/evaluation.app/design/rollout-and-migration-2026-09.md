# Evaluation outcome-review rollout and legacy retirement

**Current status:** The September 17–18 migration and initial daily rollout below
remain historical evidence. On September 21 the active installation changed to
an hourly selector and one semantic assessment per hour using existing settings;
see the [capacity correction](#september-21-capacity-correction). No retirement,
record movement or receipt import was repeated. Coverage remains bounded.

## Frozen legacy inventory

The independent public inventory in `/app/.state/review-pilots/evaluation-setup-20260918/reviewer-migration-proposal.json` contains exactly **2,037** Evaluation Tasks: 2,007 legacy session reviews, 9 feedback projections, 16 pipeline-maintenance Tasks, and 5 project audits. Its source snapshot SHA-256 is `ad0cfd543ac8c71289ae37d80919b0893747cf84f1a162219894f2b394939f70`. Every identity was last updated no later than 2026-09-10T06:32:44.753Z. The frozen set was retired through the public fenced route; `/app/.state/review-pilots/evaluation-setup-20260918/migration-verify.json` records all 2,037 as already cancelled after application.

Retirement means `cancel-as-superseded`, never assessed, repaired, or successful. Preserve every Task, attempt, event, evaluation, and report. Apply only the frozen manifest: while Evaluation remains disabled, reread each exact generation/resourceVersion, emit the supported fenced `app.task.cancel.requested` operation, retain its receipt, and reread terminal cancellation. Skip stale identities for individual review; never broaden the set dynamically. Do not write SQLite or delete legacy directories.

## Offline receipt-import evidence

The host reviewer first proved the deployed Host's existing receipt migrator on an isolated full database copy, then applied the same bounded operation during the coordinated cutover. The live run imported 16,739 historical completion receipts into canonical history, created 16,738 already-closed historical Task projections, linked 34 inputs, and preserved original receipt content. The retained live receipt is `/app/.state/review-pilots/evaluation-setup-20260918/cutover-receipts-live.json`. Imported history is not new evaluation and must not revive work. The separate 73 linked legacy inbox inputs were completed through the existing Host CAS helper with neutral supersession results; none was labeled assessed, repaired, or successful.

## Measured live calibration

Four real evaluator runs produced four accepted reports: one May implementation/recovery outcome, one Scout same-Task publication recovery, one Scout verified no-change reuse outcome, and one automatic May canary whose fair disposition was `insufficient-evidence`. Repeating unchanged Scout evidence reused the accepted report and evaluator execution. Evaluation self-review was excluded with zero evaluator calls. A second automatic canary selected Scout's `explore-github` Task but stopped neutrally before a model call or semantic report because authoritative creator provenance was absent. Session usage metadata estimates **$0.479074** total for the four runs; this is not a billing receipt, excludes May/reviewer costs, and the immutable reports correctly retain cost as unknown rather than inventing a value.

The deployed discovery contract advertises `read-reports` list/read in the installed App description and documents the durable report root. The post-deployment natural May query used that contract and canonical report root, accurately distinguished accepted findings from proven fixes and source integration from runtime deployment, and caused zero new evaluator runs. Its first answer was verbose and used plain filesystem paths rather than clickable links; that is presentation calibration, not a new infrastructure requirement. The owner-decision trial accepted one finding without claiming remediation or verified resolution. Receipts and read-backs are retained under `/app/.state/review-pilots/evaluation-setup-20260918/live-trials/`.

## Staged activation and canary

Steps 1–7 are retained as the executed procedure and rollback evidence. Step 8 remains rollout guidance rather than a claim of comprehensive coverage.

1. Confirm Evaluation is disabled, the reviewed source commit and release artifact hashes match, May and Scout definitions are unchanged, and all 2,037 frozen identities still match preflight.
2. The host operator briefly stops Host/web/maintenance, takes a consistent backup, runs the same existing receipt import offline scoped only to Evaluation, then restarts the existing release with Evaluation still disabled. This source candidate does not perform those runtime operations.
3. With Evaluation still disabled, retire only the frozen manifest through the no-controller manual Host composition and public fenced Task-control route. Archive receipts and verify through the normal socket: 2,037 proposed = cancelled plus explicitly listed stale/skipped, with no unaccounted row. Do not use raw SQLite repair.
4. Stage the reviewed release with `EVALUATION_AUTO_REVIEW_ENABLED` absent/false. The default durable report root is `${MAY_PERSIST_DIR:-/app/.state}/evaluation/reports`; optionally set `EVALUATION_REPORT_ROOT` to another durable `.state` path. The manifest declares all 11 legacy metric definitions as `retired`; activation must verify their persisted statuses changed from active to retired while history remains readable.
5. Enable Evaluation only. Keep all unrelated disabled markers and App definitions unchanged. Run explicit May and Scout Task positive controls, Evaluation self-exclusion, malformed/missing evidence, stale-during-review, report tamper/read-back, and unchanged reuse controls.
6. From May, call `list-evaluation-reports`, then `read-evaluation-report` with a listed relative path. Confirm no evaluator execution occurs, the absolute and relative links resolve, and the answer states bounded coverage and distinguishes acknowledgment, claimed repair, and independently verified resolution.
7. After reviewer acceptance and measured cost, enable a small canary with `EVALUATION_AUTO_REVIEW_ENABLED=true`, a daily interval, at most 20 Apps, bounded Tasks, and `maxConcurrent: 1`. The selector uses only `apps.list` and paginated `tasks.list(appId, includeDone: true)`, excludes Evaluation, emits at most one ordinary review request, and carries digest-only rotating navigation state in its ordinary Task result. Exhausted scans preserve per-App position; malformed pages/items retain bounded diagnostics and advance to later valid data when the public cursor permits. Include completed controls and attention/failure outcomes; unavailable ownership advances navigation rather than becoming coverage.
8. Expand frequency only from observed report quality, exclusions, cost, and owner usefulness. A report rubric revision changes the versioned report directory, so a deliberate new assessment never overwrites or silently reuses an older rubric judgment.

## Rollback

Disable automatic selection first, then disable Evaluation and restore the prior reviewed release definition. Do not reverse legacy retirement, delete reports, or mutate the database: cancelled obsolete scheduling remains historical evidence and exact old work may be requested anew. Verify May and Scout remain registered and operating, preserve cancellation/publication receipts, and investigate any partially emitted review from its canonical Task identity before retrying.


## September 21 capacity correction

The initial one-call daily allowance left 23 exact review contracts across 20
subjects deferred. Routine sampling correctly yielded to those requests. This
was a capacity mismatch, so the correction changes installation settings rather
than adding a queue, controller or new Task lifecycle.

At 07:53 UTC the operator activated
`EVALUATION_AUTO_REVIEW_INTERVAL_MS=3600000`,
`EVALUATION_ASSESSMENT_ALLOWANCE_INTERVAL_MS=3600000`, and
`EVALUATION_ASSESSMENT_CALLS_PER_INTERVAL=1`. The canonical installation `.env`
retains the values for future container starts. The existing Supervisor program
received the same three values and restarted only the May daemon in the same
container, preserving isolated candidates and evidence. Readiness returned true;
the daemon's actual process environment confirmed the values and all four Apps
remained registered. No new startup script was needed.

The operator addressed the 23 retained budget-deferred Tasks once through normal
`app.input.admit`, with their exact target IDs, original assessment inputs and
idempotency keys. Their generations, pins and caller links were not replaced;
closed subjects were not automatically discarded. All 23 workflows read the
new budget and updated the follow-up inputs to September 21 08:00 UTC. The
original per-input daily deadlines remained separate; the aggregate earliest
deadline alone did not establish that those caller waits had advanced. No Task files or records were moved,
restored, archived or deleted; allowance receipts were not reset.

The first hourly allowance receipt belongs to the existing ongoing review of
May's direct-tool correction Task. It published an independent judgment of an
invalid wait: the owner had claimed to wait for the coordinated restart without
an exact Condition. The immutable report honestly records that the inspected
snapshot became stale as work resumed. This is a useful historical finding,
not a claim that the current Task remains blocked or that all Apps are healthy.
The read-reports path was exercised separately without another model call.

Live settings, exact request receipts and read-backs are retained under
`/app/.state/review-pilots/app-runtime-fixes-20260921/`, including
`evaluation-config.json`, `evaluation-waiting-contracts.json`,
`evaluation-priority-wake.json`, `evaluation-retained-wakes.json` and
`evaluation-waits-after.json`. The report is
`task-outcomes/may/task-obligation-v1/goal-app_8a957a1f-99f6-45bf-a289-ca00c55ddcff-47e6db084e206403-ef255144f8b6.md`
under the canonical report root. The notification review's early follow-up recalculated
its eligibility from September 22 00:00 UTC to September 21 08:00 UTC after the
hour's allowance was consumed. At that boundary it produced a second real report,
`task-outcomes/may/task-obligation-v1/goal-app_86bea4d7-27bf-4c89-8f51-913c1de62dac-597de6e579e597d6-58bd72972288.md`.
That report judged the inspected work coherent and retained its stale-snapshot
qualification as publication progressed.

The final caller check exposed the transition limit: the original
`appdep_922479ce17fe86ea5ef02935` input was not considered by the follow-up attempt,
so its saved September 22 00:00 UTC wait and May's linked Condition remain. This
is not missing report production, nor proof that the caller has resumed. The Host
correctly keeps independent input obligations. Do not repeat follow-up inputs as
a backlog-drain mechanism; let original waits reach their due time and adopt the
new allowance normally. The observation and exact Condition read-back are retained
in `priority-review-after-boundary.json` and
`notification-evaluation-condition.json`. No state rewrite or blanket wait clearing
was performed.

Validation: the existing outcome-review and selector suites passed 37 tests with
441 assertions. A disposable fixture verified that the first hourly claim is
accepted, the second is deferred to the next hour, and a later-hour claim succeeds.
The code's conservative defaults remain unchanged. At full use the installed
profile allows 24 assessments per UTC day; the earlier four-call calibration
suggests roughly $2.87/day for assessment alone, not a billing cap or a guaranteed
review latency. Observe report usefulness, backlog and actual spend before another
capacity adjustment.

Rollback is a settings change: restore the prior daily selector and remove the
two allowance overrides (which restores the daily one-call default), then restart
the daemon at a safe boundary. Preserve reports, exact review requests and allowance
receipts. Do not repeat historical migration or rearrange records.
