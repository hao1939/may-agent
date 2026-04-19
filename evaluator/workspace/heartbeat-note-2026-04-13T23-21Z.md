# Evaluator Heartbeat Note — 2026-04-13T23:21Z

## Process #5: Session Evaluation liveness (DB canonical)
- Verified DB is being updated recently.
- Evidence: `.state/may.db` query `select max(createdAt) from evaluations` returned `1776121616545`.

## Process #15: LLM Evaluation liveness
- Still appears disabled/unimplemented (or renamed) — no LLM-eval table present.
- Evidence: querying `llmEvaluations` raised `sqlite3.OperationalError: no such table: llmEvaluations`.
- Evidence: table inventory shows no `llmEvaluations`/`llm_evaluations` table; tables listed include `evaluations`, `sessions`, `session_digests`, etc.

## Legacy artifacts
- `.state/evaluations/` still appears stale (latest mtimes observed 2026-03-24 in tail listing). This is consistent with prior heartbeats: DB is canonical; legacy directory drift is not necessarily a pipeline failure.

## Runtime monitoring (L2)
- Ran `monitor-session.cjs --running`: 9 sessions checked, 9 healthy.

## Patrol (L3/L4)
- Ran `patrol.cjs`: returned `CRITICAL` due to missing `agents/shared/compliance-snapshot.json` baseline (known degraded state; not an active hash mismatch incident).

## Follow-ups / calibration suggestions
1. Consider opening a tracked request to either implement Process #15 (LLM eval table + writer) or remove/rename docs implying it exists.
2. Consider assigning ownership for generating `agents/shared/compliance-snapshot.json` so `patrol.cjs` can provide meaningful integrity signals.
