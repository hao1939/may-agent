# EXP-290 Results: Bob Anti-Shallow Enforcement

**Date**: 2026-08-01 (designed) → 2026-08-01 (measured)
**Status**: POSITIVE ✅
**Agent**: bob

## Summary

Bob's quality dramatically improved after anti-shallow enforcement was confirmed active in both `context.md` and `heartbeat.md`. The shallow_session pattern (quality=0.20) has been eliminated for 31+ hours.

## Results

| Metric | Baseline | Post-Treatment | Delta |
|--------|----------|----------------|-------|
| Avg quality | 0.349 (n=152) | 0.671 (n=48) | **+0.322** |
| Shallow rate (q≤0.20) | 69% (105/152) | 0% (0/48) | **-69pp** |
| Min quality | 0.20 | 0.35 | +0.15 |

## Timeline

- Last shallow session: 31.5 hours ago (createdAt ~1777449687891)
- Post-treatment window: 48 sessions, all ≥0.35
- Treatment: anti-shallow rule in `agents/bob/context.md` (6 mentions of "tool calls") + `agents/bob/heartbeat.md`

## Interpretation

The anti-shallow rule, when loaded in ALL session types (not just heartbeats), effectively prevents trivial 2-message sessions. Bob went from worst agent (0.349) to above system target (0.671 > 0.50).

This confirms the EXP-290 hypothesis: the rule was only being loaded in heartbeat sessions previously. Once deployed to context.md (which loads in all sessions including sub-agent calls), shallow sessions vanished.

## Decision

**POSITIVE** — Exceeds 0.50 target. Anti-shallow rule confirmed effective when deployed universally.

### Applicability

Coach (0.359) and optimizer (0.437) have similar patterns. Consider deploying identical rule to their context.md files if not already present.

## Next Actions

1. Close EXP-290 as POSITIVE
2. Check if coach/optimizer also need context.md anti-shallow rule (coach already has it in heartbeat.md)
3. Update bob quality baseline to 0.671
