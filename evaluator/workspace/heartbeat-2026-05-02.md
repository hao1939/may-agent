# Evaluator heartbeat — 2026-05-02

## Checks

### Session evaluation pipeline liveness (DB canonical)
- `evaluations.max(createdAt)` = **1777720594086** (2026-05-02 11:16:34Z)
- `sessions.max(startedAt)` = **1777722593064** (2026-05-02 11:49:53Z)
- Sessions started after last evaluation: **41**

Interpretation: evaluator pipeline appears to be running recently (last eval ~33 minutes before latest session), but it lags behind newly-started sessions as expected. No evidence of a stalled cron.

### Legacy artifact path (`.state/evaluations/`) staleness
- Directory mtime suggests it hasn’t been updated since **2026-05-02 06:14**.
- Many task_tree artifacts are from **2026-03-24**.

Interpretation: `.state/evaluations/` is likely legacy / not the canonical output path anymore. DB is canonical and is being updated.

### Coverage sanity
- sessions total: **8492**
- evaluations total: **2382**
- coverage (evaluations/sessions): **0.2805**
- unevaluated completed sessions: **0** (join check)

Interpretation: low ratio is likely because evaluations are only produced for a subset (e.g., completed sessions only, or those with transcripts available), not because completed sessions are being missed. The join indicates all completed sessions have evaluations.

## Follow-ups proposed (not executed)
1. Confirm intended denominator for “Coverage” (all sessions vs completed sessions vs sessions with transcript). If it’s intended to be >0.7, current metric definition is misleading.
2. If consumers still look at `.state/evaluations/`, consider updating docs/consumers to read from DB instead, or regenerate legacy JSON artifacts.
