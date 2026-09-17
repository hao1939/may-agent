# Evaluation outcome-review rollout and legacy retirement

**Status:** migration and activation completed on 2026-09-17. Source revision `da3927de33` is deployed with automatic selection off. All 2,037 legacy Tasks and 73 linked legacy inbox inputs were retired neutrally, all 11 old metrics remain retired, and three bounded real-model Task reviews plus self-exclusion, unchanged reuse, deterministic reading, and an owner-decision trial passed. The recent-window/fair-rotation selector and report-discovery polish are source-only pending reviewer activation and one bounded canary.

## Frozen legacy inventory

The independent public inventory in `/app/.state/review-pilots/evaluation-setup-20260918/reviewer-migration-proposal.json` contains exactly **2,037** Evaluation Tasks: 2,007 legacy session reviews, 9 feedback projections, 16 pipeline-maintenance Tasks, and 5 project audits. Its source snapshot SHA-256 is `ad0cfd543ac8c71289ae37d80919b0893747cf84f1a162219894f2b394939f70`. Every identity was last updated no later than 2026-09-10T06:32:44.753Z. The frozen set was retired through the public fenced route; `/app/.state/review-pilots/evaluation-setup-20260918/migration-verify.json` records all 2,037 as already cancelled after application.

Retirement means `cancel-as-superseded`, never assessed, repaired, or successful. Preserve every Task, attempt, event, evaluation, and report. Apply only the frozen manifest: while Evaluation remains disabled, reread each exact generation/resourceVersion, emit the supported fenced `app.task.cancel.requested` operation, retain its receipt, and reread terminal cancellation. Skip stale identities for individual review; never broaden the set dynamically. Do not write SQLite or delete legacy directories.

## Offline receipt-import evidence

The host reviewer first proved the deployed Host's existing receipt migrator on an isolated full database copy, then applied the same bounded operation during the coordinated cutover. The live run imported 16,739 historical completion receipts into canonical history, created 16,738 already-closed historical Task projections, linked 34 inputs, and preserved original receipt content. The retained live receipt is `/app/.state/review-pilots/evaluation-setup-20260918/cutover-receipts-live.json`. Imported history is not new evaluation and must not revive work. The separate 73 linked legacy inbox inputs were completed through the existing Host CAS helper with neutral supersession results; none was labeled assessed, repaired, or successful.

## Measured live calibration

Three real evaluator runs produced three accepted reports: one May implementation/recovery outcome, one Scout same-Task publication recovery, and one Scout verified no-change reuse outcome. Repeating the unchanged Scout recovery reused the accepted report and evaluator execution. Evaluation self-review was excluded with zero evaluator calls. Session usage metadata estimates **$0.329966** total for the three runs; this is not a billing receipt, and the immutable reports correctly retain cost as unknown rather than inventing a value.

The natural May query ultimately found and accurately explained all three reports, but searched broad historical paths before reaching the canonical report store. The source-only discovery update therefore advertises `read-reports` list/read in the installed App description, documents the durable report root, and tells May to consult current contracts and supported read/list paths before broad searches. The owner-decision trial accepted one finding without claiming remediation or verified resolution. Receipts and read-backs are retained under `/app/.state/review-pilots/evaluation-setup-20260918/live-trials/`.

## Staged activation and remaining canary

Steps 1–6 are retained as the executed procedure and rollback evidence; step 7 remains pending for the source-only selector change.

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
