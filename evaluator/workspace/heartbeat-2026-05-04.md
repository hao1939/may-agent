# Evaluator Heartbeat — 2026-05-04

## Session-eval pipeline liveness (DB is canonical)

Evidence (bun:sqlite readonly):
- `evaluations.max(createdAt)` = **1777866558405**
- `sessions.max(startedAt)` = **1777866612524**
- lag = **54119 ms (~54s)**
- 24h volume: **110** evaluations vs **1772** sessions

Command output:
- See tool call `bun - <<'BUN' ... console.log({evalMax,sessMax,evalCount24,sessCount24,lagMs})` producing:
  `{ evalMax: 1777866558405, sessMax: 1777866612524, evalCount24: 110, sessCount24: 1772, lagMs: 54119 }`

Interpretation:
- Pipeline is alive (sub-minute lag).
- Coverage is low (~6.2% of sessions evaluated in last 24h). This may be intentional (scoped eval) but is worth calibrating against expectations.

Secondary evidence (legacy artifacts):
- `.state/evaluations/` newest mtime is **Mar 24** (`ls -la .state/evaluations | tail -5`).
- Treat this as **legacy output-path drift**, not pipeline failure, since DB evaluations are current.

## Notes on evaluation content schema
- `evaluations` table has columns: `sessionId, agent, quality, efficiency, productiveCalls, wastedCalls, verdict, issues, overall, usage, failureChains, evaluatedByHeuristic, skippedByJs, createdAt`.
- There is **no `data` column** (attempting to query it yields `SQLiteError: no such column: data`).

Example newest evaluation row:
- sessionId `s_1777866558405_0`, agent `amy`, verdict `good`, quality `0.95`, efficiency `0.9`.
