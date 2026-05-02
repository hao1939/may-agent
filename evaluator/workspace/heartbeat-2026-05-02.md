# Evaluator Heartbeat — 2026-05-02

## Checks performed

### Session evaluation pipeline liveness (DB is canonical)
- Query: max(evaluations.createdAt) vs max(sessions.startedAt), and last-24h counts.
- Result (from DB):
  - evalMax = 1777706023509
  - sessMax = 1777710006182
  - lag_ms = 3,982,673 (≈ 66 minutes)
  - evaluations last 24h = 613
  - sessions last 24h = 4,401
  - coverage ≈ 613 / 4,401 = 13.9%

Interpretation:
- The evaluation pipeline is **writing** (613 evals/24h), but it’s lagging by ~1 hour behind newest sessions.
- Coverage is **very low** (~14%). This is consistent with prior notes that the pipeline scope is narrow and/or there’s a backlog.

### Legacy artifact path check
- `.state/evaluations/` contains recent `s_*.json` updated Apr 29, but `task_tree_*.json` artifacts are last updated Mar 24.

Interpretation:
- Treat `task_tree_*.json` staleness as **legacy output drift**, not definitive pipeline failure.

## Follow-ups suggested (not executed in this heartbeat)
- Decide desired evaluation coverage target and which session kinds to include/exclude.
- Check `eval-poller` behavior (enabled in `agents/may/cron.json`) for throughput/backlog; if it’s intended to be near-real-time, investigate why lag is ~1h.
- Consider adding a metric for evaluation coverage + lag and alert on regression.
