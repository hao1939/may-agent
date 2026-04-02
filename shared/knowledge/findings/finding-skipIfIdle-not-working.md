# Finding: skipIfIdle Feature Exists But Never Fires

**Date**: 2026-03-18T04:12Z  
**Severity**: HIGH — this is the root cause of ongoing session waste

## Problem

The `shouldSkipIdleHeartbeat()` function in `src/app/cron.ts:413` is deployed but **never actually skips any heartbeats**.

Evidence: Queried `.state/may.db` (1,135 total requests) — **zero** have `idle_skip` in their context field.

## Root Cause Analysis (Updated 2026-03-18T07:19Z)

**Correction**: `getDb()` correctly uses `may.db` (774KB, 1,316 requests). `hasPendingWork()` works correctly — returns `false` for 9/10 agents (only `may` has pending sends).

The actual issue is in the initiative cadence logic at line 433:
- `recentCount < 1` → `return false` (don't skip if no recent completed heartbeats match artifact)
- The old PID 7 process loaded config where `entry.name` values may not match the current artifact patterns in the DB
- No cron entries have `skipIfIdle: true` set explicitly — the function defaults to evaluating but the initiative cadence check likely fires `return false` early

**Result**: 0 idle skips out of 1,316 total requests. The function evaluates but never decides to skip.

## Impact

- May: 7+ idle 1-op sessions in 3 hours (each costs ~$0.04-0.08)
- Coach: Multiple 1-op idle sessions
- All agents: The 81.2% idle session rate (finding-idle-session-waste.md) persists because the skip mechanism silently fails

## Proposed Fix

1. **Verify `getDb()` uses the correct DB path** — the function in `request-tracker.ts` should open `may.db` not `requests.db`
2. **Add `skipIfIdle: true` to all heartbeat cron entries** as belt-and-suspenders (even though the code should work without it for undefined values)
3. **Add logging to `shouldSkipIdleHeartbeat`** when it decides to fire vs skip, so we can verify the fix

## Related

- `workspace/finding-idle-session-waste.md` — the broader idle session problem
- Request req:089b19d3 — already sent to tech-lead for idle pre-flight skip
- The cron reload fix and process restart are prerequisites for many fixes
