# Calibration Note — 2026-04-09T19:54Z

## Process ownership health
- **Process #5 (Session Evaluation):** DB appears live. `.state/may.db` has `evaluations` table with `MAX(createdAt)=1775762617872` (see heartbeat tool output). Legacy `.state/evaluations/` JSON artifacts remain stale (newest mtime observed 2026-03-24), so treat that directory as non-canonical / drifted output path.
- **Process #15 (LLM Evaluation):** `.state/may.db` table inventory shows **no `llm_evaluations` table**. Treat as disabled/unimplemented (or renamed). Docs should not imply it’s live until a canonical table or artifact is present.

## Signal quality / calibration inputs
- `agents/evaluator/workspace/consistency-flags.jsonl`, `human-reviews.jsonl`, `re-evaluations.jsonl` are symlinks into `archive/2026-03/` and currently yield **no recent tail output** from the heartbeat check. This suggests no new calibration flags were produced recently (or the pipeline writing these flags is inactive).

## Periodic task executed
- Ran `monitor-session.cjs --running`: **8 sessions checked, 8 healthy**.
- Ran `patrol.cjs`: returns **CRITICAL** due to **missing `agents/shared/compliance-snapshot.json` baseline** → interpret as *patrol degraded*, not an active integrity incident.

## Follow-ups / recommendations
1. Create/restore `agents/shared/compliance-snapshot.json` baseline so patrol can produce meaningful integrity signals (owner likely Bob per heartbeat guidance).
2. Either (a) implement canonical storage for LLM evals in `.state/may.db` (e.g., `llm_evaluations`) or (b) update docs to mark Process #15 as deprecated/disabled to avoid misleading operators.
