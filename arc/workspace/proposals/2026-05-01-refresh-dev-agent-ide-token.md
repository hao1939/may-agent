# Proposal: Refresh dev-agent IDE token (dev has been down ≥14h)

**For:** Hao (anyone with shell/credential access)
**From:** arc heartbeat 2026-05-01 ~07:00Z (UPDATED 2026-05-01 ~11:18Z)
**Urgency:** HIGH — dev fully non-functional 14h+, may still not noticing

## UPDATE 2026-05-01 11:18Z

Four hours after the original proposal, nothing has changed:

- **22 consecutive 401 errors** for dev (was 13 at first writing)
- **Last successful dev session:** 2026-05-01 00:58:35Z (≥10h ago, was 6h)
- **dev 6h failure rate:** 14/14 = 100%
- **System 6h failure rate:** 25/1348 = 1.85% (GREEN — alert threshold 30%)
- May ran ≥8 heartbeats in the interim, each concluded "system healthy".

The aggregate `session.error-rate-6h` metric is **mathematically incapable**
of catching this: dev fires ~3×/hour, system fires ~225×/hour, so dev's
100% failure dilutes to ~1.3% of total. **No threshold tuning fixes this**
— need a per-agent metric. See KE-440.

## Problem

`dev-agent` has been firing on schedule but failing every single
session for ≥9 hours with `401: IDE token expired: unauthorized:
token expired`.

```
$ bun -e "...SELECT MIN(startedAt), COUNT(*) FROM sessions
          WHERE agent='dev' AND status='error'..."
{ first: '2026-04-30T21:17:17Z', n: 13 }   # 13 consecutive failures

$ bun -e "...SELECT MAX(startedAt) FROM sessions
          WHERE agent='dev' AND status='done'..."
{ last:  '2026-05-01T00:58:35Z' }          # 6h before this proposal
```

May's 06:49 heartbeat noticed 2 of these and described them as
"minor token-expired errors. Not critical but worth monitoring."
This is a severity-misread: dev is **down**, not flaky. Every dev
heartbeat since 21:17 UTC has produced zero output.

## Evidence

- 13 consecutive 401 errors, every ~30 min, identical message.
- 0 successful dev sessions in the last 6 hours.
- Pattern: not retryable from inside the agent — token has to be
  refreshed externally (probably an env var / credential file).

## Proposed Change

1. Refresh whatever credential dev-agent uses for "IDE token"
   (likely a JWT for the IDE/coding tool).
2. Verify next dev heartbeat completes successfully (status='done',
   not 'error').
3. **Process fix:** add a metric `agent.error-streak-by-agent` that
   alerts when any agent fails >3 consecutive sessions. Right now
   the only error-rate metric is `session.error-rate-6h` which
   buckets all agents together — dev's 100% failure rate disappears
   into the system aggregate (currently 3.85%, green).

## Expected Impact

- dev resumes producing output.
- Future per-agent outages get caught in <2 hours instead of
  waiting for someone to read individual session histories.

## Risks

- The metric in #3 needs care: some agents legitimately have low
  fire rates and one error in two sessions = 50% false alarm.
  Suggest "≥3 consecutive errors AND ≥0 successes in same window"
  as the trigger.
- Unknown whether the IDE token has a known refresh procedure
  documented anywhere. Worth capturing it as part of the fix.

## Related
- KE-431 sidecar finding (same heartbeat that wrote KE-431 also
  under-classified this).
