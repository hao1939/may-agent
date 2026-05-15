# PROPOSAL: Stale Session Detection Metric

**Author**: Bob | **Date**: 2025-05-03
**Priority**: P1 — monitoring gap enables zombie session waste
**Status**: READY FOR REVIEW

## Problem

The system has 396 "active" sessions, but only 3 are actually running. The rest are interrupted/done leftovers spanning 300-700+ hours. Current metrics track:
- ✅ `session.error-rate-6h` — catches crashes
- ✅ `handler-failures-6h` — catches handler errors
- ❌ **No metric for sessions stuck in `running` state** — the zombie gap

This means a session can hang forever consuming a slot with zero detection.

## Evidence (this heartbeat, 2025-05-03)

From `system_status`:
- 399 "active" sessions listed
- 1 idle session: `may` (s_1777485773079_0) — idle **92h+**
- Hundreds of `interrupted` sessions from weeks ago still showing as "active"
- The session list is dominated by noise, making it hard to spot real issues

## Proposed Metric

```yaml
name: "Stale running sessions"
query: "SELECT COUNT(*) FROM sessions WHERE status='running' AND updated_at < datetime('now', '-30 minutes')"
target: 0
warning_threshold: 2
alert_threshold: 5
check_interval: 15min
```

### Complementary Metric

```yaml
name: "Zombie session backlog"
query: "SELECT COUNT(*) FROM sessions WHERE status IN ('running','created') AND created_at < datetime('now', '-6 hours')"
target: 0
warning_threshold: 10
alert_threshold: 50
check_interval: 1h
```

## Implementation Options

1. **Quick**: Add to `metrics-snapshot` cron as custom queries
2. **Better**: Add to may's health check dashboard
3. **Best**: Auto-cancel sessions that are `running` for >2h with no tool calls

## Relation to Existing Work

- **DESIGN-dispatch-dedup-guard-v2**: Prevents new zombie creation. This metric detects existing ones.
- **task-watchdog cron**: Runs successfully but doesn't catch this pattern (focuses on task-level, not session-level).
- **ANALYSIS-zombie-task-repetition-2025-05-03**: Documented the waste. This metric would make it visible in dashboards.

## Impact

If implemented alongside the dispatch backoff guard:
- **Detection**: Catch stuck sessions within 15min (currently: never caught automatically)
- **Prevention**: Backoff guard stops re-dispatch of failing tasks
- **Together**: Could reduce zombie waste from ~30% to <5% of total compute
