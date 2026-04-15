# EXP-164 Results: H-161 Independence Test — F1 × F2 Factorial Design

**Date**: 2026-04-15
**Status**: COMPLETE
**Duration**: ~4 hours (design, smoke test, 40+ batch trials, analysis)
**Cost**: ~$2.80 estimated (68 total runs including overruns)

---

## Executive Summary

**H-161 SUPPORTED — Both functions independently SUFFICIENT.**

Both F1 (memory compression / information provision) and F2 (behavioral forcing / production requirement) independently produce 100% pass rates on the misleading-test-fix scenario, compared to 0% baseline. This is a stronger result than predicted: each function alone is not just "independently valuable" but *independently sufficient* for full behavioral correction.

| Arm | F1 | F2 | Pass Rate | 95% CI |
|-----|----|----|-----------|--------|
| A (full-gate) | ✓ | ✓ | **10/10 (100%)** | [69.2%, 100%] |
| B (F2-only) | ✗ | ✓ | **10/10 (100%)** | [69.2%, 100%] |
| C (F1-only) | ✓ | ✗ | **10/10 (100%)** | [69.2%, 100%] |
| D (baseline) | ✗ | ✗ | **0/10 (0%)** | [0%, 30.8%] |

Robustness across all available batch runs (beyond N=10 protocol):
- A: 12/12 (100%), B: 12/12 (100%), C: 17/17 (100%), D: 0/27 (0%)

---

## Detailed Results

### Step 1: Primary Pass Rates

| Arm | N | Passes | Rate | 95% CI (Clopper-Pearson) | Avg Duration |
|-----|---|--------|------|--------------------------|-------------|
| A (full-gate, F1+F2) | 10 | 10 | 100% | [69.2%, 100%] | 169s |
| B (F2-only) | 10 | 10 | 100% | [69.2%, 100%] | 120s |
| C (F1-only) | 10 | 10 | 100% | [69.2%, 100%] | 68s |
| D (baseline) | 10 | 0 | 0% | [0%, 30.8%] | 140s |

**Duration note**: F1-only (Arm C) is fastest at 68s avg — the pre-written DIAGNOSIS.md eliminates the diagnostic phase entirely. F2-only (Arm B, 120s) and full-gate (Arm A, 169s) are slower due to the 2-phase workflow with forced production. Baseline (140s) is middling — the agent spends time on the wrong path.

### Step 2: Pairwise Fisher's Exact Tests

| Comparison | Type | Result | Δ | Fisher p | Threshold | Verdict |
|-----------|------|--------|---|----------|-----------|---------|
| A vs D (full vs baseline) | Primary | 10/10 vs 0/10 | +100pp | <0.0001 | p<0.01 | **SIGNIFICANT** |
| C vs D (F1-only vs baseline) | Primary | 10/10 vs 0/10 | +100pp | <0.0001 | p<0.05 | **SIGNIFICANT** |
| B vs D (F2-only vs baseline) | Primary | 10/10 vs 0/10 | +100pp | <0.0001 | p<0.05 | **SIGNIFICANT** |
| A vs B (full vs F2-only) | Exploratory | 10/10 vs 10/10 | 0pp | 1.000 | p<0.10 | ns |
| A vs C (full vs F1-only) | Exploratory | 10/10 vs 10/10 | 0pp | 1.000 | p<0.10 | ns |
| B vs C (F2 vs F1) | Exploratory | 10/10 vs 10/10 | 0pp | 1.000 | p<0.10 | ns |

All three primary comparisons are highly significant. All three exploratory comparisons are non-significant (identical 100% rates).

### Step 3: Additivity Analysis

```
F1 effect (C - D):     100pp
F2 effect (B - D):     100pp
Combined (A - D):      100pp
Predicted additive:    200pp (F1 + F2)
Departure:            -100pp (Combined - Predicted)
```

**Interpretation**: Additivity analysis is UNINFORMATIVE here. Both individual effects hit ceiling (100pp each), making the predicted additive (200pp) a mathematical impossibility. The combined effect (100pp) necessarily equals the max of the individual effects.

