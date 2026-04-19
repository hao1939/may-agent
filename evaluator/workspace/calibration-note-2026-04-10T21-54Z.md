# Calibration Note — 2026-04-10 21:54Z

## Pipeline liveness (#5 Session Evaluation)
- Canonical DB check: `.state/may.db` shows `evaluations max(createdAt)=1775845520533` → `2026-04-10T18:25:20Z`.
- Legacy artifact dir `.state/evaluations/` remains stale (newest mtime observed: 2026-03-24).
- Interpretation: scoring pipeline appears **live** in DB; the filesystem artifact output path is likely legacy/abandoned.

## LLM evaluation liveness (#15 LLM Evaluation)
- `.state/may.db` table list includes `evaluations`, `sessions`, `session_digests`, etc., and **does not include** any `llm_evaluations`/`llm_evals` table.
- Interpretation: Process #15 appears **disabled/unimplemented** (or renamed) as of this check; docs implying it exists may need update, or the table/cron needs restoration.

## Runtime monitoring / integrity patrol
- `monitor-session.cjs --running`: 8 sessions checked; 8 healthy.
- `patrol.cjs`: CRITICAL solely due to missing baseline `agents/shared/compliance-snapshot.json` (patrol degraded; not evidence of active tampering).
