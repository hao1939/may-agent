# Evaluation outcome-review rollout and legacy retirement

**Status:** candidate procedure; no runtime mutation or deployment has been performed.

## Frozen legacy inventory

The independent public inventory in `/app/.state/review-pilots/evaluation-setup-20260918/reviewer-migration-proposal.json` contains exactly **2,037** Evaluation Tasks: 2,007 legacy session reviews, 9 feedback projections, 16 pipeline-maintenance Tasks, and 5 project audits. Its source snapshot SHA-256 is `ad0cfd543ac8c71289ae37d80919b0893747cf84f1a162219894f2b394939f70`. Every identity was last updated no later than 2026-09-10T06:32:44.753Z. The proposal and current preflight are evidence, not applied state.

Retirement means `cancel-as-superseded`, never assessed, repaired, or successful. Preserve every Task, attempt, event, evaluation, and report. Apply only the frozen manifest: while Evaluation remains disabled, reread each exact generation/resourceVersion, emit the supported fenced `app.task.cancel.requested` operation, retain its receipt, and reread terminal cancellation. Skip stale identities for individual review; never broaden the set dynamically. Do not write SQLite or delete legacy directories.

## Offline receipt-import evidence

The host reviewer proved the deployed Host's existing receipt migrator on an isolated full database copy; this is not a live migration receipt. The run imported 16,739 historical completion receipts into canonical history, created 16,738 already-closed historical Task projections, linked 34 inputs, preserved original receipt content, and changed none of the 2,037 open frozen Task resources. The retained receipt is `/app/.state/review-pilots/evaluation-setup-20260918/cutover-receipts-copy.json`. Imported history is not new evaluation and must not revive work.

## Staged activation

1. Confirm Evaluation is disabled, the reviewed source commit and release artifact hashes match, May and Scout definitions are unchanged, and all 2,037 frozen identities still match preflight.
2. The host operator briefly stops Host/web/maintenance, takes a consistent backup, runs the same existing receipt import offline scoped only to Evaluation, then restarts the existing release with Evaluation still disabled. This source candidate does not perform those runtime operations.
3. With Evaluation still disabled, retire only the frozen manifest through the no-controller manual Host composition and public fenced Task-control route. Archive receipts and verify through the normal socket: 2,037 proposed = cancelled plus explicitly listed stale/skipped, with no unaccounted row. Do not use raw SQLite repair.
4. Stage the reviewed release with `EVALUATION_AUTO_REVIEW_ENABLED` absent/false. The default durable report root is `${MAY_PERSIST_DIR:-/app/.state}/evaluation/reports`; optionally set `EVALUATION_REPORT_ROOT` to another durable `.state` path. The manifest declares all 11 legacy metric definitions as `retired`; activation must verify their persisted statuses changed from active to retired while history remains readable.
5. Enable Evaluation only. Keep all unrelated disabled markers and App definitions unchanged. Run explicit May and Scout Task positive controls, Evaluation self-exclusion, malformed/missing evidence, stale-during-review, report tamper/read-back, and unchanged reuse controls.
6. From May, call `list-evaluation-reports`, then `read-evaluation-report` with a listed relative path. Confirm no evaluator execution occurs, the absolute and relative links resolve, and the answer states bounded coverage and distinguishes acknowledgment, claimed repair, and independently verified resolution.
7. After reviewer acceptance and measured cost, enable a small canary with `EVALUATION_AUTO_REVIEW_ENABLED=true`, a daily interval, bounded Apps/Tasks, and `maxConcurrent: 1`. The selector uses only `apps.list` and paginated `app.tasks.list`, excludes Evaluation, emits at most one ordinary review request, and carries bounded rotating navigation state in its ordinary Task result. Include completed controls and attention/failure outcomes; unavailable ownership advances the cursor rather than becoming coverage.
8. Expand frequency only from observed report quality, exclusions, cost, and owner usefulness. A report rubric revision changes the versioned report directory, so a deliberate new assessment never overwrites or silently reuses an older rubric judgment.

## Rollback

Disable automatic selection first, then disable Evaluation and restore the prior reviewed release definition. Do not reverse legacy retirement, delete reports, or mutate the database: cancelled obsolete scheduling remains historical evidence and exact old work may be requested anew. Verify May and Scout remain registered and operating, preserve cancellation/publication receipts, and investigate any partially emitted review from its canonical Task identity before retrying.
