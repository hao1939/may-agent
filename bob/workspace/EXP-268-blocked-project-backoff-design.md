# EXP-268: Blocked Project Exponential Backoff

**Status**: DESIGNED  
**Author**: Bob  
**Date**: 2025-05-01  
**Hypothesis**: H-215 — Blocked project re-checks waste 500+ iterations/day when unblock rate is near zero.

## Background

System metrics show:
- 4/5 active projects are blocked  
- 130 project iterations/day (target: 10)
- `consecutiveSkips` reaching 301 for some projects
- Each skip still costs dispatch/check overhead

The project poller checks every blocked project on every cycle, even when nothing has changed. This is O(blocked × cycles), but unblocks are rare (~1 per week).

## Hypothesis

**H-215**: Implementing exponential backoff on blocked project re-checks (capped at 8h max interval) will reduce project iteration count by >80% without missing any real unblock events within 30 minutes of occurrence.

## Design

### Intervention: Exponential Backoff Rule

```
For each project P with status "blocked" or "waiting":
  backoff_interval = min(BASE_INTERVAL * 2^(consecutiveSkips / GROWTH_RATE), MAX_INTERVAL)
  
  Where:
    BASE_INTERVAL = 5 minutes (current cycle time)
    GROWTH_RATE = 3 (double every 3 consecutive skips)
    MAX_INTERVAL = 8 hours

  If time_since_last_check < backoff_interval:
    skip without incrementing attempts
```

### Unblock Signal Override

To avoid missing real unblocks, the backoff resets to 0 when:
1. A commit touches files in the project's scope
2. A dependent task completes
3. An agent explicitly marks it "ready-to-retry"

### Measurement Plan

**Baseline (1 week, no change)**:
- Count: project iterations per day
- Count: actual unblock events
- Measure: time from unblock condition → project resumption

**Treatment (1 week, backoff enabled)**:
- Same metrics
- Additional: backoff intervals actually used (distribution)
- Check: did any unblock get delayed by >30min?

### Success Criteria

1. Project iterations/day drops from ~130 to <30 (>75% reduction)
2. No unblock event delayed by more than 30 minutes
3. System error rate stays ≤ 5%

### Implementation Location

The project poller lives in May's cron job system. Changes needed:
1. `.state/project-health-state.json` — add `lastCheckTimestamp` and `currentBackoffMs` per project
2. May's project handler — add backoff gate before processing each project
3. Reset trigger — listen for commit events or task-completion events

### Estimated Effort

- Design: Done (this doc)
- Implementation: 1-2 tech-lead sessions
- Measurement: Automated via existing metrics (project iterations/24h)

### Risk

LOW — worst case, a blocked project sits 8h longer than necessary before being re-checked. Given current unblock frequency is ~1/week, this is negligible.

## Next Step

Notify tech-lead to evaluate feasibility of adding backoff gate to project poller.
