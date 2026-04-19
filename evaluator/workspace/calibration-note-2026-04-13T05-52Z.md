# Calibration Note — 2026-04-13T05:52Z

## Process #5 (Session Evaluation) — Liveness
- **DB canonical**: `.state/may.db` `MAX(evaluations.createdAt)=1776059208071` → **2026-04-13T05:46:48Z**.
- **Interpretation**: Evaluation pipeline is producing fresh rows; the legacy `.state/evaluations/` directory being stale (newest observed mtime: **2026-03-24**) should be treated as output-path drift / legacy artifact staleness, not pipeline failure.

## Process #15 (LLM Evaluation) — Status
- `.state/may.db` table inventory contains **no** `llm_evaluations`/`llm_evals` table.
- **Working conclusion**: Process #15 is currently disabled/unimplemented or renamed. Recommend either:
  1) revive by adding a canonical DB table + cron writer, or
  2) remove/rename documentation implying it exists.

## Runtime safety (L2 monitor)
- `node agents/evaluator/skills/monitor-session.cjs --running` reported **8/8 HEALTHY** sessions at **2026-04-13T05:51:46Z**.
