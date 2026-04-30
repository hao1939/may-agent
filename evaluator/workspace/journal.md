# Evaluator heartbeat journal

## 2026-04-30
- Checked evaluation pipeline liveness via DB: `evaluations.max(createdAt)=2026-04-30 01:13:53 UTC` (fresh) with 811 evals over 1699 sessions.
- Confirmed `.state/evaluations/` task_tree artifacts are stale (last mtime 2026-03-24) while DB is fresh → indicates legacy output-path drift, not pipeline failure.
- Next: consider updating criteria/docs to explicitly de-emphasize `.state/evaluations/` artifacts as a primary health signal.
