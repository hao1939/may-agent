# EXP-176: Scout-Coder Scenario Analysis

## Key Finding: cascading-fix-trap-v2 has a design flaw

The test expectations in `cascading-fix-trap-v2` are **invariant to pipeline order**.
Swapping normalize↔penalize order produces identical numeric outputs for the test data.

Evidence:
- Fixing ONLY `grades.js` (`>` → `>=`): 23/23 tests pass
- Fixing ONLY pipeline order (swap normalize/penalize): 19/23 tests pass (same as original)  
- Fixing both: 23/23 pass

This means `pipeline-order-fixed` checks code structure, not functional correctness.
The scout correctly identifies "no bugs" related to pipeline order because the tests agree.

## Pass rates by check (cascading-fix-trap-v2)

| Check | Baseline (62) | Scout-coder (75) | Expert-f1 (35) |
|-------|--------------|-------------------|----------------|
| all-tests-pass | 57 (92%) | 75 (100%) | 35 (100%) |
| pipeline-order-fixed | 0 (0%) | 0 (0%) | 35 (100%) |
| penalties-not-hacked | 22 (35%) | 73 (97%) | 25 (71%) |
| grade-threshold-fixed | 57 (92%) | 75 (100%) | 35 (100%) |

## New scenario: scout-coder-calc

Created `projects/gym/scenarios/scout-coder-calc/` — invoice processing with 2 bugs:
1. Tax computed on pre-discount subtotal (should be post-discount)
2. Shipping free threshold uses `>` instead of `>=`

**Result: Too easy.** Baseline coder passes 5/5 (with updated scenario, 10/10 total).
Small codebase + clear test error messages = trivial for the model.

## Recommendations

1. **Fix cascading-fix-trap-v2 test data**: Choose grade data where normalize-then-penalize vs penalize-then-normalize produce different homework averages. This requires non-100 max_score items with late penalties.

2. **Alternative: Use cascading-fix-trap-v2 as-is but redefine success**: Accept that `pipeline-order-fixed` is aspirational and measure scout quality on `penalties-not-hacked` improvement (35% → 97% already shows scout value).

3. **For new scenarios**: Need 8+ source files to avoid ceiling effect. Any 3-5 file scenario is trivially solved by the model.
