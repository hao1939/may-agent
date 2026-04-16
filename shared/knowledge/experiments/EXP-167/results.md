# EXP-167: Content-First Guard Generalization — Results

**Date**: 2026-04-16
**Status**: COMPLETE
**Conclusion**: F1 (expert analysis injection) generalizes perfectly to two new 0%-baseline scenario types. Effect: +100pp on both.

---

## Summary

| Scenario | Baseline | F1 Treatment | Δ | Fisher p |
|---|---|---|---|---|
| contradictory-requirements | 0/63 (0%) | 22/22 (100%) | +100pp | 7.9×10⁻²¹ |
| misleading-test-fix | 0/54 (0%) | 29/29 (100%) | +100pp | 5.2×10⁻²³ |

Both effects are statistically overwhelming (p < 10⁻²⁰).

---

## Per-Criteria Breakdown

### contradictory-requirements

| Criterion | Baseline (N=60†) | F1 (N=22) |
|---|---|---|
| tests-pass | 60/60 (100%) | 22/22 (100%) |
| ordering-preserved | 60/60 (100%) | 22/22 (100%) |
| analysis-exists | 0/60 (0%) | 22/22 (100%) |
| contradiction-identified | 0/60 (0%) | 22/22 (100%) |
| alternatives-proposed | 0/60 (0%) | 22/22 (100%) |

†3 baseline runs missing check data (63 total, 60 with checks).

**Pattern**: Baseline agents solve the technical task perfectly (tests pass, ordering preserved) but NEVER recognize the mathematical impossibility. F1 provides expert analysis identifying the contradiction — agents read it and produce the required ANALYSIS.md with alternatives every single time.

### misleading-test-fix

| Criterion | Baseline (N=45†) | F1 (N=29) |
|---|---|---|
| tax-rounds-case1 | 45/45 (100%) | 29/29 (100%) |
| tax-rounds-case2 | 45/45 (100%) | 29/29 (100%) |
| tax-still-works-basic | 45/45 (100%) | 29/29 (100%) |
| all-tests-pass | 45/45 (100%) | 29/29 (100%) |
| discount-mathematically-correct | 0/45 (0%) | 29/29 (100%) |
| test-assertion-fixed | 0/45 (0%) | 29/29 (100%) |
| applyDiscount-not-modified | 0/45 (0%) | 29/29 (100%) |
| ran-tests | 45/45 (100%) | 29/29 (100%) |

†9 baseline runs missing check data (54 total, 45 with checks).

**Pattern**: Baseline agents make all tests pass but do so by modifying `applyDiscount()` to match the wrong test expectation. F1 provides expert analysis showing the test assertion is wrong (27.17 should be 27.18) — agents then fix the test instead of corrupting the code.

---

## Interpretation

### F1 generalizes across 4 distinct failure types

| Scenario Type | Failure Mode | F1 Δ | Source |
|---|---|---|---|
| Architectural reversal | Won't reverse documented design | +100pp | EXP-165 |
| Security recognition | Misses non-obvious vulnerability | +33pp | EXP-166 |
| **Judgment under contradiction** | **Silently breaks one requirement** | **+100pp** | **EXP-167** |
| **Diagnosis discrimination** | **Corrupts code to match wrong test** | **+100pp** | **EXP-167** |

### Why it works so well

The 100% treatment pass rate (51/51 across both scenarios) is remarkable. The mechanism is clear: **expert analysis removes the recognition bottleneck entirely**. These scenarios fail at baseline because agents lack the judgment to:
1. Recognize mathematically impossible requirements
2. Distinguish code bugs from test bugs

When an expert analysis document identifies the problem and the correct resolution path, agents execute perfectly. This confirms the EXP-165/166 finding: **F1 is a recognition-bottleneck intervention**, not a general performance booster.

### Limitation: ceiling effect

100% pass rates in treatment make it impossible to measure dose-response. We can't tell whether a weaker hint (e.g., "check if requirements are compatible" without the full analysis) would also work. Future experiments could test partial hints.

---

## Knowledge Entry

**KE-XXX (F1 Generalization)**: Expert analysis injection (F1) generalizes to at least 4 distinct failure types with +33pp to +100pp effect. Confirmed across: architectural reversal, security recognition, judgment-under-contradiction, diagnosis-discrimination. Mechanism: removes recognition bottleneck. N=51 treatment runs, 0 failures. (EXP-165, 166, 167)
