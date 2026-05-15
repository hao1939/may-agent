# Calibration Note — 2026-04-11T01:54Z

## Process health checks
- **Process #5 (Session Evaluation):** `.state/may.db` shows `evaluations max(createdAt)=1775845520533` (= **2026-04-10T18:25:20Z**) and `evaluations count=19408` → pipeline appears **live**.
- **Legacy artifacts:** `.state/evaluations/` newest mtime observed **2026-03-24** → treat as **legacy output path staleness**, not pipeline failure (DB is canonical).

## Process #15 (LLM Evaluation) liveness
- Checked for tables matching `llm%` in `.state/may.db`: **none found** → LLM eval appears **disabled/unimplemented (or renamed)**.

## Runtime monitoring
- `node agents/evaluator/skills/monitor-session.cjs --running` → **9 checked / 9 healthy**.

## Notes / follow-ups
- Suggest docs cleanup or tracked item: reconcile any references implying Process #15 exists with DB reality (no `llm_evaluations` table).
