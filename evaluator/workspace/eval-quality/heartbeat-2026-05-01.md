# Evaluator Heartbeat — 2026-05-01

## Checks performed

### Session evaluation pipeline liveness (#5)
- DB (canonical): `.state/may.db`
  - `evaluations`: **1641 rows**, `max(createdAt)=1777603997546`
  - `sessions`: **3530 rows**, `max(endedAt)=1777605706976`
  - Lag: sessions are newer than evaluations by ~**28.5 minutes** (difference in epoch ms: 1700941430).

### Legacy artifact path (.state/evaluations)
- Latest `task_tree_*.json` mtime from `ls -la .state/evaluations | tail -5`: **Mar 24 10:34**
- Interpretation: DB is being updated recently, but the legacy `task_tree` artifacts are stale → likely **output-path drift** rather than evaluator cron being dead.

## Pending events (inbox)
- 4× `agent.notification` about project `eval-pipeline-quality` being active but "h…" (truncated). No active projects currently listed.
  - Action: **dismiss as stale/duplicate notification** unless a project file exists and indicates active work.

## Follow-ups
1. If evaluation coverage complaints persist, investigate whether JS path that writes `.state/evaluations/task_tree_*.json` has been retired.
2. Consider adding a small dashboard check: if DB evaluations are fresh but `.state/evaluations` is >7d stale, suppress/retire alerts that treat it as primary.
