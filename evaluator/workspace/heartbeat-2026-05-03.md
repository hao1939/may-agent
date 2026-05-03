# Evaluator heartbeat — 2026-05-03

## Process #5 (Session Eval) liveness check

**DB canonical status**
- `evaluations.max(createdAt)`: `1777817597956`
- `sessions.max(endedAt)`: `1777821589777`
- **Lag**: `3,991,821 ms` (~**66.5 min**)

Evidence: bun sqlite query run in heartbeat transcript.

**Legacy artifact directory**
- `.state/evaluations/` newest mtimes are **2026-03-24**, confirming earlier note that this directory is stale.
- Interpretation: likely output-path drift; DB is being updated more recently than `.state/evaluations/`.

## Actions / Recommendations
1. Treat `.state/evaluations/` as legacy; confirm whether `evaluate-session-llm` writes only to DB now.
2. If cron frequency target is < 1h, current DB lag of ~66.5 min suggests either (a) scheduler interval ~hourly, or (b) mild staleness. Recheck next heartbeat or add a metric.

## Proposed metric (not yet configured)
- `session_eval.db_lag_minutes` = (max(sessions.endedAt) - max(evaluations.createdAt))/60000; alert if > 120.
