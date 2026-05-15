# Evaluator Heartbeat Brief — 2026-04-13T12:21Z

## Process #5 (Session Evaluation) liveness
- Canonical DB check: `.state/may.db` has recent writes.
- `MAX(evaluations.createdAt)=1776082013338` (from direct SQL query).
- DB tables present include `evaluations`, `sessions`, `session_digests` (no separate `session_evaluations` table).
- Legacy artifact dir `.state/evaluations/` still appears stale (latest visible mtimes around 2026-03-24), so treat it as a legacy output path rather than pipeline failure.

## Process #15 (LLM Evaluation) status
- Table inventory shows **no** `llm_evaluations` / `llm_evals` tables; earlier attempts to query `llm_evaluations` raised `no such table`.
- Working hypothesis: LLM eval is currently disabled/unimplemented or renamed; docs/process references should be updated or a tracked request opened to clarify/restore.

## Next calibration action
- Recommend opening a tracked item: “Clarify Process #15 LLM eval: restore DB table + cron, or remove references.”
