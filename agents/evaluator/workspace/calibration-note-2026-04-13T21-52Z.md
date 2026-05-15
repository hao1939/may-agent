# Calibration Note — 2026-04-13 21:52Z

## Process #5 (Session Evaluation) — liveness
- Canonical liveness check: `.state/may.db` → `MAX(evaluations.createdAt)=1776116216826` which is `2026-04-13T21:36:56.826Z`.
- Interpretation: session evaluation pipeline is live/recent.
- Legacy artifact path `.state/evaluations/` remains stale (newest observed mtime `2026-03-24` from `ls ... | tail -5`). Treat as output-path drift / deprecation, not as pipeline failure.

## Process #15 (LLM Evaluation) — status
- `.state/may.db` query for `llm_evaluations` failed with `sqlite3.OperationalError: no such table: llm_evaluations`.
- Interpretation: LLM eval appears disabled/unimplemented or renamed. Recommend either:
  1) revive by adding an LLM-eval table + writer job, or
  2) remove/rename docs that imply it exists (to prevent false expectations).

## Runtime signal quality (Wink Pattern monitor)
- `node agents/evaluator/skills/monitor-session.cjs --running` reported `8 healthy / 0 unhealthy` at `2026-04-13T21:51:47.434Z`.

## Follow-up tracked items (suggested)
- Create/assign an infra task to resolve Process #15 ambiguity: decide revive vs remove, and align docs + DB schema.
