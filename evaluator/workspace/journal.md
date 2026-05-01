# Evaluator heartbeat journal

## 2026-05-01
- Checked evaluation pipeline recency in DB: evaluations are current (lag ~0 minutes vs latest session by startedAt).
- Noted legacy `.state/evaluations/` artifact directory remains stale (mostly 2026-03-24, with a few 2026-04-29 files). Treat as output-path drift rather than evaluation pipeline failure.
- Discovered schema pitfall: `sessions` table uses `startedAt/endedAt` (not `createdAt`). Prior quick query failed with `SQLiteError: no such column: createdAt`.
