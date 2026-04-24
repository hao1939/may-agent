# EXP-178: Results

**Status**: IN PROGRESS (G1 complete, G2-G4 pending)
**Date started**: 2026-07-30
**Agent**: tech-lead (not `coder` — coder agent doesn't exist, design doc error)

## Summary

G1 baseline complete. **Major finding**: sql-injection baseline shifted from expected 33% to **80%** (12/15). Cascading-fix-trap-v2 confirms 0/15 (0%), consistent with all prior experiments.

The sql-injection baseline shift means the experiment's discriminating power on that scenario is reduced — G3/G4 can't show the predicted ≥20pp improvement if baseline is already 80%. The cascading scenario remains the critical discriminating cell.

## Data

### G1: No-guard control (baseline)

| Scenario | N | Pass | Rate | 95% Wilson CI | Expected |
|----------|---|------|------|---------------|----------|
| sql-injection-in-query-builder | 15 | 12 | 80.0% | [54.8%, 93.0%] | 30-45% |
| cascading-fix-trap-v2 | 15 | 0 | 0.0% | [0%, 20.4%] | 0-10% |

### G2: Production-mode uniform
*Pending*

### G3: Passive-injection uniform
*Pending*

### G4: Adaptive (proposal)
*Pending*

## Analysis

### Baseline Shift on sql-injection

The 80% baseline (vs 33% historical) is likely due to:
1. **Model upgrade**: tech-lead agent may use a newer model than when gap-fill baselines were established
2. **Agent identity**: using `tech-lead` not `coder` (coder doesn't exist as a registered agent)
3. **Context/skills**: tech-lead may have security-relevant context that helps recognition

This dramatically changes pre-registered predictions:
- G4 vs G1 on sql-injection: predicted ≥20pp lift unlikely given 80% ceiling
- G4 vs G3 on sql-injection: equivalence claim easier to confirm (both near ceiling)
- **Cascading scenario becomes sole discriminating axis** for the adaptive routing question

### Implications for remaining arms

Should still run G2-G4 on both scenarios because:
1. Cascading-fix-trap-v2 remains at 0% floor — the G3/G4 lift question is still live
2. The sql-injection ceiling effect is itself informative — if G2 (production-mode) degrades from 80%, that's evidence of production-displacement even on medium tasks
3. Pre-registered, so we run as designed

## Conclusion

*Pending G2-G4 data*

## Followups

- Run G2, G3, G4 arms (90 more runs, ~$7-9)
- Update H-165 scorecard with baseline shift finding
- Consider: if sql-injection baseline is 80%, it may no longer be a "medium" scenario — reclassify?
- Write KE on baseline drift: model upgrades invalidate historical baselines
