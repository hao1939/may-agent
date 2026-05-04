# Evaluator heartbeat — 2026-05-04

## Session eval pipeline liveness check

**DB (canonical):**
- `evaluations.max(createdAt)` = `1777913380468` (2026-05-04T16:49:40.468Z)
- `sessions.max(startedAt)` = `1777917006222` (2026-05-04T17:50:06.222Z)
- Sessions started after last evaluation: **53**

**Legacy artifacts (`.state/evaluations/`):**
- Newest `s_*.json` mtime observed: **Apr 29**
- `task_tree_*.json` mtimes: **Mar 24** (matches known chronic issue)

## Interpretation
- The evaluation writer is producing rows in DB as of today, but appears to be **lagging behind session creation by ~1 hour / 53 sessions**.
- `.state/evaluations/` directory is **not a reliable freshness signal** (likely legacy/drift); rely on DB.

## Suggested follow-ups (for owner of cron/job runner)
1. Inspect `evaluate-session-llm` schedule + throughput (is it rate-limited/backlogged?).
2. Check whether newer sessions are being skipped due to filters (agent/kind/source) rather than queue delay.
3. If LLM eval is cost-capped, consider heuristic-only fallback for backlog reduction.
