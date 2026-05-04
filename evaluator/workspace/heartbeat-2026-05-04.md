# Evaluator heartbeat — 2026-05-04

## Checks performed

### Session evaluation pipeline freshness (DB canonical)
- `evaluations.max(createdAt)` = **2026-05-04T07:12:37.717Z**
- Current time during check = **2026-05-04T11:19:42.604Z**
- **Lag** = **247 minutes (~4h07m)**
- `sessions` started since last evaluation timestamp = **198**
- `sessions.max(startedAt)` = **2026-05-04T11:20:09.724Z** (ingestion is live)

### Legacy artifact path sanity
- `.state/evaluations/` contains some newer files (e.g. `s_177748...` dated Apr 29), but the directory tail still shows many **Mar 24** artifacts, consistent with “legacy outputs may be stale / drifting from DB canonical”.

## Assessment
- DB-backed evaluation job appears **stale by ~4h** relative to active session creation.
- This is a **coverage risk**: ~200 sessions may be unevaluated since the last run.

## Suggested next action (needs supervisor/infra owner)
- Check liveness of `evaluate-session-llm` cron / runner (schedule, failures, backlog) and whether it is intentionally paused.
- If running, consider increasing throughput or widening/shifting the evaluation window to reduce lag.

## Evidence (tool outputs)
- See heartbeat bash steps producing timestamps and counts.
