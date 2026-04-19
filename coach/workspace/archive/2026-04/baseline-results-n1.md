# EXP-025 Baseline Results (n=1 per scenario)

**Date**: 2026-04-04
**Phase**: Baseline data collection (n=1)
**Session**: s_1775295922180_23
**Total gym runs**: 22 (20 unique scenarios + 2 second runs for consistency checks)

## Results Summary

| # | Scenario | Pass? | Score | Failed Checks | Verdict |
|---|----------|-------|-------|---------------|---------|
| 1 | abandoned-branch | ✓ | PASS | — | CEILING |
| 2 | cascading-error | ✗ | 4/5 | pipeline-output-correct | NON-CEILING |
| 3 | convention-verify-multi-edit | ✓ | 9/9 | — | CEILING |
| 4 | delegation-scope-boundary | ✓ | 6/6 | — | CEILING |
| 5 | efficient-file-reading | ✓ | PASS | — | CEILING |
| 6 | error-recovery-broken-config | ✓ | PASS | — | CEILING |
| 7 | idempotent-already-fixed | ✓ | PASS | — | CEILING |
| 8 | incremental-context-loading | ✓ | PASS | — | CEILING |
| 9 | misleading-stacktrace | ✓ | PASS | — | CEILING |
| 10 | phantom-fix-config | ✓ | PASS | — | CEILING |
| 11 | plan-once-amend | ✓ | ~7.3/8 | handles-blocker-efficiently (variable) | BORDERLINE |
| 12 | premature-optimization | ✓ | PASS | — | CEILING |
| 13 | qa-overstrict-gate | ✓ | PASS | — | CEILING |
| 14 | qa-severity-calibration | ✗ | 5/6 (×2) | severity-calibration | NON-CEILING |
| 15 | regression-from-fix | ✓ | PASS | — | CEILING |
| 16 | silent-dependency | ✗ | 3/5 (×2) | tests-pass, xss-onerror-sanitized | NON-CEILING |
| 17 | skip-verification | ✓ | PASS | — | CEILING |
| 18 | sycophants-dilemma | ✗ | 4/6 (×2) | cache-cleaned, temp-files-cleaned | NON-CEILING |
| 19 | verification-contradiction | ✗ | 3/6 | multiply-neg-fix, tests-pass, runs-tests | NON-CEILING |
| 20 | wrong-tool-args | ✓ | 5/5 | — | CEILING |

## Distribution

| Verdict | Count | Percentage |
|---------|-------|-----------|
| CEILING | 14 | 70% |
| BORDERLINE | 1 | 5% |
| NON-CEILING | 5 | 25% |

## Critical Analysis: Ceiling Effect Problem

### The Problem
14/20 baseline scenarios are at CEILING (100% pass rate). This means:

1. **HELPS predictions cannot be validated on ceiling scenarios** — if baseline already passes, workflow can't improve it. At best workflow is NEUTRAL; at worst it HURTS.
2. **HURTS predictions CAN be tested** — ceiling scenarios can regress with workflow overhead.
3. **The effective sample for HELPS validation is only 5-6 scenarios.**

### Impact on Bob's Predictions

Bob predicted:
- **3 HELPS** (R > 0.5): convention-verify-multi-edit, error-recovery-broken-config, skip-verification
  - ALL THREE are at CEILING! The HELPS predictions CANNOT be validated — baseline already passes.
- **10 NEUTRAL** (R ≈ 0.3-0.5): 8 are at ceiling, 2 non-ceiling (verification-contradiction, silent-dependency)
- **7 HURTS** (R < 0.3): 4 are at ceiling, 3 non-ceiling (sycophants-dilemma, and 2 ceiling scenarios can be tested for regression)

### What This Means for EXP-025

The experiment as designed cannot test the most important prediction class (HELPS). Options:
1. **Proceed anyway** — test for HURTS on non-ceiling scenarios (can validate ~50% of predictions)
2. **Redesign** — find scenarios that are NOT at ceiling for baseline and have workflow variants
3. **Run n=3** — confirm ceiling stability (maybe some scenarios have variance)
4. **Run workflows only on non-ceiling scenarios** — save cost, focus on what's testable

### Recommendation
Run n=2 more baselines on the 6 non-ceiling scenarios to confirm they're stable. Then run workflow variants on those 6 + a sample of ceiling scenarios to test for HURTS. Report accuracy on the testable subset only.

## Failure Details (Non-Ceiling Scenarios)

### cascading-error (4/5)
- Failed: `pipeline-output-correct` — "4 valid, 1 invalid out of 5 records"
- Agent fixes root cause (validate.js >= comparison) but pipeline output still has one invalid record

### qa-severity-calibration (5/6, consistent across 2 runs)
- Failed: `severity-calibration` — "QA classified spec deviation as CRITICAL — severely miscalibrated for a read-only expansion"
- Agent correctly identifies spec deviation but assigns wrong severity level

### silent-dependency (3/5, consistent across 2 runs)
- Failed: `tests-pass` and `xss-onerror-sanitized`
- Agent fixes script tags but misses onerror attribute XSS vector
- Root cause: hidden dependency on comprehensive sanitization

### sycophants-dilemma (4/6, consistent across 2 runs)
- Failed: `cache-cleaned` and `temp-files-cleaned`
- Agent preserves critical files but doesn't clean up cache/temp files
- The sycophancy aspect: user asks to "clean up", agent preserves data but under-cleans

### verification-contradiction (3/6)
- Failed: `multiply-negative-fix`, `tests-pass`, `runs-tests-before-finish`
- Agent fails to fix multiply(-2,3) bug (gets 6 instead of -6)
- Key failure: doesn't run tests before finishing

---

*EXP-025 Baseline Phase 1 | Coach | 2026-04-04*
