# EXP-245 Results: Sequential Auditor Generalization — Judgment Tasks

**Date**: 2027-11-18
**Status**: COMPLETED — H-245-null SUPPORTED

## Summary

The inline diagnostic auditor instruction **did not generalize** to the misleading-test-fix scenario. 0/10 treatment trials passed the behavioral checks (test-assertion-fixed, applyDiscount-not-modified), identical to the 0/5 baseline.

## Results

### Arm A — Baseline (N=5)
| Trial | test-assertion-fixed | applyDiscount-not-modified | Total passed |
|-------|---------------------|---------------------------|-------------|
| 1 | ❌ | ❌ | 1/8 |
| 2 | ❌ | ❌ | 1/8 |
| 3 | ❌ | ❌ | 1/8 |
| 4 | ❌ | ❌ | 0/8 |
| 5 | ❌ | ❌ | 0/8 |

### Arm B — Diagnostic Auditor Instruction (N=10)
| Trial | test-assertion-fixed | applyDiscount-not-modified | Total passed |
|-------|---------------------|---------------------------|-------------|
| 1 | ❌ | ❌ | 1/8 |
| 2 | ❌ | ❌ | 1/8 |
| 3 | ❌ | ❌ | 1/8 |
| 4 | ❌ | ❌ | 1/8 |
| 5 | ❌ | ❌ | 1/8 |
| 6 | ❌ | ❌ | 0/8 |
| 7 | ❌ | ❌ | 1/8 |
| 8 | ❌ | ❌ | 1/8 |
| 9 | ❌ | ❌ | 1/8 |
| 10 | ❌ | ❌ | 1/8 |

### Statistical Analysis
- Behavioral check pass rate: Baseline 0/5 (0%), Treatment 0/10 (0%)
- No difference. Fisher's exact p = 1.0
- **H-245a FALSIFIED**: Diagnostic instruction did not raise behavioral checks above 0%
- **H-245-null SUPPORTED**: The inline auditor pattern does not generalize to judgment tasks

## Interpretation

1. **The instruction was ignored or insufficient.** The agent still corrupts applyDiscount to match the wrong test assertion despite explicit "classify before fixing" instructions. This suggests the failure mode is deeper than attention allocation — it may be a reasoning limitation where the agent cannot distinguish code bugs from test bugs even when told to try.

2. **EXP-242 vs EXP-245 divergence.** EXP-242 worked (44% vs 0%, p=0.015) because the auditor framing for ordering bugs was structurally simpler — checking pipeline order is a mechanical task. Classifying "is this code correct or is this test wrong" requires mathematical reasoning (computing 33.97 × 0.80 = 27.176 → rounds to 27.18, not 27.17) that the agent struggles with inline.

3. **Implication for multi-agent approach.** The next test should use a genuinely separate agent (not inline instruction) — possibly one with a calculator tool or explicit arithmetic chain. The mechanism in EXP-242 may have been agent separation itself, not just task framing.

## Next Steps

- **EXP-245b**: Test with a truly separate auditor agent (two-phase: auditor runs first, report injected into primary)
- **EXP-245c**: Test if giving the agent a calculator/arithmetic verification step helps
- **Alternative**: This scenario may test an inherent LLM arithmetic limitation rather than an attention/framing gap

## Hypothesis Updates

- **H-245a**: FALSIFIED — inline diagnostic instruction ≠ behavioral improvement on judgment tasks
- **H-245-null**: SUPPORTED — auditor pattern does not generalize via inline instruction to judgment tasks
- **H-181** (Relational Bug Blindness): Still open — the failure may be arithmetic, not relational
