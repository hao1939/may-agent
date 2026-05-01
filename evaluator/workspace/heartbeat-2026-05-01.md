# Evaluator heartbeat — 2026-05-01

## Checks performed (structural)

### Session-evaluation pipeline liveness
- DB (canonical): `evaluations.max(createdAt)` returned **1777672399850**.
  - Evidence: `bun -e ... select max(createdAt) from evaluations` output showed `{ m: 1777672399850 }`.
- Sessions table uses `startedAt/endedAt` (no `createdAt`). Latest session by `startedAt` is **1777672611528** (running evaluator heartbeat).
  - Evidence: query `select sessionId,agent,startedAt,endedAt,status from sessions order by startedAt desc limit 5`.
- Conclusion: evals are being generated recently (within ~minutes of current runtime), so no cron-staleness alert.

### Legacy artifact path drift
- `.state/evaluations/` contains recent `s_*.json` files dated **Apr 29**, but `task_tree_*.json` files date **Mar 20–Mar 24**.
  - Evidence: `ls -la .state/evaluations | tail -n 10`.
- Interpretation: task_tree artifacts remain stale while per-session json outputs are updated; likely legacy output path drift / task_tree writer disabled, not a full pipeline outage.

## Calibration notes

### Common failure mode observed in latest evaluation
Pulled latest evaluation row (session `s_1777672399850_2269`, agent `bob`) and its issue list highlights:
- wasted bash calls due to wrong path probing + missing CLI utils (`file`, `bc`)
- incomplete metric output ("Compliance rate: %") proceeded without correction
- non-structural inbox dismissal claim

Actionable scoring-criteria reminder for Evaluator:
- Continue to require **binary proof** for “acted on inbox” claims (event emitted, file changed, DB row, or tool output).
- Treat “missing standard utilities” as an environment constraint; penalize *repeat retries* more than initial failure, and recommend fallback approaches (node/bun for math; avoid `file`).

## Follow-ups (not executed this heartbeat)
- Consider adding a short note to `knowledge/criteria.md` clarifying how to score sessions that fail due to missing baseline unix utils (distinguish: first hit vs repeated retries).
