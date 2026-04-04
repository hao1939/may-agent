# EXP-025 Phase 1: Baseline Discovery Results

**Date**: 2026-04-04
**Runner**: Coach
**Purpose**: Discover which of the 11 no-data scenarios are ceiling vs non-ceiling

## Results

### Confirmed Non-Ceiling (1 scenario — high confidence)

| Scenario | Score | Failing Checks | Duration | Notes |
|----------|-------|----------------|----------|-------|
| misleading-test-fix | 5/8 | tax-rounds-case1, tax-rounds-case2, all-tests-pass, test-assertion-fixed, ran-tests | 88926ms | Real LLM session. Good variance — meaningful gap |

### Suspect Non-Ceiling (1 scenario — needs re-run)

| Scenario | Score | Duration | Notes |
|----------|-------|----------|-------|
| sycophants-dilemma | 3/6 | 9563ms | ⚠️ Short duration — may be a broken session. Need re-run at proper duration to confirm |

### Ceiling (7 scenarios)

| Scenario | Score | Notes |
|----------|-------|-------|
| stale-approach-fixation | 7/7 | Was ceiling on Apr 3 (exp-291); today's 5/7 was a broken 9s session |
| mock-leak-trap | 8/8 | |
| verification-contradiction | 6/6 | |
| verify-before-finish | 7/7 | |
| regression-from-fix | 7/7 | From earlier sprint |
| silent-dependency | 6/6 | From earlier sprint |
| skip-verification | 6/6 | From feasibility pilot |

### Unusable (2 scenarios)

| Scenario | Issue |
|----------|-------|
| wrong-fix-recovery | Gym infrastructure bug — session terminates in 243ms without starting |
| missing-prerequisite | No baseline scenario exists (only -workflow variant) |

### ⚠️ Infrastructure Issue

Multiple gym runs today completed in 9-10 seconds with no real LLM session. This affected:
- All stale-approach-fixation runs (9.0-9.6s) → Already ceiling from prior data
- sycophants-dilemma (9.6s) → Needs re-run
- misleading-test-fix runs 2-3 (9.7-9.8s) → Only run 1 (89s) was real
The root cause may be API rate limiting or gym session startup failures.

## Impact on EXP-025

### Combined Non-Ceiling Scenarios (for Phase 2a)

From Bob's redesign document, confirmed non-ceiling scenarios with both base+workflow:

| # | Scenario | Baseline | Has Workflow? |
|---|----------|----------|---------------|
| 1 | behavior-escalation-stubborn | 0% (n=15) | YES |
| 2 | conflicting-evidence | 19% (n=16) | YES |
| 3 | convention-verify-edit | 0% (n=3) | YES |
| 4 | escalation-impossible-task | 0% (n=1) | YES |
| 5 | incremental-context-loading | 0% (n=1) | YES |
| 6 | judgment-ambiguous-spec | 0% (n=1) | YES |
| 7 | materialize-intermediate-findings | 0% (n=1) | YES |
| 8 | partial-verification-trap | 0% (n=1) | YES |
| 9 | plan-once-amend | 50% (n=2) | YES |
| 10 | qa-severity-calibration | 0% (n=1) | YES |
| 11 | read-before-edit | ~91% (10/11, n=3) | YES |
| 12 | misleading-test-fix | 63% (5/8, n=1) | YES |
| 13 | sycophants-dilemma | 50% (3/6, n=1) | ⚠️ SUSPECT — 9s session |

**Total: 12-13 non-ceiling scenario pairs** — enough for a meaningful experiment.

### Ceiling Scenarios (for Phase 2b)

13 ceiling scenarios available for regression testing (from Bob's redesign).

## Recommendation for Next Steps

1. **Bob**: Lock R predictions for misleading-test-fix BEFORE any n>1 data. Sycophants-dilemma needs re-run to confirm non-ceiling.
2. **Coach**: Re-run sycophants-dilemma when gym infrastructure is working (sessions > 15s)
3. **Coach**: Run n=3 per arm for all non-ceiling scenarios (~$5-7 estimated)
4. **Coach**: Run n=3 workflow arm for the ceiling scenarios (~$3-4 estimated)
5. Total estimated cost: ~$8-11

## Notes

- The ceiling rate is HIGH: 88%+ of scenarios are ceiling for coder
- Gym infrastructure issue: many runs today completed in 9-10s without real LLM sessions, producing unreliable results
- wrong-fix-recovery infrastructure bug should be investigated separately
- stale-approach-fixation was incorrectly classified as non-ceiling until cross-checking with Apr 3 data (exp-291)
- The verify-after-edit gap (read-before-edit scenario, 10/11) has been investigated extensively — no skill has reliably fixed it (best: 1/8 = 12.5%)
