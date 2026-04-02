# Finding: Evaluator Heartbeat Storm

**Date**: 2026-03-17T23:04
**Status**: Active waste
**Estimated waste**: ~$10-15/day

## Summary

Evaluator heartbeat sessions fire at 6-10x the configured 2h interval (7200000ms). In the last 8h:
- **39 evaluator heartbeat sessions** (expected: ~4 at 2h intervals)
- Burst patterns: 11 heartbeats in 18 minutes (21:05-21:23 UTC)
- Gaps as small as 19-22 seconds between heartbeats
- **ALL had 0 ops** — they start, read files, and either get interrupted or complete with no productive work

## Root Cause

Two mechanisms are both overtriggering:

### 1. Regular timer fires at ~30min despite 2h config
Despite `intervalMs: 7200000` in cron.json, evaluator heartbeats appear at 30-min intervals (17:34, 18:04, 18:34). This suggests either:
- Cron hot-reload didn't pick up the 2h interval (was it changed from 30min recently?)
- Multiple timer instances running for the same entry
- Timer drift/restart bug

### 2. `triggerNow()` bypasses cooldown
Every `agents.send(evaluator, ...)` call triggers `triggerNow('heartbeat-evaluator')`. The cooldown is interval×0.75 = 90min, but:
- Bursts of 20-second gaps suggest cooldown isn't working
- The `evaluate-sessions` JS handler may be sending results that trigger heartbeats

## Evidence

```
21:05:17 gap: 19s  ← rapid fire burst
21:05:45 gap: 27s
21:06:06 gap: 21s
21:07:18 gap: 72s
21:07:40 gap: 22s
21:13:30 gap: 350s
21:14:55 gap: 85s
21:17:56 gap: 182s
21:20:25 gap: 149s
21:21:26 gap: 61s
21:22:46 gap: 80s
21:23:07 gap: 21s
21:23:28 gap: 21s
21:23:48 gap: 20s
```

## Impact

- 39 wasted sessions × ~$0.02-0.30 startup cost = $0.80-12/day for evaluator alone
- Each session consumes LLM API tokens for the context window (~4K+ tokens for heartbeat injection)
- Evaluator's actual work (calibration, criteria) needs at most 1 session/2h

## Recommended Fix

1. **Debug cooldown**: Check `getLastFireTime` in cron.ts for evaluator — the cooldown calculation may have a bug (e.g., using wrong timestamp column, or the DB query failing silently)
2. **Add max-frequency cap**: Hard cap on any heartbeat firing more than 2x per interval
3. **Evaluator-specific**: Evaluator heartbeat is for calibration only; the JS handler does all actual evaluation. Consider increasing evaluator heartbeat to 4h or even 8h.
