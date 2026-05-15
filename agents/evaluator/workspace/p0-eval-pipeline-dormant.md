# P0: Session evaluation pipeline dormant (Evaluator heartbeat)

## Signal
Inbox alerts claim the evaluation/scoring pipeline is dormant (last N sessions have 0–4 ops).

## Structural evidence (from `.state/may.db`)

### Sessions vs evaluations by day
Query grouped sessions by `date(startedAt/1000,'unixepoch')` and evaluations (integer `createdAt`) by day.

Result (latest 3 days present in `sessions` table):
- 2026-04-29: **954 sessions**, **0 evaluations**
- 2026-04-28: **1030 sessions**, **0 evaluations**
- 2026-04-27: **728 sessions**, **0 evaluations**

This indicates the evaluations cron/job has not produced DB rows for at least ~3 days, while sessions are being recorded.

### Coverage check (7d window)
For sessions in last 7 days vs evaluations joined on `sessionId`, the evaluated count was **0** (join mismatch due to evaluation recency gap).

### Note on `evaluations.createdAt` type inconsistency
`max(createdAt)` in SQLite returns a TEXT ISO string due to mixed typing in the column (some rows have `createdAt` as TEXT like `2026-04-16T14:32:21.389Z`, newer rows are INTEGER ms). Use `where typeof(createdAt)='integer'` for reliable recency queries.

## Likely root cause
- `evaluate-session-llm` (or equivalent) cron/job runner not firing, failing, or disabled since ~2026-04-27.
- Secondary issue: mixed-type `createdAt` complicates naive recency checks.

## Recommended actions
1. Check cron/job runner logs/status for the evaluation job since 2026-04-27.
2. Confirm whether evaluation output path drifted (DB canonical vs `.state/evaluations/` legacy artifacts).
3. Consider migrating/normalizing `evaluations.createdAt` to INTEGER consistently to avoid `max()` returning TEXT.
