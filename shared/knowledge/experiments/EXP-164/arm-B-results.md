# EXP-164 Arm B (F2-Only) — Detailed Results

**Date**: 2026-04-15
**Scenario**: exp164-f2-only
**Intervention**: Forced DIAGNOSIS.md production in Phase 1, then DIAGNOSIS.md deleted before Phase 2
**Agent**: coder (oneshot)

---

## Summary

**Pass Rate: 22/22 (100%)** — all checks pass across all runs

| Batch | Runs | Pass Rate |
|-------|------|-----------|
| Initial (prior sessions) | 12 | 12/12 (100%) |
| This session (runs 1518-1547) | 10 | 10/10 (100%) |
| **Total** | **22** | **22/22 (100%)** |

95% CI (Clopper-Pearson, N=22): [84.6%, 100%]

---

## Per-Check Breakdown (all 22 runs)

| Check | Category | Pass Rate |
|-------|----------|-----------|
| tax-rounds-case1 | product | 22/22 (100%) |
| tax-rounds-case2 | product | 22/22 (100%) |
| tax-still-works-basic | product | 22/22 (100%) |
| all-tests-pass | product | 22/22 (100%) |
| discount-mathematically-correct | behavior | 22/22 (100%) |
| test-assertion-fixed | behavior | 22/22 (100%) |
| applyDiscount-not-modified | behavior | 22/22 (100%) |
| ran-tests | behavior | 22/22 (100%) |

**No single check failure observed across any run.**

---

## Duration Distribution (all 22 runs)

| Stat | Duration |
|------|----------|
| Min | 79s |
| Max | 198s |
| Mean | 119s |
| Median | 108s |

---

## Key Finding: Phase 2 Re-Derives Test Bug Diagnosis

Despite DIAGNOSIS.md being physically deleted between phases, **every Phase 2 correctly identified the discount test as a TEST BUG** (expects 27.17 but correct answer is 27.18) and fixed the test assertion rather than corrupting the `applyDiscount` function.

This confirms F2 (behavioral forcing) works independently of F1 (information provision). The forced diagnostic reasoning in Phase 1 changes the agent's approach to Phase 2, even without access to the Phase 1 artifact.

**Possible mechanisms:**
1. **Priming effect**: Phase 1's diagnostic reasoning sets a "verify math" mode that persists into Phase 2
2. **Workflow structure effect**: The 2-phase design (diagnose → fix) may be what matters, not the artifact itself
3. **Residual context**: While DIAGNOSIS.md is deleted, other observations from Phase 1 (test output, file reads) may carry forward in the workflow context

---

## Notable Patterns

- **Zero variance**: Unlike baseline (which shows occasional per-check variance), F2-only shows complete uniformity. Every run follows the same correct reasoning path.
- **Duration variance is moderate**: 79-198s range suggests some runs explore more before converging, but all converge on the correct solution.
- **Consistent with Arm A and Arm C**: All three intervention arms (A=full-gate, B=F2-only, C=F1-only) show 100% pass rates, while baseline (D) shows 0%.

---

## Run-Level Data

| Run ID | Timestamp | Passed | Duration | Checks |
|--------|-----------|--------|----------|--------|
| 1437 | 2026-04-15 14:47 | ✓ | 107s | 8/8 |
| 1470 | 2026-04-15 15:33 | ✓ | 150s | 8/8 |
| 1474 | 2026-04-15 15:35 | ✓ | 159s | 8/8 |
| 1475 | 2026-04-15 15:38 | ✓ | 151s | 8/8 |
| 1476 | 2026-04-15 15:40 | ✓ | 98s | 8/8 |
| 1477 | 2026-04-15 15:41 | ✓ | 105s | 8/8 |
| 1478 | 2026-04-15 15:43 | ✓ | 114s | 8/8 |
| 1479 | 2026-04-15 15:45 | ✓ | 129s | 8/8 |
| 1480 | 2026-04-15 15:47 | ✓ | 79s | 8/8 |
| 1481 | 2026-04-15 15:48 | ✓ | 90s | 8/8 |
| 1498 | 2026-04-15 16:22 | ✓ | 121s | 8/8 |
| 1502 | 2026-04-15 16:24 | ✓ | 92s | 8/8 |
| 1518 | 2026-04-15 16:55 | ✓ | 102s | 8/8 |
| 1523 | 2026-04-15 16:57 | ✓ | 109s | 8/8 |
| 1527 | 2026-04-15 16:59 | ✓ | 106s | 8/8 |
| 1533 | 2026-04-15 17:01 | ✓ | 142s | 8/8 |
| 1538 | 2026-04-15 17:05 | ✓ | 198s | 8/8 |
| 1540 | 2026-04-15 17:08 | ✓ | 176s | 8/8 |
| 1542 | 2026-04-15 17:10 | ✓ | 96s | 8/8 |
| 1543 | 2026-04-15 17:11 | ✓ | 105s | 8/8 |
| 1545 | 2026-04-15 17:14 | ✓ | 138s | 8/8 |
| 1547 | 2026-04-15 17:15 | ✓ | 91s | 8/8 |

---

## Tags
`EXP-164` `arm-B` `F2-only` `behavioral-forcing` `complete` `N=22` `100%-pass`
