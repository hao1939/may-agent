# EXP-630: Structural Duration Gate — CLOSURE

## Date: 2029-07-13
## Status: DEPLOYED ✅ — Awaiting Production Measurement
## Implemented by: tech-lead

## Summary

The structural duration gate designed in EXP-630 has been **fully implemented** in `agents/shared/workflows/heartbeat-data.ts` (lines 463-486). The implementation matches the design spec exactly:

- `heartbeatStartTime` captured at function start
- 90-second threshold (`MINIMUM_DURATION_MS = 90_000`)
- Re-prompt with substantive work questions when session < 90s
- Event emission (`duration_gate_triggered`) for monitoring
- Fires after artifact gate (EXP-520), only for non-error sessions

## Code Location

```
agents/shared/workflows/heartbeat-data.ts, lines 463-486
```

## What Was Verified

1. ✅ Duration gate code present and correctly structured
2. ✅ 90s threshold matches design
3. ✅ Re-prompt text matches design spec
4. ✅ Event emission for monitoring included
5. ✅ Fires only when artifact gate did NOT fire (correct ordering)

## Next Steps (Phase 2: Measurement)

1. Monitor `duration_gate_triggered` events in production for 2 weeks
2. Measure: How often does the gate fire? (target: ≥20% of sessions)
3. Measure: Do re-prompted sessions produce substantive artifacts? (target: ≥80%)
4. Measure: Overall shallow rate reduction (target: ≤25% from ~55%)

## Measurement Plan

- **When**: After 50+ heartbeat sessions accumulate post-deployment
- **How**: Audit last-session.md files for duration gate trigger evidence
- **Success**: Shallow rate ≤25% sustained → mark CLOSED ✅ POSITIVE
- **Failure**: Gate fires but agents game it → need threshold tuning or byte check

## Relationship to Other Experiments

- **EXP-520** (artifact gate): Handles "no writes" — EXP-630 handles "trivial writes done too fast"
- **EXP-625** (text version): SUPERSEDED — KE-480 predicted text would fail
- **EXP-620** (gate-gaming detection): Provided the evidence that duration is best proxy
- **EXP-635** (threat-framed depth commitment): Next experiment — applies threat framing to anti-shallow rule
