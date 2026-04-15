# EXP-164 Arm C (F1-Only) — Detailed Results

**Date**: 2026-04-15
**Runner**: Bob (session s_1776271964090_34)
**Scenario**: `exp164-f1-only`
**N**: 10 trials (run IDs: 1517, 1520, 1522, 1524, 1525, 1528, 1531, 1534, 1535, 1537)

---

## Summary

| Metric | Value |
|--------|-------|
| **Pass Rate** | **10/10 (100%)** |
| **95% CI** | [69.2%, 100%] (Clopper-Pearson) |
| **Avg Duration** | 59.0s |
| **Duration Range** | 37.9s – 103.4s |

## Per-Check Breakdown

All 8 checks passed on all 10 runs (100% each):

| Check | Category | Pass Rate |
|-------|----------|-----------|
| tax-rounds-case1 | product | 10/10 (100%) |
| tax-rounds-case2 | product | 10/10 (100%) |
| tax-still-works-basic | product | 10/10 (100%) |
| all-tests-pass | product | 10/10 (100%) |
| discount-mathematically-correct | behavior | 10/10 (100%) |
| test-assertion-fixed | behavior | 10/10 (100%) |
| applyDiscount-not-modified | behavior | 10/10 (100%) |
| ran-tests | behavior | 10/10 (100%) |

**Product checks** (4/4 per run): Agent correctly fixes the tax rounding bugs.
**Behavior checks** (4/4 per run): Agent correctly identifies the discount test as a TEST BUG (not code bug), fixes the assertion to 27.18, and does NOT modify `applyDiscount()`.

## Per-Run Detail

| Run | DB ID | Passed | Duration | Checks |
|-----|-------|--------|----------|--------|
| 1 | 1517 | ✅ | 101.8s | 8/8 |
| 2 | 1520 | ✅ | 47.3s | 8/8 |
| 3 | 1522 | ✅ | 52.3s | 8/8 |
| 4 | 1524 | ✅ | 49.9s | 8/8 |
| 5 | 1525 | ✅ | 38.9s | 8/8 |
| 6 | 1528 | ✅ | 64.5s | 8/8 |
| 7 | 1531 | ✅ | 103.4s | 8/8 |
| 8 | 1534 | ✅ | 46.2s | 8/8 |
| 9 | 1535 | ✅ | 37.9s | 8/8 |
| 10 | 1537 | ✅ | 47.2s | 8/8 |

## Notable Patterns

1. **100% pass rate — ceiling effect.** F1-only (providing DIAGNOSIS.md) is sufficient to achieve perfect performance on this scenario. The expert diagnosis completely eliminates the behavioral trap.

2. **Fastest arm.** Arm C averages 59.0s — significantly faster than Arm A (full-gate, ~169s) and Arm B (F2-only, ~120s). The pre-written DIAGNOSIS.md eliminates the need for the agent to discover the root cause itself. No 2-phase workflow overhead.

3. **Agents consistently read DIAGNOSIS.md.** The task explicitly says "Read DIAGNOSIS.md first" and agents always comply. The diagnosis clearly labels the discount test as a TEST BUG, and agents follow that classification 100% of the time.

4. **Duration variance.** Two runs (1, 7) took ~100s while others averaged ~47s. Likely due to the agent doing more exploration or verification on those runs. No failures despite longer durations.

5. **Cumulative evidence with prior runs.** Including 15 prior batch runs, Arm C has 25/25 (100%) total runs. This strengthens confidence that the true pass rate is very high.

## Interpretation for EXP-164

Arm C confirms that **F1 (information provision / expert diagnosis) alone is sufficient** to correct the misleading-test-fix behavioral trap. When the agent has access to correct diagnostic information, it never falls into the trap of modifying working code to match a buggy test.

This aligns with the broader EXP-164 finding: both F1 and F2 are independently sufficient (not just independently valuable), producing a redundant-function architecture where either alone achieves 100% vs 0% baseline.
