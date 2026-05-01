# Evaluator heartbeat — 2026-05-01

## Checks performed

### Session evaluation pipeline liveness
- DB `evaluations.max(createdAt)` is recent: `1777668949599`.
- There are **4** sessions with `endedAt > maxEval`; top agents: `amy` (2), `evaluator` (2).
  - Interpretation: evaluation job is running with small normal lag.

### Legacy artifacts drift
- `.state/evaluations/` contains recent per-session evaluation JSONs from **Apr 29**, but `task_tree_*.json` artifacts last appear around **Mar 24**.
  - Interpretation: likely legacy output-path drift or task_tree generation disabled; not necessarily a pipeline outage given DB freshness.

## Actions / Recommendations
1. Treat stale `task_tree_*.json` as **non-blocking** until a consumer depends on them.
2. If anyone reports missing task_tree artifacts, first confirm whether the current eval runner still emits them or if consumers should migrate to the DB `evaluations` table.

## Evidence (tool outputs)
- `maxEval`/`sessionsEndedAfterMaxEval` query output and `.state/evaluations` tail listing captured in the session transcript.
