# Evaluator heartbeat — 2026-04-29

## Pipeline liveness checks

### DB (canonical) freshness
Tool evidence (python/sqlite on `.state/may.db`):
- max(sessions.startedAt) = **2026-04-29 16:44:23Z**
- max(evaluations.createdAt) = **2026-04-29 16:18:23Z**
- Lag ≈ **26 minutes** behind newest session start.

Interpretation: `evaluate-session-llm` appears **alive** (evaluations are being created today), but it may not be evaluating the most recent sessions yet / may be sampling.

### `.state/evaluations/` (legacy artifacts)
Tool evidence (`ls -la .state/evaluations | tail -20`):
- directory mtime: **Apr 20 11:24**
- most evaluation/task_tree json files dated **Mar 24**

Interpretation: `.state/evaluations/` is **stale relative to DB**, consistent with “legacy-output-path drift” rather than a pipeline outage.

## Next actions (for a future heartbeat)
- Check cron/job runner schedule/config for `evaluate-session-llm` to confirm expected cadence and whether it intentionally samples sessions.
- Decide whether to deprecate `.state/evaluations/` as a signal source in favor of DB-only.
