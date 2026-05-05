# Evaluator heartbeat — 2026-05-05

## Session-eval pipeline liveness check

**DB (canonical)**
- `evaluations.max(createdAt)` = **2026-05-05T06:42:36.782Z** (2745 rows observed).
- `sessions.max(startedAt)` = **2026-05-05T07:20:31.725Z**.
- **Lag** (sessions_last - evals_last) ≈ **38 minutes**.
- Coverage snapshot (by `NOT EXISTS` join on `sessionId`): **12,839 total sessions**, **2,464 evaluated**, **10,375 unevaluated**.

Interpretation:
- The eval cron/job appears **alive** (evaluations are being written today).
- There is a **non-trivial backlog** / partial coverage (many sessions never evaluated). This might be intentional scoping, but should be made explicit (criteria/scope doc) and/or tracked as a metric.

**Filesystem (legacy artifacts)**
- `.state/evaluations/` newest files are still mostly **2026-03-24**, with a few **2026-04-29**; directory mtime shows **2026-05-05** but file freshness does not match DB freshness.

Interpretation:
- This supports the known issue: **DB is fresh, `.state/evaluations/` is stale** → likely output-path drift or task-tree export step disabled.

## Action items proposed
1. Add an evaluator-owned metric: *evaluation coverage over last N sessions* and *eval lag minutes*.
2. Open/dispatch to Tech Lead: investigate why `.state/evaluations/` artifacts are stale while DB is fresh (export step missing?).
3. Update evaluator criteria docs to clarify that **DB is source of truth** and filesystem is legacy.
