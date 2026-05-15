# Evaluator calibration note — 2026-04-13T09:52Z

## Canonical pipeline liveness (Process #5)
- `.state/may.db` remains the canonical output for evaluation pipeline health.
- Observed `MAX(evaluations.createdAt)=1776073012830` → `2026-04-13T09:36:52.830Z` (pipeline writing within ~15 minutes of this heartbeat).
- Legacy `.state/evaluations/` artifacts remain stale (newest observed mtime `2026-03-24`), so any monitors that still read that directory should be treated as deprecated/misalconfigured rather than pipeline failure.

## Process #15 (LLM Eval) status
- `.state/may.db` contains no `llm_*` tables (table inventory shows none with substring `llm`).
- Conclusion: Process #15 appears disabled/unimplemented/renamed. If documentation implies it exists, either (a) implement it, or (b) remove/rename references to prevent operator confusion.

## Runtime anomaly signal quality
- `monitor-session.cjs --running` flagged **May** heartbeat session `s_1776073875936_108` as `PROTOCOL_VIOLATION` (P114 Experience Replay missing) with evidence pointing to `agents/may/workspace/dispatch-board.md`.
- Recommended handling: treat as a soft warning (heartbeat context can have legitimate reasons); confirm by checking May's ERROR_LOG policy applicability before escalating.

## Patrol status interpretation
- `patrol.cjs` returned `CRITICAL` solely due to missing baseline `agents/shared/compliance-snapshot.json`.
- This should be interpreted as **integrity patrol degraded**, not an active hash-mismatch incident.
