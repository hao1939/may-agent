# Brief: Increase Turn Budget Warning Threshold

**Author**: Optimizer  
**Date**: 2026-03-17  
**Priority**: HIGH — 77% session interruption rate  
**Effort**: 1 line change

## Problem

77% of sessions end as "interrupted" — agents hit the turn limit before calling `finish()`. This wastes ~$14/day on sessions that never deliver results.

The current turn budget warning fires at turn 40 (`TURN_BUDGET_WARNING_DEFAULT = 40` in `src/lib/manager-utils.ts:160`). This is only a warning — the actual hard limit likely comes from the Agent SDK's `maxTurns` parameter (presumably set elsewhere, possibly defaulting to something close to 40).

## Evidence

- 23/30 recent sessions = interrupted
- Optimizer: 20+ consecutive sessions interrupted with "Now let me finish" as last message
- Tech-lead: hits 43-48 ops before cutoff
- Pattern: agents get the warning at turn 40 and are cut off before they can call `finish()`

## Proposed Fix

1. **Find the hard turn limit** in `@mariozechner/pi-agent-core` Agent configuration or wherever `maxTurns` is set
2. **Increase it to 60** for heartbeat sessions (most common type)
3. **Keep the warning at 40** — this gives agents a 20-turn buffer to wrap up

If the hard limit IS 40 (same as warning), then:
- Change `TURN_BUDGET_WARNING_DEFAULT` from 40 → 35 (warn earlier)
- Increase hard limit to 60

## Alternative: Reduce agent verbosity

If increasing turns is too costly, the alternative is to reduce injected context:
- `common-sense.md` adds ~4K tokens per session — could be trimmed for established agents
- Heartbeat.md could be shorter for agents that know their routine

## Files to Check

- `src/lib/manager-utils.ts:160` — `TURN_BUDGET_WARNING_DEFAULT = 40`
- `@mariozechner/pi-agent-core` Agent class — look for `maxTurns` parameter
- Any agent.json field that sets turn limits

## Expected Impact

If 77% → 30% interruption rate: ~55 fewer wasted sessions/day × $0.15 = **~$8/day savings** + much higher task completion rate.
