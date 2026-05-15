# Wave 3 Regression Validation Results

**Date**: 2026-04-09
**Protocol**: 1 run each, `--agent bob`, regression check (not baseline)
**Framework SHA**: 8a07792

## Summary

| Scenario | Passed | Checks | Product | Convention | Notes |
|---|---|---|---|---|---|
| regression-from-fix-ext | ✅ | 6/6 | 6/6 | 0/0 | Perfect |
| search-strategy-escalation-ext | ✅ | 5/6 | 2/2 | 3/4 | Convention fail: search-count-under-10 |
| spec-adherence-multi-step-ext | ❌ | 10/11 | 8/8 | 2/3 | Convention fail: step-order |

**Overall**: 2/3 scenarios pass. All product checks pass across all scenarios (16/16). Convention compliance: 5/7.

## Detailed Results

### 1. regression-from-fix-ext ✅ PASSED

All 6 checks passed:
- ✅ `discount-bug-fixed` — SAVE20 discount works: $100 → $20 off → $86.40 total
- ✅ `tax-exempt-preserved` — Tax-exempt works: $100 - $20 discount = $80 total, tax=0
- ✅ `invoice-works` — Invoice generation works correctly with LOYALTY discount
- ✅ `minimal-fix` — Fix is minimal, all original functions and constants preserved
- ✅ `flat-discount-works` — FLAT10 discount works: $50 - $10 = $40 → $43.20 with tax
- ✅ `no-discount-works` — No-discount case preserved: $100 → $108 with tax

Duration: 45.7s

### 2. search-strategy-escalation-ext ✅ PASSED (with convention gap)

5/6 checks passed:
- ✅ `fix-applied` (product) — rate-limiter.js correctly reads maxRequests
- ✅ `tests-pass` (product) — All tests pass
- ❌ `search-count-under-10` (convention) — Found 23 search commands (threshold: <10)
- ✅ `reads-file-after-search` (convention) — Agent read files after searching
- ✅ `reads-rate-limiter` (convention) — Agent examined rate-limiter.js
- ✅ `reads-config` (convention) — Agent examined config files

Duration: 34.8s

**Failure analysis**: The `search-count-under-10` check measures whether Bob uses an efficient search strategy (< 10 search commands). Bob used 23 — over 2x the threshold. This is the exact behavior the scenario is designed to test: escalating search strategy. The skill for this scenario would need to teach Bob to narrow searches faster.

### 3. spec-adherence-multi-step-ext ❌ FAILED (convention)

10/11 checks passed:
- ✅ `step-1-read-config` (product) — Agent read server-config.json
- ✅ `step-2-read-logs` (product) — Agent read health-checks.log
- ✅ `step-3-report-exists` (product) — audit-report.md was created
- ✅ `step-3-report-service-count` (product) — Mentions 7 services
- ✅ `step-3-report-errors` (product) — Mentions payment-gateway and cache-proxy errors
- ✅ `step-3-report-severity` (product) — Includes severity ratings
- ✅ `step-4-summary-exists` (product) — audit-summary.txt was created
- ✅ `step-4-summary-format` (product) — Follows required format
- ✅ `task-adherence: plan-before-action` (convention) — Plans before acting
- ✅ `C40.3: finish-includes-deliverables` (convention) — Finish includes deliverables
- ❌ `step-order: read-inputs-before-writing-outputs` (convention) — Violated read-before-write order

Duration: 50.8s

**Failure analysis**: Bob completed all product requirements perfectly but violated step ordering — he likely started writing outputs before fully reading all inputs. This is the spec-adherence behavior the scenario tests.

## Assessment

These are **regression checks**, not formal baselines. Key observations:

1. **Product quality is solid**: 16/16 product checks pass across all 3 scenarios. Bob reliably produces correct output.
2. **Convention compliance is the gap**: Both failures are convention checks. These are exactly the behaviors the treatment skills should address.
3. **No regressions detected**: These results are consistent with what we'd expect from untreated scenarios — the existing skills haven't caused any negative side effects on Wave 3 scenarios.

## Comparison to Wave 1/2

- Wave 1 (3 scenarios, treated): All passing after skill deployment
- Wave 2 (5 scenarios, validating): Results in wave2-validation-results-part2/3.md
- Wave 3 (3 scenarios, untreated baseline): 2/3 pass, convention gaps are treatable
