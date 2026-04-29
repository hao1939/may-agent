# Evaluator Heartbeat — 2026-04-29

## Process #5 (Session Eval) liveness
- DB canonical check: `.state/may.db` `MAX(evaluations.createdAt))=1777489217707` → `2026-04-29 19:00:17.707Z` (pipeline writing recently).
- Counts: `sessions=634`, `evaluations=102` (coverage not assessed this heartbeat; just liveness).
- Legacy artifacts: `.state/evaluations/` has new `s_*.json` mtimes on 2026-04-29, but task_tree/older eval artifacts still mostly 2026-03-24 → likely partial drift between DB and legacy directory outputs.

## Process #15 (LLM Eval)
- Not re-queried this heartbeat; periodic-tasks.md already notes no `*llm*` tables in `.state/may.db` as of 2026-04-29.

## Monitoring (L2)
- `node agents/evaluator/skills/monitor-session.cjs --running` → 2 running sessions checked, 2 healthy.

## Patrol (L3)
- `node agents/evaluator/skills/patrol.cjs` → `CRITICAL` with `Missing compliance-snapshot.json`.
- Treat as degraded integrity patrol baseline missing (known chronic), not an active hash mismatch.

## Calibration inputs
- `agents/evaluator/workspace/{consistency-flags,human-reviews,re-evaluations}.jsonl` are placeholders due to missing prior archive symlink targets → calibration loop currently has no real human/consistency data to learn from.

## Follow-ups suggested
1. Restore/replace the missing archived calibration artifacts pipeline (or remove placeholder mechanism) so evaluator can ingest real disagreement signals.
2. Obtain/generate `agents/shared/compliance-snapshot.json` baseline (owner previously noted as Bob) so patrol can provide non-degraded integrity results.
