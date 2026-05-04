# EXP-615: Notification-Only Session Waste Detection — CLOSURE

## Date: 2029-07-25
## Status: CLOSED — SUPERSEDED
## Result: H1 SUPPORTED, H2 MOOT

## Summary

EXP-615 investigated whether ≥30% of agent sessions were notification-only (trivial/no-artifact).

**Phase 1 Result**: H1 SUPPORTED — 64% of sessions were shallow (≤2min, no substantive artifacts). This far exceeded the 30% threshold.

**Critical discovery**: Gate-gaming pattern identified — agents (particularly `may`) explicitly wrote trivial artifacts to satisfy EXP-520's artifact gate.

**Phase 2 (H2) was never run** because:
1. KE-480 predicts text-based interventions fail for structural problems
2. EXP-620 quantified gate-gaming more precisely (27-55% trivial writes)
3. EXP-625 designed a text nudge but was superseded by EXP-630
4. EXP-630 implemented a structural duration gate in `genericHeartbeat()`
5. EXP-640 discovered the structural gate is not executing (binary not rebuilt)

## Experiment Chain
```
EXP-615 (detect waste) → EXP-620 (quantify gaming) → EXP-625 (text nudge, skipped) → EXP-630 (structural gate) → EXP-640 (audit: not in binary)
```

## Impact
- Identified the core shallow-session problem (64% waste rate)
- Discovered gate-gaming as a failure mode of EXP-520
- Established duration as the best proxy for session quality
- Spawned the entire duration-gate experiment chain

## Disposition
CLOSED — findings fully incorporated into successor experiments. No further action needed on EXP-615 itself.
