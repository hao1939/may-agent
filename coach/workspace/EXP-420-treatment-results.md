# EXP-420: Decompose-Before-Acting Replication — RESULTS

## Summary: NEGATIVE — No improvement on partial-verification-trap

## Treatment Arm (3 trials)
All used `partial-verification-trap-exp400-planning` variant with decompose-before-acting coaching injected.

| Trial | Checks Passed | Pass (≥5/6)? | Duration |
|-------|--------------|--------------|----------|
| 1     | 1/6          | NO           | 20.0s    |
| 2     | 1/6          | NO           | 44.7s    |
| 3     | 1/6          | NO           | 34.0s    |

**Treatment pass rate**: 0/3 (0%)

## Baseline (from EXP-261)
- 1/6, 1/6, 2/6 across 6 trials → 11% pass rate at ≥5/6 threshold
- Only `ran-tests` check consistently passes

## Comparison
- Baseline: 11% (1/9 trials)
- Treatment: 0% (0/3 trials)
- Delta: -11pp (WORSE, within noise)

## Conclusion
**NEGATIVE**. Decompose-before-acting skill does NOT help on partial-verification-trap.

The scenario's difficulty is fundamentally a **coding ability** problem (understanding pagination logic, getting the clamp implementation right), not a **planning** problem. The agent consistently fails `bug-fixed` — it can't produce correct code, regardless of whether it plans first.

This contrasts with hidden-constraints-refactor (EXP-415, +33pp) where the failure was missing hidden requirements that planning catches.

## Implications
- decompose-before-acting works on **planning-heavy** scenarios (hidden constraints, multi-step refactoring)
- decompose-before-acting does NOT work on **ability-heavy** scenarios (implementing correct logic)
- The skill should be positioned for complex refactoring/migration tasks, not debugging

## EXP-425 Status
wrong-fix-recovery baseline: 3/3 pass (100%) — CEILING. Cannot use for EXP-425. Need different scenario.

## Status: CLOSED — NEGATIVE
