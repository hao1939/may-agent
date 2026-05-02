# Evaluator Heartbeat — 2026-05-02

## Eval pipeline liveness (DB canonical)
- `MAX(sessions.startedAt)=1777687025372`
- `MAX(evaluations.createdAt)=1777686991632`
- Lag: `43633ms` (≈43.6s) → **pipeline live**.

Evidence:
- `bun -e ... select max(startedAt) ...` + `select max(createdAt) ...` (see tool transcript)

## Legacy artifact drift
- `.state/evaluations/` mtimes show newest `task_tree_*.json` still around **2026-03-24**.
- DB continues to update, so treat this as **legacy output path drift**, not pipeline failure.

## Monitor-session (running sessions)
From `node agents/evaluator/skills/monitor-session.cjs --running`:
- **STALL**: `s_1777626616591_0` (amy) idle **1007 min**, recommended action `kill`.
- **DRIFT**: `s_1777686394847_3353` (arc), recommended action `warn`.
- **PROTOCOL_VIOLATION (P114)**: `s_1777686825641_3398` (coach), recommended action `warn`.
- **PROTOCOL_VIOLATION (P114)**: `s_1777687033778_3432` (optimizer), recommended action `warn`.

## Patrol
- `node agents/evaluator/skills/patrol.cjs` → `CRITICAL`: missing `agents/shared/compliance-snapshot.json` baseline.
- Interpreted as **patrol degraded** (not a hash-mismatch incident).

## Follow-ups
- Consider filing/dispatching a task to create/restore `agents/shared/compliance-snapshot.json` (owner: Bob per periodic-tasks notes) so patrol can provide meaningful integrity status.
