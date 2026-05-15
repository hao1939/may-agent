# Metrics Design Doc Review

**Reviewed**: `agents/shared/may-agent-docs/design/agent-metrics.md` + `agents/may/handlers/metrics-snapshot.ts`
**Date**: 2025-07-01

## 1. Source Query Efficiency

- **Event table scans**: Fine at current scale IF `(event_type, timestamp)` composite index exists. Without it, every query is a full scan that degrades linearly.
- **`json_extract` in heartbeat-coverage and p95-duration**: Can't use indexes. ~180 rows/6h currently — fine. Consider denormalizing `agent` and `handler_name` to top-level columns.
- **N+1 in stale-project detection**: Runs one query per active project with `LIKE '%projectId%'`. Replace with single query using `NOT EXISTS` subquery.
- **`git log` (doc's `system.real-output-24h`)**: Not implemented in code. If added, `git log --since=24.hours` is fast.

## 2. Heartbeat Coverage Query

Current implementation queries `handler.completed` events where handler name LIKE `heartbeat-%`. This works. Concerns:
- `LIKE 'heartbeat-%'` is fragile — naming changes break it silently
- Target of 8 is hardcoded; should derive expected count from agent registry
- Consider dedicated `agent.heartbeat` event type

## 3. Auto-Registration

Already solved in code — `ALL_METRICS` array + `INSERT OR IGNORE` loop runs every 5min. But doc says 6 metrics, code defines 12. They're diverged. Recommend extracting to shared config file.

## 4. Architecture Soundness

5-min intervals for 12 metrics against local SQLite: fine, likely <100ms total. Issues:
- No deduplication guard for overlapping cron fires
- No error isolation — one failing metric query kills all measurements
- `source_command` with `execSync` is arbitrary shell execution from DB content (security risk)

## 5. Missing Pieces

1. **Doc-code divergence**: `session.error-rate-6h` and `system.real-output-24h` missing from code; code has 6 extra metrics not in doc
2. **No threshold checking/alerting** in this handler (presumably in `metric-alert-reactor.ts`)
3. **No retention cleanup**: `metric_snapshots` grows ~3,456 rows/day with no pruning
4. **Silent error swallowing** in generic metrics section (`catch { }`)
5. **Missing composite index** on `events(event_type, timestamp)`
