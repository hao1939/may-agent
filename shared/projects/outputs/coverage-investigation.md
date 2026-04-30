# Coverage Investigation Report

## Summary

Coverage is at 6.7% (31 scored / ~462 total sessions in 7 days). Despite increasing MAX_SESSIONS_PER_RUN to 20 and MAX_AGE_MS to 48h, coverage remains low. This report investigates why.

## Metrics

| Metric | Value |
|--------|-------|
| Sessions scored (7d) | 31 |
| Implied total sessions (7d) | ~462 (31 / 0.067) |
| Daily session rate | ~66/day |
| Poller capacity (20/run × 48 runs/day) | 960/day theoretical max |

## Gap Analysis

### Problem 1: 48h lookback window vs 7d metric window

The coverage metric counts sessions over 7 days, but MAX_AGE_MS=48h means the poller only sees sessions from the last 2 days. Sessions older than 48h are permanently invisible to the poller. At 66 sessions/day, only ~132 sessions are in the eligible pool at any time.

**Impact**: Even with perfect processing, max achievable coverage = 132/462 = 28.6% — the poller can never reach 50% coverage of the 7-day window with a 48h lookback.

### Problem 2: Already-evaluated sessions consuming slots

If the poller doesn't efficiently skip already-evaluated sessions, it wastes slots re-checking them. Each run of 20 may include sessions already scored.

### Problem 3: Ramp-up time

The throughput increase was just deployed. At 20 sessions/run × 48 runs/day = 960 evaluations/day capacity, the backlog should clear within a day IF the lookback window is large enough.

## Root Cause

**The 48h MAX_AGE_MS is the binding constraint.** The 7-day coverage metric requires a 7-day (or larger) lookback window to achieve 50%+ coverage.

## Recommended Fix

1. **Increase MAX_AGE_MS to 7 days** (`7 * 24 * 60 * 60 * 1000` = 604800000ms). This aligns the poller's lookback with the coverage metric's window.
2. **Ensure deduplication**: The poller must skip sessions that already have evaluations in `.state/evaluations/`. This prevents wasting slots.
3. **No frequency change needed**: 48 runs/day × 20 sessions = 960 slots, well above the ~462 sessions needing evaluation.

## Proposed Code Change

In `agents/may/handlers/eval-poller.ts`:

```typescript
// Line 22: Change from 48h to 7 days
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
```

## Expected Outcome

After this change, coverage should reach 50%+ within 24-48 hours as the poller works through the full 7-day backlog. Steady-state coverage should approach 100% since capacity (960/day) far exceeds demand (66/day).
