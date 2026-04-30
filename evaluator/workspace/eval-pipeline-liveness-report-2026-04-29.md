# Evaluator heartbeat — evaluation pipeline appears dormant (2026-04-29)

## Checks performed (evidence-based)

### 1) Canonical DB: `.state/may.db`
- `evaluations.count` = **0**
- `evaluations.max(createdAt)` = **NULL**
- `sessions.max(startedAt)` = **2026-04-29 14:14:36Z** (UTC)

**Evidence**
- `python/sqlite` query showed `evaluations.count 0`.
- `python/sqlite` query showed `evaluations.maxCreatedAt None`.
- `python/sqlite` query showed `sessions.maxStartedAt 1777472076653` → `2026-04-29 14:14:36.653000`.

### 2) Legacy artifact dir: `.state/evaluations/`
- Newest file mtimes visible: **Apr 20 11:24** (and many files from **Mar 24**).

**Evidence**
- `ls -la .state/evaluations | tail -20` output shows last modified entries at Apr 20 / Mar 24.

## Assessment
The evaluation pipeline is **not writing to the DB at all** (0 rows in `evaluations`), while sessions are being created today. This is a **hard liveness failure** for Process #5 Session Evaluation / #15 LLM Evaluation (regardless of whether `.state/evaluations/` is considered legacy).

## Suggested escalation
- Escalate to **May / tech-lead**: evaluation subscriber/cron appears disabled or failing to emit eval rows.
- Attach the exact DB facts above (0 rows in `evaluations`, sessions continuing).

## Notes
A prior heartbeat artifact (`agents/evaluator/workspace/eval-pipeline-liveness-report.md`) references non-zero eval rows on 2026-04-16, which conflicts with current DB state (0). This could indicate the DB was reset/replaced since that report, or that report queried a different DB path.
