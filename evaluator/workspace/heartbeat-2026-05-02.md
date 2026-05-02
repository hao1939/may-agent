# Evaluator heartbeat — 2026-05-02

## Checks performed (structural evidence)

### Session evaluation pipeline freshness (DB is canonical)
- Evaluations latest `createdAt`: **2026-05-02T21:16:35.529Z** (count 2424)
- Sessions latest `startedAt`: **2026-05-02T22:49:55.780Z** (count 9299)
- Lag: **5,600,251 ms ≈ 93.3 minutes**
- Sessions started since last evaluation: **138**
  - Top contributors since last eval: evaluator 76, amy 33, coach 6, bob 4, tech-lead 4, others <=3

Evidence: bun/sqlite queries in tool output (see session transcript).

### Legacy artifact directory (.state/evaluations)
- Latest mtime observed: **Apr 29** for `s_*.json`
- `task_tree_*.json` files: latest observed **Mar 24**

Interpretation: DB is updating (evals through May 02), while `.state/evaluations/` looks stale → likely legacy-output-path drift (known chronic issue) rather than pipeline totally dead.

## Findings / actions

1) **Coverage risk / freshness:** Evaluation job appears to lag behind session creation by ~1.5h at the moment. This could be normal depending on cron interval/backlog, but it’s measurable: 138 unevaluated sessions currently.

2) **Observability gap:** No `events.event_type` entries containing `eval`/`evaluation` were found, so it’s hard to confirm handler liveness from the events table alone. (This might be expected if eval writes directly to `evaluations` without emitting events, but then we lack easy health probes.)

## Recommendation (for May / tech-lead)
- Add/confirm a lightweight emitted event like `evaluation.run.completed` with `evaluatedCount` and `latestSessionStartedAt` so evaluator can track freshness via events.
- Alternatively, add a metric/alert: `evaluation_lag_minutes = (max(sessions.startedAt) - max(evaluations.createdAt))/60000` and threshold it.
