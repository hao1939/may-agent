# Coverage Fix: 7-Day Lookback Window

## Changes Made

### `agents/may/handlers/eval-poller.ts`

1. **MAX_AGE_MS**: `48 * 60 * 60 * 1000` → `7 * 24 * 60 * 60 * 1000` (48h → 7 days)
   - Root cause: With a 48h window, the poller could only ever reach sessions from the last 2 days. Coverage = evaluated/total-7d, so mathematically limited to ~28% (2/7).
   - Fix: Match the lookback to the metric window (7 days).

2. **processedSessionIds cap**: `slice(-500)` → `slice(-2000)`
   - With 7-day lookback and ~66 sessions/day (~462/week), 500 IDs would overflow causing re-evaluation attempts. Increased to 2000 to safely hold a full week.

### Deduplication Verification

The poller already has two layers of dedup:
- **Primary**: `processedSet.has(sessionId)` — checks in-memory set loaded from state file
- **Secondary**: `evaluateStandaloneSession()` returns `null` for already-evaluated sessions (checks `.state/evaluations/` directory)

No additional dedup logic needed.

## Expected Impact

- Current: 31 evaluated / ~462 total = 6.7% coverage
- Projected: With 20 sessions/run × 48 runs/day = 960 capacity/day, full 7-day backlog will be cleared in ~1 day
- Target: 50%+ coverage within 2-3 days as backlog is processed