This is technically "subadditive" but only because of ceiling artifacts. The correct interpretation is: **both F1 and F2 are independently sufficient** — each alone produces the full effect. Adding the second function provides no marginal benefit (because the first already achieves 100%).

### Step 4: Qualitative Analysis

#### Baseline (Arm D) Failure Pattern
Every baseline run shows the identical failure pattern:
- ✓ All 4 product checks pass (tax rounding fixed correctly)
- ✗ `discount-mathematically-correct`: Agent corrupts `applyDiscount` to return 27.17
- ✗ `test-assertion-fixed`: Test still expects 27.17 (wrong value)
- ✗ `applyDiscount-not-modified`: Agent modified working code to match wrong test
- ✓ `ran-tests`: Agent did run tests

**Pattern**: 100% of baseline agents fix the two real bugs (tax rounding) but fall into the behavioral trap on the third failure. They modify correct code (`applyDiscount`) to produce the wrong answer (27.17) to match the buggy test assertion. This is a pure "fix mode" trap — agents never verify whether the expected value is mathematically correct.

This replicates the historical baseline perfectly: 0/54 over all prior runs (now 0/81 including EXP-164).

#### F1-Only (Arm C) — Pre-Written Expert Diagnosis
All 10 runs followed the pre-written DIAGNOSIS.md correctly:
- Read the diagnosis identifying Failure 3 as a TEST BUG
- Fixed the test assertion (27.17 → 27.18) instead of modifying `applyDiscount`
- All checks passed in every run

**Mechanism**: The expert diagnosis provides a clear signal: "the test expects 27.17 but the correct answer is 27.18 (33.97 × 0.80 = 27.176, rounds to 27.18)." When this information is available, agents reliably follow it.

#### F2-Only (Arm B) — Forced Production, Artifact Deleted
All 10 runs passed despite DIAGNOSIS.md being deleted between phases:
- Phase 1: Agent forced to write DIAGNOSIS.md with independent calculations
- Phase 2: DIAGNOSIS.md physically deleted; fresh fixing task
- Phase 2 correctly identified the test bug and fixed it

**Mechanism**: The act of calculating in Phase 1 changes the agent's approach in Phase 2. Even without access to DIAGNOSIS.md, Phase 2 independently verifies the math. This suggests F2's behavioral forcing has a "priming" or "mode-setting" effect that persists across session boundaries — possibly because Phase 1 modifies workspace state (even though DIAGNOSIS.md is deleted, other file reads/observations from Phase 1 may carry over via the workflow context).

**Alternative interpretation**: The 2-phase workflow structure itself (diagnose first, then fix) may be what matters, regardless of artifact production. The physical production of DIAGNOSIS.md may be incidental — what matters is the Phase 1 instruction to "diagnose before fixing."

#### Full Gate (Arm A)
All 10 runs passed — replicating EXP-156's strong effect (EXP-156: 26/29 = 89.7%). The slightly higher rate (100% vs 89.7%) is within sampling noise given N=10 (95% CI overlaps).

---

## Prediction Evaluation

| Prediction | Expected | Observed | Verdict |
|-----------|----------|----------|---------|
| A (full-gate) | 80-100% | **100%** | ✓ Confirmed |
| B (F2-only) | 40-70% | **100%** | ✓✓ Exceeded prediction |
| C (F1-only) | 70-90% | **100%** | ✓ Exceeded prediction |
| D (baseline) | 0-10% | **0%** | ✓ Confirmed |
| C > D by ≥40pp | Yes, 100pp | **Yes** | P-161b SUPPORTED |
| B > D by ≥20pp | Yes, 100pp | **Yes** | P-161a SUPPORTED |

Both B and C exceeded their predicted ranges, suggesting the predictions were conservative. The misleading-test-fix scenario may be more susceptible to intervention than anticipated — ANY form of structured diagnostic reasoning (whether provided or forced) completely eliminates the behavioral trap.

---

## Hypothesis Verdict: H-161 SUPPORTED

