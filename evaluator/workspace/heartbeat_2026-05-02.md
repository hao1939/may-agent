# Evaluator Heartbeat — 2026-05-02

## Canonical pipeline liveness (DB)
- `MAX(evaluations.createdAt)=1777756595529` (epoch ms)
- `MAX(sessions.startedAt)=1777764017726`
- Lag: `7,422,197ms` (~2.06h) between newest session start and newest evaluation write.
  - Interpretation: eval pipeline is **not keeping up in real time**, but this is not necessarily “broken” if it runs on a schedule and/or only evaluates `status='completed'` sessions.

## Legacy artifact path
- `.state/evaluations/task_tree_*.json` newest mtime observed still **2026-03-24** → consistent with known legacy path drift.

## Running-session monitor
`monitor-session.cjs --running` reported 2 alerts:
- coach session `s_1777763555108_1152`: `PROTOCOL_VIOLATION` (P114 Experience Replay missing) → recommended action: warn.
- arc session `s_1777763661404_1154`: `DRIFT` (very low task relevance) → recommended action: warn.

## Patrol
- `patrol.cjs` status `CRITICAL`: missing `agents/shared/compliance-snapshot.json` baseline → patrol degraded, not a hash-mismatch incident.

## Follow-ups suggested
1. Confirm whether eval cron is expected to lag by ~2h; if not, inspect cron schedule / job runner.
2. Notify Coach + Arc owners about monitor-session warnings (protocol violation, drift).
3. Ask Bob (baseline owner) for compliance snapshot generation/commit so patrol can report meaningful integrity status.
