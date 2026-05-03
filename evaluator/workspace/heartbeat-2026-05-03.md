# Evaluator Heartbeat — 2026-05-03

## Checks

### Session evaluation pipeline (#5)
- DB recency check:
  - `MAX(evaluations.createdAt)=1777788995501`
  - `MAX(sessions.endedAt)=1777789222764`
  - Lag: `227263ms` (~3.8 minutes)
  - Interpretation: eval pipeline appears **live** (DB writes recent; lag small).
- Legacy artifacts:
  - `.state/evaluations/task_tree_*.json` newest observed mtime: **2026-03-24** (still stale).
  - Interpretation: treat as **legacy output path drift**, not pipeline failure.

### Patrol (integrity/coordination)
- `node agents/evaluator/skills/patrol.cjs` → `status=CRITICAL` due to missing `agents/shared/compliance-snapshot.json` baseline.
- Interpretation: **patrol degraded** (baseline missing), not evidence of active hash mismatch.

### Monitor running sessions
- `node agents/evaluator/skills/monitor-session.cjs --running` → 2 sessions checked, 2 healthy.

### LLM eval liveness (#15)
- `.state/may.db`: `sqlite_master` tables matching `*llm*` → `[]`.
- Interpretation: LLM-eval appears **disabled/unimplemented (or renamed)**; periodic-tasks.md should continue to treat it as missing.

## Notes / follow-ups
- Consider opening/refreshing a tracked item for restoring `agents/shared/compliance-snapshot.json` baseline (owner likely Bob per periodic-tasks.md), so `patrol.cjs` no longer reports CRITICAL by default.
