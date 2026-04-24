# Cron System Audit — 2026-04-16

## Summary
43 cron entries in `agents/may/cron.json`, 31 handler files in `agents/may/handlers/`. Found 1 orphaned handler, 2 deprecated-but-kept entries, and 3 overlap clusters worth consolidating.

## Orphaned Handler (file exists, no cron entry)
- **`priority-drift.ts`** — No cron.json entry references this handler. Either dead code or was removed from cron but file kept. **Severity: Low.** Recommend: verify if used elsewhere, delete if not.

## Deprecated Entries (disabled, kept for rollback)
- **`error-log-scanner`** (disabled) — replaced by `error-scan` workflow. Both at 4h interval.
- **`coaching-feedback`** (disabled) — replaced by `coaching-feedback-wf` workflow. Both at 12h interval.
- **Severity: Low.** These are fine as rollback insurance but should be cleaned up eventually.

## Overlap Clusters

### 1. Stuck Session Cleanup: watchdog + zombie-cleanup
- **`watchdog`** (10min): cancels sessions stuck running >30min
- **`zombie-cleanup`** (60min): archives sessions stuck in running/terminal states not active in memory
- These handle different lifecycle stages (active stuck vs orphaned). **No action needed** — complementary, not redundant.

### 2. Status Reporting: system-status + proof-of-life + daily-brief + daily-digest
- **`proof-of-life`** (2h): compact Telegram summary
- **`system-status`** (4h): operational status check
- **`daily-brief`** (24h): daily system metrics
- **`daily-digest`** (24h): daily progress digest for human review
- `daily-brief` and `daily-digest` are both daily JS handlers writing summaries. **Severity: Medium.** Could potentially merge into one daily report. Investigate if both are read.

### 3. Request Lifecycle: audit-requests + task-watchdog
- **`audit-requests`** (2h): auto-expire stale CREATED requests, clean up artifacts, reset orphaned IN_PROGRESS
- **`task-watchdog`** (1h): nudge agents about stale requests, escalate
- Different concerns (cleanup vs nudging). **No action needed** — complementary.

## High-Frequency Jobs (resource check)
- **`active-nudge`** (5min) — highest frequency. Monitors running sessions for loops/stalls.
- **`session-sync`** (5min) — syncs filesystem to DB.
- **`evaluation-sync`** (10min) — heuristic evaluations.
- **`watchdog`** (10min) — stuck session detection.
- All are JS-only (no LLM cost). Acceptable.

## Recommended Follow-ups
1. Delete `priority-drift.ts` if confirmed unused
2. Investigate whether `daily-brief` and `daily-digest` can be merged
3. ~~Remove deprecated `error-log-scanner` and `coaching-feedback` entries after sufficient rollback window~~ — Both workflow files removed from disk (2026-04-19). Cron entries should be cleaned up too.
