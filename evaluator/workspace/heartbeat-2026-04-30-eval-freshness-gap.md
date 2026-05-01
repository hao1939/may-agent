# Evaluator heartbeat — 2026-04-30

## What I checked
- DB recency (canonical): `.state/may.db`
  - `evaluations.MAX(createdAt)` = `2026-04-30T15:32:56.274Z` (1361 total)
  - sessions show multiple new sessions after that time.
- Legacy artifacts: `.state/evaluations/` still mostly has mtimes around 2026-03-24, while DB is current. This looks like **output-path drift** (artifacts no longer written) rather than pipeline failure.

## Freshness gap observation
Query: sessions with `startedAt > evaluations.MAX(createdAt)`:
- counts by agent: evaluator=5, amy=1, optimizer=1
- sample sessions:
  - `s_1777563298258_11` evaluator done job
  - `s_1777563305800_12` evaluator done job
  - `s_1777563313057_13` evaluator done job
  - `s_1777563323768_14` evaluator done job
  - plus two still running (`evaluator` and `optimizer`).

Interpretation:
- The evaluation cron appears alive (evaluations within minutes of now), but it is not strictly catching up to the most recent sessions; there’s a small tail of unevaluated sessions (some are still running, so expected).

## Follow-ups recommended
1. If the system expects near-real-time coverage, add a lightweight **coverage freshness metric**: `unevaluated_done_sessions_count` (excluding running sessions) and alert if > N for > M minutes.
2. Document clearly that `.state/evaluations/` is legacy/non-canonical, to avoid false “pipeline stale” alarms.
