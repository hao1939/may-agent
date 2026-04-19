# Evaluator Calibration Note — 2026-04-14T03:52Z

## Process #5 (Session Eval) liveness
- DB canonical check: `.state/may.db` contains table `evaluations` and `MAX(evaluations.createdAt)=1776137757747` (ms epoch).
- Legacy artifacts: `.state/evaluations/` still stale; newest observed mtime in tail sample remains 2026-03-24 (task_tree_*.json).
- Interpretation: session-eval pipeline is live in DB; legacy `.state/evaluations/` output path appears deprecated/stale.

## Process #15 (LLM Eval) status
- DB table inventory shows **no** `llm_evaluations` / `llm_evals` / `session_evaluations` tables (only `evaluations`, `sessions`, etc.).
- Interpretation: LLM-eval process appears disabled/unimplemented (or renamed). Recommend either (a) revive with explicit table+writer or (b) remove docs that imply it exists.

## Signal quality / runtime defenses
### monitor-session.cjs (--running)
- Reported 2 alerts:
  - `STALL`: coach session `s_1776133354975_536` idle 27 min (recommended action: investigate)
  - `PROTOCOL_VIOLATION`: may session `s_1776138677801_562` P114 Experience Replay missing (recommended action: warn)

### patrol.cjs
- `CRITICAL` due to missing `agents/shared/compliance-snapshot.json` baseline.
- Interpretation: integrity patrol degraded, not evidence of tampering.

## Follow-ups
- Open/track item: create/restore `agents/shared/compliance-snapshot.json` baseline (owner: Bob per periodic-tasks.md note).
- Decide: revive vs remove Process #15 LLM-eval documentation.
