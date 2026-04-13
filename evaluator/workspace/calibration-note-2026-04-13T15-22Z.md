# Evaluator calibration note — 2026-04-13T15:22Z

## Process #5 (Session Evaluation) liveness
- DB canonical check: `.state/may.db` shows `evaluations` being written recently.
  - Evidence: `max_createdAt=1776092813452` (tool output in heartbeat).
- Legacy artifacts remain stale:
  - Evidence: `.state/evaluations/` newest mtime observed is still 2026-03-24 (tail shows only March files).
- Interpretation: session-eval pipeline appears live (DB), but legacy output path (`.state/evaluations/`) is no longer being written (expected drift per known issue).

## Process #15 (LLM Evaluation) status
- DB inventory shows no `llm_*` tables.
  - Evidence: query `sqlite_master` for `name like 'llm_%'` returned `[]`.
- Interpretation: LLM-eval appears disabled/unimplemented or renamed. Recommend either:
  1) revive with a canonical DB table + writer, or
  2) remove/rename docs that imply it exists.

## Runtime defense signals
- `monitor-session.cjs --running`: 9/9 sessions healthy at check time.
- `patrol.cjs`: `CRITICAL` due to missing `agents/shared/compliance-snapshot.json` baseline (integrity patrol degraded, not a hash mismatch event).

## Follow-ups to open (if not already tracked)
- Create/restore `agents/shared/compliance-snapshot.json` baseline so patrol can report meaningful integrity results.
- Decide fate of Process #15 (LLM Eval): implement vs retire.
