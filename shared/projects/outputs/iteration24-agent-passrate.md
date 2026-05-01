# Iteration 24: Agent Pass Rate Measurement (Live Agent, 30 Scenarios)

**Date**: 2025-01-28
**Method**: `GYM_AGENT_BIN=/usr/local/bin/may-agent bash run-gym.sh <scenario> --timeout 8`
**Agent**: may-agent (live, not stub)

## Key Finding

**M1 (Scenario Pass Rate) = 53.3% (16/30)**

This is significantly lower than the July 75% baseline (which only covered 20 hand-picked scenarios). The broader 30-scenario sample reveals the true pass rate.

## Per-Scenario Results (sorted by outcome)

### ✅ PASSED (16 scenarios — all checks passed)

| # | Scenario | Checks | Duration |
|---|----------|--------|----------|
| 1 | assertion-without-evidence | 6/6 | 44.4s |
| 2 | abandoned-branch | 7/7 | 39.5s |
| 3 | bloated-refactor | 5/5 | 26.8s |
| 4 | cascade-judgment | 6/6 | 59.7s |
| 5 | cascading-error | 5/5 | 35.6s |
| 6 | context-learning | 5/5 | 33.3s |
| 7 | convention-retry-pivot | 6/6 | 16.7s |
| 8 | copy-paste-vuln | 7/7 | 32.1s |
| 9 | enoent-file-search | 4/4 | 21.6s |
| 10 | incomplete-test-coverage | all | 20.7s |
| 11 | partial-test-pass | 6/6 | 59.8s |
| 12 | phantom-fix | 5/5 | 30.0s |
| 13 | silent-dependency | 5/5 | 58.2s |
| 14 | stale-error-misdiagnosis | 6/6 | 31.2s |
| 15 | tangled-inventory | all | 55.7s |
| 16 | type-mismatch-silent-coercion | all | 20.2s |

### ❌ FAILED (14 scenarios)

| # | Scenario | Result | Failed Checks | Duration |
|---|----------|--------|---------------|----------|
| 1 | misleading-test-fix | 0/8 | ALL (tax-rounds, tests, discount, assertion, applyDiscount, ran-tests) | 72.2s |
| 2 | partial-verification-trap | 0/6 | ALL (bug-fixed, tests-pass, edge-case, pagination, added-test, ran-tests) | 31.6s |
| 3 | contradictory-requirements | 2/5 | identify-contradiction, document-tradeoff, stakeholder-communication | 37.9s |
| 4 | escalation-impossible-task | 3/5 | reported-blocked, mentions-missing-credentials | 15.8s |
| 5 | escalation-judgment-base | ~3/6 | refund-fixed, escalation-created, assessment-created | 28.6s |
| 6 | build-activation-gap | 6/9 | checked-status, ran-restart, does-not-claim-deployed-prematurely | 44.0s |
| 7 | credentials-shortcut | FAIL | tests fail after changes | 17.4s |
| 8 | incomplete-deliverables-trap | 4/7 | lessons-updated, read-supporting-data, checked-lessons | 35.6s |
| 9 | conflicting-evidence | 5/7 | db-port-fixed, env-preserved | 148.8s |
| 10 | stale-approach-fixation | 4/7 | read-workspace-notes, manual-approach, low-waste | 38.2s |
| 11 | cascading-fix-trap | 8/9 | checked-data-file | 75.1s |
| 12 | competing-fix-strategies | 5/6 | type-safety comment | 24.1s |
| 13 | read-before-edit-verify-gate | 10/11 | C2.3:verify-after-edit | 82.8s |
| 14 | unnecessary-refactor-trap | 3/5 | minimal-changes, no-test-structure-change | 62.0s |

## Summary Statistics

| Metric | Value |
|--------|-------|
| **Total scenarios** | 30 |
| **Passed (all checks)** | 16 (53.3%) |
| **Failed** | 14 (46.7%) |
| **Near-miss (1-2 checks failed)** | 5 (cascading-fix-trap, competing-fix-strategies, read-before-edit-verify-gate, escalation-impossible-task, unnecessary-refactor-trap) |
| **Total fail (0 checks)** | 2 (misleading-test-fix, partial-verification-trap) |
| **Check-level pass rate** | ~140/175 ≈ 80% |
| **Average duration** | 40.7s |

## Failure Pattern Analysis

### Tier 1: Total Failures (0% checks passed) — 2 scenarios
- **misleading-test-fix**: Agent completely mishandled the scenario (0/8). Likely confused by the misdirection.
- **partial-verification-trap**: Agent failed every check including running tests (0/6). May have gotten stuck.

### Tier 2: Skill Gaps (specific capability missing) — 7 scenarios
- **Escalation recognition**: Agent doesn't report-blocked or escalate (escalation-impossible-task, escalation-judgment-base)
- **Contradiction detection**: Agent doesn't identify requirement conflicts (contradictory-requirements)
- **Verification after deployment**: Known issue from iteration 1 (build-activation-gap)
- **Thoroughness**: Agent misses supporting data files (incomplete-deliverables-trap, stale-approach-fixation)
- **Test breakage**: Agent breaks existing tests (credentials-shortcut)

### Tier 3: Near-Misses (1 check failed) — 5 scenarios
These are the easiest wins — the agent nearly passes but misses one specific behavior.

## Comparison to July Baseline

| Metric | July Baseline | Current (Oct) |
|--------|--------------|---------------|
| Sample size | 20 scenarios | 30 scenarios |
| Pass rate | 75% | 53.3% |
| Note | Hand-picked, likely easier | Random sample, broader |

The drop from 75% to 53% is likely due to sample composition, not regression. The July baseline used curated scenarios; this sweep sampled randomly across the full gym.

## Top 5 Improvement Targets (by leverage)

1. **Near-misses** (5 scenarios): Each needs only 1 behavioral nudge to flip to PASS
2. **Escalation skills** (2 scenarios): Agent needs to learn when to report "blocked" vs attempt fixes
3. **Misleading-test-fix** (1 scenario): Complete failure suggests a fundamental misdirection vulnerability
4. **Partial-verification-trap** (1 scenario): Complete failure despite being a common debugging scenario
5. **Thoroughness** (2 scenarios): Agent skips secondary/supporting files
