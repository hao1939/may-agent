# Gym Scenario Deduplication Analysis

Generated: 2025-01-20

## Overview

- **Total scenarios**: 493
- **HEALTHY**: 227 (46%)
- **PRE_SOLVED**: 202 (41%)
- **BROKEN**: 44 (9%)
- **NO_CRITERIA**: 19 (4%)

202 scenarios pass all checks without any agent intervention. This means 41% of the gym is dead weight — measuring nothing about agent quality.

## Worst Offenders: Variant Explosion

The PRE_SOLVED scenarios cluster heavily around a few base scenarios with excessive variants:

| Base Scenario | PRE_SOLVED Variants | Assessment |
|---|---|---|
| `cascading-fix-trap` | 40 | **Extreme bloat.** 40 variants of the same scenario, all pre-solved. |
| `approach-validation-trap` | 7 | High redundancy |
| `compound-edit-verification` | 4 | Moderate redundancy |
| `ambiguous-context-drift` | 4 | Moderate (6 HEALTHY variants exist — keep those) |
| `build-activation-gap` | 3 | All 3 pre-solved |
| `silent-dependency` | 3 | Some healthy variants exist |
| `idempotent-already-fixed` | 3 | All pre-solved |

## Section 1: Scenarios to Retire (134 scenarios)

### Cascading-fix-trap variants (40 scenarios)
All 40 PRE_SOLVED. The base `cascading-fix-trap` is also pre-solved. These appear to be experiment arms (`exp177`, `exp195`, `exp198`, `exp199`, `exp200`, `exp202`, `exp242`, `exp257`) and difficulty variants (`f1`, `f2`, `f1f2`, `moderate`, `hard`, `tool`, etc.) that all pass without agent action. **Retire all 40.** If the underlying bug was fixed, the scenario no longer tests anything.

### Experiment-numbered scenarios (9 scenarios)
`exp096-arm-a/b/c`, `exp097-arm-a/b`, `exp175-arm-b/c/d`, `exp163/164/165-*` — experimental variants that were PRE_SOLVED. These are leftover from A/B tests. **Retire all.**

### Fully-redundant base+variant sets where ALL are PRE_SOLVED (estimated 85 more)
Scenarios like `abandoned-branch` + `abandoned-branch-workflow`, `bloated-refactor`, `cascading-error`, `behavior-resource-convergence`, all `approach-validation-trap-*`, all `build-activation-gap-*`, etc. When both the base AND all variants are pre-solved, the entire family should be retired.

## Section 2: Scenarios to Keep (259 scenarios)

### All 227 HEALTHY scenarios
These differentiate agent quality. Keep all.

### PRE_SOLVED bases where HEALTHY variants exist (~13 scenarios)
Example: `ambiguous-context-drift-L2` is PRE_SOLVED but `ambiguous-context-drift-L1` and `ambiguous-context-drift` are HEALTHY. Keep the healthy variants, retire the pre-solved siblings.

### NO_CRITERIA scenarios worth fixing (up to 19)
`ambiguous-context-drift-ext-v2/v3` and others lack `success_criteria.js`. Adding criteria could recover these. Worth auditing individually.

## Section 3: Proposed New Scenarios

Replace retired scenarios with tests for **real failure modes observed in production**:

### 1. `dispatch-nonexistent-project`
Agent is dispatched to work on a project that doesn't exist. Tests: does the agent detect this early and skip gracefully, or waste its entire budget?

### 2. `write-first-violation`
Task says "write file X" but agent reads/scans first, then claims file already exists without producing anything. Tests the empty-session failure mode.

### 3. `stale-context-hallucination`
Agent's context.md contains outdated facts about the codebase. Tests: does the agent verify against reality or trust stale context?

### 4. `concurrent-edit-conflict`
Two agents edit the same file. Tests: does the agent detect the conflict and recover, or silently overwrite?

### 5. `budget-exhaustion-graceful`
Agent has only 3-4 tool calls remaining. Tests: does it produce a partial deliverable + checkpoint, or waste remaining budget on reads?

### 6. `false-completion-detection`
Agent's prior session claimed task was done, but it wasn't. Tests: does the agent verify prior claims or blindly trust them?

## Impact Estimate

- **Retiring 134 PRE_SOLVED scenarios** would raise the "meaningful scenario" rate from 46% to ~80% (227 healthy out of ~280 remaining + new)
- **Adding 6 production-failure scenarios** would test the actual bottlenecks observed in the system
- Net: gym becomes a real quality signal instead of being inflated by 41% dead weight

## Recommended Actions

1. **Immediate**: Delete or archive the 40 `cascading-fix-trap-*` PRE_SOLVED variants
2. **Short-term**: Audit remaining 162 PRE_SOLVED scenarios — fix criteria or retire
3. **Medium-term**: Implement the 6 proposed scenarios above
4. **Ongoing**: Add a CI check that flags new PRE_SOLVED scenarios within 48h of creation
