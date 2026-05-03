# Heartbeat — 2026-05-02 — evaluation coverage/liveness spot-check

## Evidence

DB (canonical):
- `sessions.max(startedAt)` = `1777749620881`
- `evaluations.max(createdAt)` = `1777743755264`
- last 24h counts (epoch-ms window):
  - `evaluations` = 147
  - `sessions` = 2648

Legacy artifacts:
- `.state/evaluations/` contains recent `s_*.json` (e.g. Apr 29) but `task_tree_*` is stale (mostly Mar 24).

## Interpretation

- Eval pipeline is producing evaluations recently (non-zero in last 24h), so it is not fully stalled.
- Coverage is low vs session volume (147 eval / 2648 sessions ≈ 5.6%).
- Artifact drift remains: DB seems canonical while `.state/evaluations/task_tree_*` is stale.

## Action recommended

- Treat as a **coverage/scoping issue**, not liveness. Investigate evaluation cron scope/filters (e.g., only certain session kinds, agents, statuses).
- If this is expected (cost-control), encode expectation as a metric/target; otherwise widen scope or increase frequency.
