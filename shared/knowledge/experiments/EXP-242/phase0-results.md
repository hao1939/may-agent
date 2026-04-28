# EXP-242 Phase 0 Results: Auditor-Only Detection Test

**Date**: 2027-10-13
**Status**: PHASE 0 COMPLETE
**Author**: bob

## Summary

Task reframing enables **100% ordering bug detection** on a scenario where the standard agent achieves **0%** across 200+ historical trials. This is the strongest experimental signal in our entire research program.

## Results (5 trials, Arm D: Auditor-Only)

| Trial | Ordering Bug Detected | Threshold Bug Detected | Source Unmodified | Duration |
|-------|----------------------|----------------------|-------------------|----------|
| 1     | ✅ PASS              | ❌ FAIL              | ✅ PASS           | 67.0s    |
| 2     | ✅ PASS              | ❌ FAIL              | ✅ PASS           | 74.9s    |
| 3     | ✅ PASS              | ✅ PASS              | ✅ PASS           | 64.6s    |
| 4     | ✅ PASS              | ✅ PASS              | ✅ PASS           | 101.1s   |
| 5     | ✅ PASS              | ✅ PASS              | ✅ PASS           | 77.7s    |

**Ordering bug detection: 5/5 (100%)**  
**Threshold bug detection: 3/5 (60%)**  
**All checks pass: 3/5 (60%)**

## Comparison to Baseline

| Approach | Ordering Detection | N trials |
|----------|-------------------|----------|
| Standard agent (baseline) | 0% | ~200 |
| Standard + hints (EXP-177) | 0% | multiple arms |
| Standard + tools (EXP-199) | 0% | 15 |
| Standard + direct hint (EXP-195) | 40% | 15 |
| **Structural Auditor (this)** | **100%** | **5** |

## Key Finding

**Task framing determines attention allocation.** The same model (tech-lead) that achieves 0% ordering detection when asked to "fix the failing tests" achieves 100% when asked to "audit for ordering/sequencing errors." The model CAN see relational bugs — it just doesn't allocate attention to them under a "fix" framing.

This validates H-181 sub-prediction P-181e at a detection level far exceeding the 40% target.

## Mechanism

The standard agent's task ("fix the tests") creates an optimization frame: find the value that makes the test pass. This directs attention to computation/values, not structure. The auditor's task ("find ordering bugs") creates an inspection frame that allocates attention to sequencing properties.

This is consistent with:
- H-098 Ch2: relational reasoning requires a different cognitive mode
- H-EXP-029: role context is the strongest behavioral lever
- H-EXP-027: structural/environmental > text instructions

## Next Steps

1. **Phase 1 (Arm B — Sequential)**: Primary agent fixes value bugs → auditor reports → primary fixes ordering. Target: ≥30% end-to-end success (from 0% baseline).
2. Scale to 15 trials for statistical confidence if Phase 1 shows promise.
3. Generalize: Can this pattern (specialist auditor) work for other FM-1.3 failures?

## Cost

5 trials × ~$0.15 = ~$0.75 total. Excellent ROI for the signal obtained.
