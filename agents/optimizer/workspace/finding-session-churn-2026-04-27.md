# Finding: Session Churn Waste — Coach & Bob

**Date**: 2026-04-27
**Severity**: P1
**Impact**: ~50% of system ops consumed by 2 agents with low per-session productivity

## Data (24h window)

| Agent | Sessions | Ops | Avg Ops/Session | Sessions/hr |
|-------|----------|-----|-----------------|-------------|
| coach | 189 | 2,097 | 11.1 | 7.9 |
| bob | 183 | 1,658 | 9.1 | 7.6 |
| amy | 77 | 527 | 6.8 | 3.2 |
| optimizer | 69 | 968 | 14.0 | 2.9 |
| tech-lead | 60 | 1,252 | 20.9 | 2.5 |

## Analysis

- **Coach + Bob = 372 sessions in 24h** (53% of all sessions), consuming 3,755 ops (44% of total)
- Average ops/session is low (9-11), suggesting many short, low-value sessions
- Coach has 6 interrupted sessions in just 6h — sessions starting but not completing
- **amy-kimi: 17 sessions, 0 ops** — 100% error rate (429 rate limiting), pure waste

## Root Cause Hypothesis

1. Cron intervals may be too aggressive for coach/bob — spawning sessions faster than they can produce value
2. Coach heartbeats are mostly triaging duplicate notifications (the dedup problem)
3. Bob may be retrying failed tasks repeatedly

## Recommendations

1. **Reduce coach/bob cron frequency** — 4 sessions/hr max (currently ~8/hr)
2. **Fix amy-kimi** — disable cron until rate limiting is resolved (17 wasted sessions)
3. **Add session-frequency circuit breaker** — if an agent has >5 sessions/hr with <10 avg ops, throttle

## Estimated Savings

Reducing coach+bob to 4/hr each saves ~190 sessions/day and ~1,800 ops/day.
