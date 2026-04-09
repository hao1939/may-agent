# Wave 3 Ext Validation Results

**Date**: 2026-04-09  
**Agent**: bob  
**Protocol**: 3 scenarios × 3 runs each = 9 total gym runs  
**Purpose**: Formal N=3 validation of Wave 3 externalization scenarios (follow-up to 1-run regression check)

---

## Summary

| Scenario | Overall Pass Rate | Per-Run Check Pass Rate | Consistent Failure |
|---|---|---|---|
| regression-from-fix-ext | **3/3** ✅ | 6/6, 6/6, 6/6 | None |
| search-strategy-escalation-ext | **3/3** ✅ | 5/6, 5/6, 5/6 | `search-count-under-10` (convention) |
| spec-adherence-multi-step-ext | **0/3** ❌ | 10/11, 10/11, 10/11 | `step-order: read-inputs-before-writing-outputs` (convention) |

**Overall scenario pass rate**: 2/3 (67%)  
**Overall check pass rate**: 62/69 (90%)

---

## Scenario 1: regression-from-fix-ext

**Result: 3/3 PASS** — Perfect. All product checks pass consistently.

| Check | Category | Run 1 | Run 2 | Run 3 |
|---|---|---|---|---|
| discount-bug-fixed | product | ✓ | ✓ | ✓ |
| tax-exempt-preserved | product | ✓ | ✓ | ✓ |
| invoice-works | product | ✓ | ✓ | ✓ |
| minimal-fix | product | ✓ | ✓ | ✓ |
| flat-discount-works | product | ✓ | ✓ | ✓ |
| no-discount-works | product | ✓ | ✓ | ✓ |

**Analysis**: Bob consistently fixes the discount bug without introducing regressions. Externalization adds no overhead — this scenario was already passing pre-ext.

---

## Scenario 2: search-strategy-escalation-ext

**Result: 3/3 PASS** (overall), but `search-count-under-10` convention check fails 3/3.

| Check | Category | Run 1 | Run 2 | Run 3 |
|---|---|---|---|---|
| fix-applied | product | ✓ | ✓ | ✓ |
| tests-pass | product | ✓ | ✓ | ✓ |
| search-count-under-10 | convention | ✗ | ✗ | ✗ |
| reads-file-after-search | convention | ✓ | ✓ | ✓ |
| reads-rate-limiter | convention | ✓ | ✓ | ✓ |
| reads-config | convention | ✓ | ✓ | ✓ |

**Analysis**: Product behavior is perfect (2/2 always pass). The `search-count-under-10` convention check consistently fails — Bob uses ≥10 grep/find commands per run. This is a convention gap, not a product gap. The scenario still passes overall because the scorer's pass condition weights product checks.

**Training opportunity**: A search-efficiency skill could reduce Bob's grep count. The `directory-first-navigation` skill is loaded but doesn't specifically target grep count in bug-fixing scenarios.

---

## Scenario 3: spec-adherence-multi-step-ext

**Result: 0/3 FAIL** — Consistent single-check failure blocks overall pass.

| Check | Category | Run 1 | Run 2 | Run 3 |
|---|---|---|---|---|
| step-1-read-config | product | ✓ | ✓ | ✓ |
| step-2-read-logs | product | ✓ | ✓ | ✓ |
| step-3-report-exists | product | ✓ | ✓ | ✓ |
| step-3-report-service-count | product | ✓ | ✓ | ✓ |
| step-3-report-errors | product | ✓ | ✓ | ✓ |
| step-3-report-severity | product | ✓ | ✓ | ✓ |
| step-4-summary-exists | product | ✓ | ✓ | ✓ |
| step-4-summary-format | product | ✓ | ✓ | ✓ |
| task-adherence: plan-before-action | convention | ✓ | ✓ | ✓ |
| C40.3: finish-includes-deliverables | convention | ✓ | ✓ | ✓ |
| step-order: read-inputs-before-writing-outputs | convention | ✗ | ✗ | ✗ |

**Analysis**: All 8 product checks pass perfectly (100%). 2/3 convention checks pass. The `step-order` check fails 3/3 — Bob reads the input files but interleaves reading with writing rather than completing all reads before any writes. This is the same convention failure identified in the 1-run regression check.

**Regression risk**: The overall pass is false 3/3. This scenario is the weakest in Wave 3. A dedicated skill for "complete all reads before any writes in multi-step tasks" could fix this.

---

## Cross-Scenario Analysis

### Product vs Convention
- **Product checks**: 54/54 (100%) — Bob's task completion is excellent
- **Convention checks**: 8/15 (53%) — Process discipline needs work

### Consistent Failures (same check fails all 3 runs)
1. `search-count-under-10` (search-strategy-escalation-ext) — 0/3
2. `step-order: read-inputs-before-writing-outputs` (spec-adherence-multi-step-ext) — 0/3

### Comparison with Regression Check (1 run each)
| Scenario | Regression (N=1) | Validation (N=3) | Consistent? |
|---|---|---|---|
| regression-from-fix-ext | 1/1 pass | 3/3 pass | ✅ Yes |
| search-strategy-escalation-ext | 1/1 pass | 3/3 pass | ✅ Yes |
| spec-adherence-multi-step-ext | 0/1 fail | 0/3 fail | ✅ Yes (confirmed) |

All N=1 results held at N=3. The regression check was accurate.

---

## Recommendations

1. **regression-from-fix-ext**: No action needed. Stable pass.
2. **search-strategy-escalation-ext**: Consider a search-efficiency skill targeting grep count. Low priority — scenario passes.  
3. **spec-adherence-multi-step-ext**: **High priority** — needs a "read-all-inputs-first" skill or step-ordering enforcement. 0/3 is a real regression risk and the only scenario that fails overall.
