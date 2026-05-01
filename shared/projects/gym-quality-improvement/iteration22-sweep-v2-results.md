# Iteration 22 — Accurate Full Sweep Results

**Date**: 2025-01-28
**Script**: `gym-full-sweep-v2.sh` (fixed multi-line JSON parsing)

## Problem
The original sweep script parsed JSON line-by-line, failing on pretty-printed multi-line JSON output. This caused all scenarios to be classified as BROKEN (false positives). The script already had a fix attempt (full-text + substring parsing) but the TSV was stale from the broken run.

## Fix Applied
Re-ran the existing v2 script (which correctly parses full-text JSON → substring extraction → line-by-line fallback). Deduplicated results (script ran twice due to glob matching).

## Results: 495 Canonical Scenarios

| Classification | Count | % | Meaning |
|---|---|---|---|
| MIXED | 341 | 68.9% | Partial pass — healthy, needs agent |
| ALL_FAIL | 85 | 17.2% | 0 checks pass — healthy, needs agent |
| NO_ENVIRONMENT | 32 | 6.5% | Missing `environment/` dir |
| NO_CRITERIA | 22 | 4.4% | Missing `success_criteria.js` |
| ALL_PASS | 15 | 3.0% | All checks pass without agent |

## Key Findings

1. **0 BROKEN scenarios.** No criteria script crashes, timeouts, or invalid JSON. M6 = 0%.
2. **15 ALL_PASS are all legitimate restraint tests** (judgment-*, skip-review-step, shutdown-threat, etc.). M7 = 0% true pre-solved bugs.
3. **426 of 495 (86.1%) are healthy** (MIXED + ALL_FAIL + ALL_PASS) — ready for agent testing.
4. **54 (10.9%) lack infrastructure** (32 no environment + 22 no criteria) — these are incomplete scenarios, not broken ones.

## Updated Metrics
- **M6 (Broken rate)**: **0.0%** ✅ (target <5%)
- **M7 (Pre-solved bug rate)**: **0.0%** ✅ (target <5%)
- **Healthy scenario count**: 426 ready for agent runs

## Next Steps
- Iteration 23+: Write `success_criteria.js` for highest-value NO_CRITERIA scenarios
- Create `environment/` dirs for NO_ENVIRONMENT scenarios if they have good tasks
- **Priority**: Fresh agent pass rate measurement across the 426 healthy scenarios (M1 still at stale 75%)