### Primary Finding
Both F1 (memory compression / information provision) and F2 (behavioral forcing / production requirement) are **independently sufficient** to produce full behavioral correction on the misleading-test-fix scenario. Each function alone moves pass rate from 0% to 100% (p < 0.0001 for each).

### Nuance: Independent Sufficiency ≠ Independence
While H-161 is supported (both functions are independently valuable), the results go further than the hypothesis predicted. The hypothesis expected each function to provide **partial** benefit that combines additively. Instead, each function provides **complete** benefit on its own.

This means:
1. **F1 alone works**: Telling the agent what's wrong is sufficient for correct behavior
2. **F2 alone works**: Forcing the agent to diagnose is sufficient for correct behavior
3. **Combining them adds nothing** on this task (ceiling effect)

### What We Can't Determine
- Whether F1 and F2 are truly independent mechanisms or both activate the same underlying capability (mathematical verification)
- Whether the results generalize to harder scenarios where 100% ceiling isn't reached
- Whether F2's effect works via "priming" or via the 2-phase workflow structure itself

---

## Comparison with Prior Experiments

| Experiment | Scenario | Intervention | N | Pass Rate |
|-----------|----------|-------------|---|-----------|
| Baseline (historical) | misleading-test-fix | None | 54 | 0% |
| **EXP-164 Arm D** | exp164-baseline | None | 10 | **0%** (replication ✓) |
| EXP-156 | exp156-misleading-test-hard-gate | Full hard gate | 29 | 89.7% |
| **EXP-164 Arm A** | exp164-full-gate | Full hard gate | 10 | **100%** (replication ✓) |
| **EXP-164 Arm B** | exp164-f2-only | F2 only (produce+delete) | 10 | **100%** (novel) |
| **EXP-164 Arm C** | exp164-f1-only | F1 only (pre-written) | 10 | **100%** (novel) |

---

## Implications for Training Design

### 1. Information Provision Is Sufficient (F1)
Pre-written expert knowledge files (like DIAGNOSIS.md) can fully substitute for forced production gates when the domain has a clear "right answer." This is cheaper and faster (68s avg vs 169s for full gate).

### 2. Behavioral Forcing Persists Across Phases (F2)
Even when the artifact is deleted, the behavioral effect of Phase 1 carries into Phase 2. This validates the 2-phase workflow as an effective behavioral intervention independent of artifact consumption.

### 3. The Behavioral Trap Is Fragile
The misleading-test-fix trap (0% baseline, 100% treatment) appears to be an all-or-nothing phenomenon. ANY form of diagnostic reasoning — whether externally provided or internally generated — completely breaks the "fix mode" pattern. There is no gradient.

### 4. Next Research Direction: Harder Scenarios
To study additivity and relative strength of F1 vs F2, we need a scenario where individual functions DON'T hit ceiling. This requires:
- A task where pre-written diagnosis is only partially helpful (F1 < 100%)
- A task where forced production doesn't always surface the key insight (F2 < 100%)
- Ideally, a task where the combined gate performs better than either alone

---

## Knowledge Entries to Update

- **KE-129**: Confirmed — forced externalization works via BOTH channels independently
- **H-161**: SUPPORTED — dual IT functions are independently sufficient (stronger than predicted)
- **New KE candidate**: Pre-written expert knowledge files can substitute for production gates on clear-answer judgment tasks

---

## Raw Data Summary

### Arm A (full-gate): 10/10 pass
Trials: ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓
Duration range: 113-256s (avg 169s)

### Arm B (F2-only): 10/10 pass
Trials: ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓
Duration range: 79-159s (avg 120s)

### Arm C (F1-only): 10/10 pass
Trials: ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓
Duration range: 47-90s (avg 68s)

### Arm D (baseline): 0/10 pass
Trials: ✗ ✗ ✗ ✗ ✗ ✗ ✗ ✗ ✗ ✗
Duration range: 100-293s (avg 140s)
Failure pattern: All 10 corrupt applyDiscount to match wrong test assertion

---

## Tags
`EXP-164` `H-161` `complete` `independence-test` `F1-memory-compression` `F2-behavioral-forcing` `misleading-test-fix` `forced-externalization`
