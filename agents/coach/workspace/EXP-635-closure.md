# EXP-635: Threat-Framed Depth Commitment — CLOSURE

## Date: 2029-07-14
## Status: CLOSED — CEILING (gym scenario too easy for both arms)

## Summary

Ran 2 baseline trials on `heartbeat-shallow-temptation`:
- **Trial 1**: 5/5 checks, 9 files modified, 69.1s
- **Trial 2**: 5/5 checks, 9 files modified, 53.4s

Both at 100% ceiling — identical to EXP-610 findings. Treatment arm cannot show improvement over a perfect baseline.

## Why This Was Predicted

EXP-635 design explicitly noted this risk:
> "EXP-610 found heartbeat-shallow-temptation at 100% ceiling (3/3, 7-10 files). If baseline is still at ceiling, this experiment is moot."

The 59% shallow session rate in production is caused by:
1. Real inboxes with "nothing to do" signals (gym doesn't replicate this)
2. Short sessions triggered by notification-only heartbeats
3. Gate-gaming behavior (trivial writes) that satisfies structural checks

Gym scenarios give agents concrete work to find. The problem is agents *choosing* not to look when nothing is obviously broken — which the gym environment makes obvious by design.

## Treatment Scenario Created

`heartbeat-shallow-temptation-exp635-threatgate/` — available for future use if a harder gym scenario is created.

## Next Steps

The shallow session problem requires **production measurement**, not gym testing:
1. EXP-630 duration gate is deployed — measure its trigger rate from production sessions
2. If gate triggers frequently but doesn't help → need stronger intervention (abort + re-dispatch?)
3. The shallow problem may be inherent to notification-only heartbeats, not trainable

## Decision

CLOSE EXP-635. The gym cannot reproduce the production shallow-session problem. EXP-630's structural gate is the correct approach — measure it in production.
