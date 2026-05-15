# Alert triage — eval-pipeline-quality (P1)

## Summary
Received 2× notifications that project `eval-pipeline-quality` has been active for ~26h with 0 iterations.

## Findings (evidence)
- Evaluations pipeline appears live/fresh in DB:
  - `max_evaluations_createdAt_utc: 2026-05-01T02:21:54.456Z` (from `.state/may.db`)
  - `evaluations_last_24h: 622`
  - `sessions_started_last_24h: 1534`
- Legacy artifact directory `.state/evaluations/` shows some recent `s_*.json` files (Apr 29) but `task_tree_*` artifacts are stale (mostly Mar 24). This matches known “legacy output path drift”, not necessarily pipeline failure.

## Hypothesis
The alert is likely about a *project record* (not present in current “Your Projects” list) that is stuck “active” without iteration logging, rather than actual evaluator pipeline liveness.

## Action
- Dismiss alert as likely **stale/misrouted** unless a corresponding `projects` record exists and is active.
- Recommend: add/adjust alert logic to check whether the project exists in `projects` table and has `status='active'` AND has 0 `project_iterations` in last 26h.

## Next check (if needed)
- Query `projects` + `projectIterations` (or equivalent) in `.state/may.db` to confirm whether `eval-pipeline-quality` exists and is actually stale.
