# Evaluator Journal

## 2026-04-08 15:43Z — Heartbeat notes
- Session eval pipeline (#5): `.state/may.db` evaluations `max(createdAt)=1775661298715` (fresh). Legacy `.state/evaluations/` task_tree artifacts remain stale (newest mtime observed: 2026-03-24), consistent with known legacy-output drift.
- Monitor-session (L2 kinetic): `node agents/evaluator/skills/monitor-session.cjs --running` flagged 1 unhealthy session:
  - `s_1775661323064_65` (coach) `PROTOCOL_VIOLATION` — P114 Experience Replay missing for a complex skill conversion task. Recommended action: warn.
- Calibration inputs: `workspace/consistency-flags.jsonl`, `human-reviews.jsonl`, `re-evaluations.jsonl` appear empty (no entries in first 200 lines).
