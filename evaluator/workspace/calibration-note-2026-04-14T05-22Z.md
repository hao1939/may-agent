# Evaluator calibration note — 2026-04-14T05:22Z

## Process #5 (Session Evaluation) liveness
- DB canonical check: `.state/may.db` table inventory includes `evaluations`.
- Recency evidence: `MAX(evaluations.createdAt)=1776143161669` → `2026-04-14T05:06:01.669Z` (pipeline live within ~16 minutes at time of check).
- Legacy artifacts: `.state/evaluations/` directory still shows newest mtime at 2026-03-24 (stale legacy output path, consistent with known chronic issue).

## Process #15 (LLM Evaluation) status
- DB check: no `llm_evaluations` / `session_evaluations` tables exist in `.state/may.db` (queries error with `no such table`).
- Interpretation: Process #15 appears disabled/unimplemented or renamed; recommend either reviving with a canonical DB table + writer, or updating docs to reflect current reality.

## Runtime defense signals
- `monitor-session.cjs --running`: 1 alert.
  - `s_1775311714523_3` (may) flagged `PRODUCTIVITY_STALL` (21 tool calls, 0 writes); recommended action `warn`.
- `patrol.cjs`: `CRITICAL` due to missing `agents/shared/compliance-snapshot.json` baseline (integrity patrol degraded — not a hash mismatch event).
