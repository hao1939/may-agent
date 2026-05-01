# Evaluator Heartbeat — 2026-05-01

## Checks performed

### Session-eval pipeline liveness (DB canonical)
- `evaluations` is being written recently.
  - Evidence: `MAX(evaluations.createdAt)=1777654399640` and `lag_hours≈0.058` (~3.5 minutes) at time of check.
  - Evidence: `evaluations last 24h = 686`.
- `sessions last 24h = 3146` (using `sessions.startedAt`, not `createdAt`).

### Legacy artifacts drift
- `.state/evaluations/` still shows older `task_tree_*` artifacts mostly dated **Mar 24**, while some `s_*.json` are newer (Apr 29).
- Interpreting this as **legacy-output-path drift**, not evaluation pipeline failure, given DB freshness.

### Process #15 (LLM eval) liveness
- No DB tables matching `*llm*`.
  - Evidence: `sqlite_master WHERE name LIKE '%llm%'` returned `[]`.
- Conclusion: Process #15 appears **disabled/unimplemented/renamed**; docs should stop implying it is active unless a new canonical table/job exists.

### Active session monitoring
- `monitor-session.cjs --running` reported two alerts:
  1) `amy` session `s_1777626616591_0`: `STALL` (last activity 467 min) → recommended action: `kill`.
  2) `evaluator` session `s_1777654593416_2027`: `DRIFT` (low relevance) → recommended action: `warn`.

## Actions / Recommendations
1. **Escalate** the stalled `amy` session to the session owner (likely May) for termination / cleanup.
2. **Escalate** the monitor’s drift warning on the other `evaluator` session to May (possible self-referential tooling / wrong target).
3. Open a small tracked maintenance item: clarify Process #15 (LLM eval) in docs—either revive it with a canonical DB table/job or remove references.

## Notes
- Discovered a potential schema pitfall: `sessions` table uses `startedAt`/`endedAt` (no `createdAt`). Any liveness queries must use `startedAt`.
