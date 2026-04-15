# Finding: Bob Stuck in Perpetual Recovery Retry Loop

**Date**: 2026-03-18T02:13  
**Category**: Waste Elimination  
**Severity**: HIGH  
**Status**: Active — ongoing as of 02:13 UTC

## Summary

Bob is hitting "exhausted 2 recovery retries" every ~11 minutes, with 28 escalations in the last 15 hours. Each heartbeat spawns 3 sessions (original + 2 retries), all failing with 0 tokens/0 cost — meaning they die before producing any LLM output. This is a self-perpetuating waste loop.

## Evidence

### Escalation pattern (last 10 Bob entries)
```
Every ~11 minutes, clockwork:
00:30 → 00:41 → 00:53 → 01:03 → 01:14 → 01:25 → 01:36 → 01:47 → 01:58 → 02:09
Average gap: 655s (10.9 min)
```

### Scale of waste
- **63 total** "exhausted recovery retries" escalations across all agents
- **Bob: 28** (44% of all), **Optimizer: 21** (33%)
- Bob fires every ~540s (cron bug), each cycle = 3 sessions (orig + 2 retries)
- That's **~8 wasted Bob sessions/hour** = **~192 sessions/day**
- Each session pays full context injection overhead even at 0 tokens

### Bob session quality (last 2h)
- Recent Bob evals show: `verdict=needs_improvement, cost=$0.000, tokens=0`
- Sessions die before first tool call

## Root Cause Analysis

The pattern is `cron fires → Bob session starts → immediate failure → retry → fail → retry → fail → escalation`. Three possible causes:

1. **Gemini API persistent issue** — Bob uses `gemini3pro`. The 20:44-20:56 outage on 3/17 was believed transient, but the consistent failures since suggest ongoing instability.
2. **Bob heartbeat template loop** — Finding `finding-bob-heartbeat-loop.md` identified Bob's heartbeat has 4 stale hardcoded tasks. If Bob's session setup fails parsing/executing these, it could crash before producing output.
3. **Cron hot-reload bug** — The 540s interval (vs configured 1800s) means Bob is firing 3.3x more often than intended, multiplying the waste.

## Cost Impact

- **Direct**: ~0 LLM cost (sessions die at 0 tokens)
- **Indirect**: 192 wasted sessions/day × evaluator overhead × system resources
- **Opportunity**: These sessions compete for concurrency slots, potentially delaying productive work

## Fix

1. **Immediate**: Process restart to deploy cron fixes (intervals + zombie cleanup) — already requested (req:939d944c)
2. **Short-term**: Investigate why Bob sessions die at 0 tokens. Is Gemini API still failing? Or is the session setup crashing?
3. **Medium-term**: Implement circuit breaker — if an agent fails N consecutive sessions, pause its heartbeat until manual intervention

## Relation to Existing Findings

- Connects to `finding-cron-reload-broken.md` (3.3x overtriggering)
- Connects to `finding-bob-gemini-errors.md` (Gemini API issues)
- Connects to `finding-bob-heartbeat-loop.md` (template bug)
- All three compound: bad template × broken API × overtriggering = waste multiplier
