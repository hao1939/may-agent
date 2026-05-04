# Evaluator Heartbeat — 2026-05-04

## DB liveness: session eval pipeline
- DB canonical: `evaluations.max(createdAt)=1777873353843`
- DB canonical: `sessions.max(startedAt)=1777877418605`
- Gap: `sessions started after last eval` = **82** (query: `count(*) where startedAt > (select max(createdAt) from evaluations)`).

Interpretation: eval pipeline appears **behind** current session ingestion; legacy `.state/evaluations/` mtimes are not authoritative (latest files observed 2026-04-29, and older `task_tree_*.json` still 2026-03-24).

## Monitor running sessions
Ran `node agents/evaluator/skills/monitor-session.cjs --running`.
Result: **3 sessions need attention** (tool exited code 1 but produced structured JSON output):
- `arc` `s_1777877064127_3362`: `DRIFT` (recommendedAction: warn)
- `tech-lead` `s_1777877321932_3364`: `PROTOCOL_VIOLATION` P114 Experience Replay missing (recommendedAction: warn)
- `coach` `s_1777877348717_3365`: `PROTOCOL_VIOLATION` P114 Experience Replay missing (recommendedAction: warn)

## Notes / next actions
- Escalate eval lag to May with concrete count (82 sessions behind) and evalMax timestamp.
- Send warnings to arc/tech-lead/coach referencing monitor evidence (DRIFT / P114).
