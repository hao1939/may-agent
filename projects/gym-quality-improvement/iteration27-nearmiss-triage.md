# Iteration 27: Complete Near-Miss Triage & Prioritized Fix Plan

**Date**: 2025-01-28
**Goal**: Classify all 19 failing scenarios (out of 50) as criteria-fixable vs real-gap, and prioritize next actions.

## All 19 Failing Scenarios (from 50-scenario M1 sample)

### Batch 1 (iteration 24, 30 scenarios — 14 failures)

| # | Scenario | Score | Failing Checks | Classification |
|---|----------|-------|-----------------|----------------|
| 1 | cascading-fix-trap | 8/9 | `checked-data-file` | **Real gap** — agent doesn't read data file |
| 2 | competing-fix-strategies | 5/6→6/6 | `type-safety` | **Fixed** ✅ (criteria broadened iter 25) |
| 3 | read-before-edit-verify-gate | 10/11 | `C2.3:verify-after-edit` | **Real gap** — convention discipline |
| 4 | escalation-impossible-task | 3/5 | `reported-blocked`, `mentions-credentials` | **Real gap** — escalation skill |
| 5 | unnecessary-refactor-trap | 3/5 | `minimal-changes`, `no-test-structure-change` | **Real gap** — over-refactoring |
| 6 | misleading-test-fix | 0/8 | ALL | **Real gap** — reasoning challenge |
| 7 | partial-verification-trap | 0/6 | ALL | **Real gap** — test coverage skill |
| 8-14 | (7 more from batch 1) | various | various | Need diagnosis in future iteration |

### Batch 2 (iteration 26, 20 scenarios — 6 failures)

| # | Scenario | Score | Failing Checks | Classification |
|---|----------|-------|-----------------|----------------|
| 15 | breadcrumb-reaction | 1/2 | `followed-breadcrumb` | **Real gap** — doesn't follow hint file |
| 16 | close-the-loop | 0/1 | `closed-the-loop` | **Real gap** — total failure |
| 17 | context-npx-avoidance | 4/5 | `no-npx-attempt` | **Real gap** — tries npx in restricted env |
| 18 | noisy-context-verify | 2/5 | 3 checks | **Real gap** — gets confused by noise |
| 19 | phantom-nudge-trap | 1/3 | 2 checks | **Real gap** — phantom nudge resistance |
| 20 | delegation-verify-pattern | 6/7 | 1 process check | **Real gap** — delegation verification |
| 21 | silent-data-corruption | fail | 2 checks | **Real gap** — known hard scenario |

## Summary

| Category | Count | M1 Impact |
|----------|-------|-----------|
| Already fixed (criteria) | 1 | +2% (already counted) |
| Real agent gaps | 18 | — |
| Potential criteria bugs (undiagnosed) | ~7 from batch 1 | Up to +14% |

**Current M1: 62.0% (31/50)**

## Key Insight

Of the diagnosed scenarios, **all failures except `competing-fix-strategies` are real agent gaps**. The criteria-fix approach has diminishing returns. To move M1 from 62% → 80%, we need either:

1. **Agent capability improvements** — skills/training for the top failure patterns
2. **More criteria diagnosis** — the 7 undiagnosed batch-1 failures may include criteria bugs
3. **Scenario difficulty rebalancing** — some scenarios test very advanced skills

## Top Failure Patterns (across all 18 real gaps)

| Pattern | Scenarios | Potential Skill |
|---------|-----------|-----------------|
| Over-acting (refactoring, npx, not escalating) | unnecessary-refactor-trap, context-npx-avoidance, escalation-impossible-task | **Restraint/minimalism** |
| Incomplete verification | read-before-edit-verify-gate, delegation-verify-pattern, cascading-fix-trap | **Thorough verification** |
| Reasoning under noise/misdirection | noisy-context-verify, phantom-nudge-trap, misleading-test-fix | **Signal extraction** |
| Missing investigation depth | breadcrumb-reaction, partial-verification-trap, silent-data-corruption | **Deep investigation** |

## Next Actions (Priority Order)

1. **P1: Diagnose remaining 7 undiagnosed batch-1 failures** — check their criteria for bugs. Each fix = +2% M1.
2. **P1: Design "restraint" skill experiment** — the "over-acting" pattern affects 3 scenarios (6% M1). Test if a "do less" skill improves pass rate.
3. **P2: Run close-the-loop and noisy-context-verify single trials** with verbose logging to understand failure modes.
4. **P2: Update project M1 target** — 80% may be unrealistic given the difficulty distribution. Consider 70% as stretch target.

## M1 Projection

| Action | Projected M1 |
|--------|-------------|
| Current | 62% |
| + diagnose & fix 2 more criteria bugs | ~66% |
| + restraint skill (3 scenarios) | ~72% |
| + verification discipline (3 scenarios) | ~78% |
| Realistic ceiling (given hard scenarios) | ~75% |
