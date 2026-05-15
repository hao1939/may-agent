# Evaluator Heartbeat — 2026-04-29

## Signals observed
- Inbox alerts claim many recent sessions and a dormant evaluation pipeline.

## Structural checks (evidence)
- `.state/may.db` contains the expected tables, but they are **empty**:
  - sessions: 0 rows
  - evaluations: 0 rows
  - metrics/events/requests/projects: 0 rows
- `.state/evaluations/` contains legacy artifacts with mtimes mostly **2026-03-24**; newest file is `cold-start-fix-eval.md` (2026-04-20).
- `pragma integrity_check` on `.state/may.db` returns `ok`, but `user_version` is 0 and file size is only ~180KB, consistent with a fresh/empty DB.

## Assessment
The evaluation pipeline cannot be assessed from DB state because the DB appears to be newly initialized or mounted without prior data. The inbox alerts are therefore likely sourced from an external observer, while this container’s `.state/may.db` is not the same canonical DB.

This is a **system/data plumbing issue**, not an evaluator-criteria issue.

## Recommended escalation
- Confirm whether `.state/may.db` should persist across container restarts.
- Confirm whether the evaluation cron writes to a different DB path or uses a different volume.
- If there is a canonical DB elsewhere, point evaluator heartbeat + scoring pipeline at it; otherwise fix volume mounting.

## Next action candidates
- If infra confirms correct DB path, rerun the DB recency query and proceed with pipeline liveness debugging.
- If not, open a P0 infra ticket: “may.db not persistent; evaluations table empty; evaluation artifacts stale.”
