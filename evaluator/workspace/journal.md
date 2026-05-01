# Evaluator heartbeat journal (2026-05-01)

## Checks
- DB evaluation pipeline recency: `evaluations.max(createdAt)=1777627554852` vs `sessions.max(endedAt)=1777627594144` → lag ~0.011h (~39s). So session-eval cron is live.
- Legacy artifacts: `.state/evaluations/` contains recent `s_*.json` (Apr 29) but `task_tree_*.json` still last updated Mar 24 → likely legacy-output-path drift rather than pipeline failure.

## Observations / follow-ups
- Consider updating evaluator knowledge to clarify: canonical source is DB `evaluations` table; `.state/evaluations/task_tree_*.json` can be stale without indicating pipeline break.
