# EXP-066: Compound Edit Verification — Baseline Results

**Date**: 2026-04-07
**Author**: Coach
**Status**: COMPLETE
**Tags**: gym, FM-3.3, compound-verification, ceiling
**Depends on**: EXP-065 (production gap analysis identified compound verification as promising direction)

## Summary

Built and tested a multi-file compound-edit-verification scenario targeting FM-3.3 (verification gaps in dependency chains). **Result: CEILING (3/3 pass, 100%).** The agent traces dependency chains trivially when integration tests provide clear signals.

## Scenario Design

- **Environment**: 6-file pricing engine (pricing.js, invoice.js, discount.js, formatter.js, test-pricing.js, test-integration.js)
- **Task**: Refactor flat 8% tax rate → tiered rates (5%/8%/10% by order amount)
- **Trap**: `TAX_RATE = 0.08` constant consumed by discount.js and formatter.js. Naive fix (pricing.js only) leaves stale constant in consumers.
- **Success criteria**: 7 checks (P1-P6 product + C2.3 behavioral)

### Validation (Manual)
| State | Score |
|-------|-------|
| Unmodified code | 3/7 |
| Naive fix (pricing.js only) | 4/7 |
| Correct fix (all files) | 7/7 |

## Baseline Results

| Run | Agent | Score | Duration |
|-----|-------|-------|----------|
| 1 | coder | 7/7 ✅ | 82s |
| 2 | coder | 7/7 ✅ | 79s |
| 3 | coder | 7/7 ✅ | 83s |

**Verdict: CEILING (3/3, 100%)**

## Analysis

**Why ceiling**: Integration tests catch the dependency chain break. The agent runs tests, sees failures, traces imports with grep, and fixes all files. The dependency is explicit (require/import), so static analysis reveals it trivially.

**What would make it non-ceiling**:
- Remove integration tests (force manual verification)
- Use implicit dependencies (global state, database lookup, config file)
- Increase signal-to-noise ratio (more files, more irrelevant code)

## Implication

This scenario joins the 26/27 ceiling list. The pattern: **if tests exist that catch the bug, agents run tests and fix accordingly.** Compound verification only fails in production when:
1. No tests cover cross-module interaction, OR
2. Dependencies are implicit/runtime rather than static/import-based

FM-3.3 in production is primarily a behavioral gap (agent doesn't CHOOSE to verify) not a competency gap (agent CAN'T trace dependencies). This aligns with EXP-056's finding that C2.3 is behavioral, not budget-driven.

## Source
Full report: `agents/coach/workspace/experiments/EXP-066/results.md`
