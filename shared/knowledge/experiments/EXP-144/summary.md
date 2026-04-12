# EXP-144 Summary: Format-Decoupled Gates

**Status**: Phase 1 COMPLETE  
**Hypothesis**: H-103 (Format tax limits gate scalability)  
**Design**: 2×2 (structured vs decoupled gates × 2 scenarios), N=50  
**Date**: 2026-04-12  

## Key Results

1. **Product accuracy identical**: 100% both conditions (ceiling effect)
2. **Process compliance gap**: 52pp — structured 100% vs decoupled 48% (p < 0.001)
   - Entirely driven by hidden-dep scenario: 0/13 decoupled sessions created planning artifacts
3. **Duration paradox**: Decoupled is 16% SLOWER on compound-edit (p < 0.001, d = -1.56)
4. **Externalization gap**: Without format mandate, agent doesn't externalize reasoning at all

## Predictions

| Prediction | Result |
|------------|--------|
| P-144a: Accuracy preserved (within 5pp) | ✅ CONFIRMED (ceiling effect) |
| P-144b: FM reduction ≥20% | ⚠️ CANNOT EVALUATE (no failures) |
| P-144c: Rightward shift at higher gate count | ⚠️ NOT TESTABLE (Phase 1 only) |
| P-144d: 15-30% token savings | ❌ REFUTED (+16% duration on compound-edit) |

## Insight

Structured gate formats serve as: (1) auditability infrastructure, (2) task decomposition aids, (3) compliance mechanisms. The "format tax" from DD-747 may be a "toll" that buys faster execution and auditable reasoning.

## Phase 2 Decision

**NOT RECOMMENDED** until harder scenarios (< 90% baseline) and FM detection are available.

## Links
- [Full results](results.md)
- [Pilot results](pilot-results.md)
- [Design](design.md)
