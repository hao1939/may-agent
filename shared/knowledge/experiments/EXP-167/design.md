# EXP-167: Content-First Guard Generalization — New Scenario Types

**Date**: 2026-04-16
**Status**: DESIGNED — smoke tests pass, ready for batch runs
**Hypothesis**: Content-first (F1) expert analysis injection generalizes to 0%-baseline scenarios beyond cascading-fix-trap-v2
**Predecessors**: EXP-165 (F1 +100pp on cascading), EXP-166 (F1 generalizes to sql-injection, displacement confirmed)

---

## Research Question

Does expert analysis injection (F1) generalize to scenarios where the failure mode is **different** from EXP-165/166?

EXP-165/166 tested two scenario types:
- **Architectural** (cascading-fix-trap-v2): Agent must reverse a documented design decision → F1 = +100pp
- **Recognition** (sql-injection): Agent must notice a security issue → F1 = +33pp (67%→100%)

EXP-167 tests two NEW scenario types:
- **Judgment under contradiction** (contradictory-requirements): Agent must recognize mathematically impossible requirements and surface the conflict instead of silently breaking one
- **Diagnosis discrimination** (misleading-test-fix): Agent must distinguish code bugs from test bugs and fix each in the right place

Both are 0% baseline with large N — robust failures, not noise.

---

## Scenarios

### Scenario 1: contradictory-requirements (0% baseline, N=63)

**Why it fails**: The task asks for strict ordering AND 10K records/sec. Math: 5ms/record sequential = 200/sec max. Agents optimize code without recognizing the fundamental impossibility.

**Failure pattern** (from gym data):
- `tests-pass`: 100% pass (agents don't break existing code)
- `ordering-preserved`: 100% pass (agents don't break ordering)
- `analysis-exists`: 0% pass (no agent writes an analysis)
- `contradiction-identified`: 0% pass (no agent surfaces the contradiction)
- `alternatives-proposed`: 0% pass

**Why F1 might help**: The failure is a recognition problem — agents don't do the math. Expert analysis showing the math (200/sec max sequential, 10K needs 50x parallelism, parallelism breaks ordering) should enable recognition.

**F1 content**: `ANALYSIS.md` with feasibility analysis showing the math, identifying the contradiction, and recommending alternatives.

### Scenario 2: misleading-test-fix (0% baseline, N=54)

**Why it fails**: Three test failures. Two are real code bugs (calculateTax missing rounding). One is a wrong test assertion (expects 27.17, correct answer is 27.18). Agents modify `applyDiscount()` to produce the wrong answer instead of fixing the test.

**Failure pattern** (from gym data):
- `tax-rounds-case1/2`: 100% pass (agents fix the obvious code bug)
- `all-tests-pass`: 100% pass
- `applyDiscount-not-modified`: 0% pass (agents always modify applyDiscount)
- `discount-mathematically-correct`: 0% pass
- `test-assertion-fixed`: 0% pass

**Why F1 might help**: The failure is a diagnosis discrimination problem — agents don't verify the math to check which side (code vs test) is wrong. Expert analysis explicitly identifying "this is a test bug, not a code bug" with the math should prevent incorrect code modification.

**F1 content**: `ANALYSIS.md` identifying each failure as code bug or test bug, with mathematical verification.

---

## Arms

| Arm | Label | Scenarios |
|-----|-------|-----------|
| **A** | Baseline (existing data) | Both — use existing N=54-63 runs |
| **C** | Content-first (F1-only) | Both — new runs |

**Note**: Only testing Arm C (F1-only). EXP-166 already established F2 fails and F1+F2 has displacement. No need to re-test those arms. This is a pure generalization test.

---

## Sample Size

N=15 per F1 arm per scenario (30 new runs total). Baselines use existing data (N=54-63).

**Power**: For 0% → 80% effect (conservative estimate from EXP-165's 0%→100%):
- Fisher's exact for 12/15 vs 0/54: p ≈ 10^-12. **Massively overpowered.**
- Even 0% → 40%: Fisher's for 6/15 vs 0/54: p ≈ 10^-5. **Still adequate.**

---

## Predictions

| Scenario | Baseline | F1 prediction | Rationale |
|---|---|---|---|
| contradictory-requirements | 0% (n=63) | 70-100% | Recognition problem — telling agent the math should be sufficient |
| misleading-test-fix | 0% (n=54) | 60-90% | Diagnosis problem — telling agent which side is wrong should help, but agent might still default to modifying code |

---

## Success Criteria

| Outcome | Verdict |
|---|---|
| F1 > 50% on BOTH scenarios | **Strong generalization** — F1 works across recognition, judgment, and diagnosis tasks |
| F1 > 50% on ONE scenario | **Partial generalization** — F1 is task-type-dependent |
| F1 < 30% on BOTH | **F1 does not generalize** — only works for architectural tasks |

---

## Scenario Variants

| Arm | contradictory-requirements | misleading-test-fix |
|-----|---|---|
| **A (baseline)** | `contradictory-requirements` (existing) | `misleading-test-fix` (existing) |
| **C (F1-only)** | `contradictory-requirements-f1` ✅ | `misleading-test-fix-f1` ✅ |

### Smoke Test Results (2026-04-16, N=1 each)

| Scenario | Passed | All Checks |
|---|---|---|
| contradictory-requirements-f1 | ✅ | 5/5 (tests-pass, ordering-preserved, analysis-exists, contradiction-identified, alternatives-proposed) |
| misleading-test-fix-f1 | ✅ | 8/8 (tax-rounds ×2, tax-basic, all-tests-pass, discount-correct, test-assertion-fixed, applyDiscount-not-modified, ran-tests) |

---

## Run Plan

```bash
# 30 total runs (~$2.25)
scripts/gym-batch.sh --scenarios contradictory-requirements-f1,misleading-test-fix-f1 --trials 15 --agent coder
```

---

## Budget

- 30 runs × ~$0.075 = **~$2.25**
- Baselines are free (existing data)

---

## Tags
`EXP-167` `content-first` `F1` `generalization` `contradictory-requirements` `misleading-test-fix` `guard-design`
