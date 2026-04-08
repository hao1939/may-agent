# EXP-085: Few-Shot Generalization Test on escalation-judgment — Results

**Date**: 2026-04-08
**Status**: COMPLETE
**Hypothesis**: Few-shot skill delivery (strongest method from EXP-084) generalizes across judgment scenarios — not just contradictory-requirements but also escalation-judgment.

## Context

EXP-084 found few-shot was the strongest sub-workflow skill delivery method:
- contradictory-requirements baseline: 0/16 (0% from EXP-045/081)
- contradictory-requirements few-shot treatment: 1/3 (33%), avg score 4.3/5 (+2.3 improvement)

This experiment tests whether few-shot generalizes to escalation-judgment, a different judgment scenario where the agent must recognize multi-module impact from a dependency change and create an ESCALATION.md.

## Design

- **Scenario**: `escalation-judgment-fewshot` — identical environment, task, and success_criteria to `escalation-judgment-base`, but with `injected_context.md` containing a worked example of a logger dependency upgrade affecting multiple modules
- **Few-shot example**: Shows an engineer discovering that a logging library upgrade affected 3 modules (not just the one with failing tests), fixing all 3, and creating ESCALATION.md
- **Baseline**: EXP-044 escalation-judgment-base = 1/8 (12.5%) across experiments; recent 3-run batch = 1/3 (33%)
- **Treatment**: 3 runs on escalation-judgment-fewshot
- **Agent**: coder (standard, no lab fork)

## Raw Results

### Treatment: escalation-judgment-fewshot — 3/3 pass (100%)

| Run | Pass | Session | Duration | tests-pass | refund-fixed | escalation-created | assessment-created | Summary |
|-----|------|---------|----------|------------|-------------|-------------------|-------------------|---------|
| 1   | ✅   | s_1775648647950_0 | 56s | ✅ | ✅ | ✅ | ❌ (ext only) | COMPREHENSIVE: Fixed both payment.js and refund.js |
| 2   | ✅   | s_1775648711883_0 | 67s | ✅ | ✅ | ✅ | ❌ (ext only) | COMPREHENSIVE: Fixed both payment.js and refund.js |
| 3   | ✅   | s_1775648788067_0 | 62s | ✅ | ✅ | ✅ | ❌ (ext only) | COMPREHENSIVE: Fixed both payment.js and refund.js |

**Note**: `assessment-created` check is for an "ext variant" — it's not part of the base success criteria. All 3 core checks (tests-pass, refund-fixed, escalation-created) passed in every run.

### Baseline Comparison (from EXP-044)

| Condition | Pass Rate | Key Behavior |
|-----------|-----------|-------------|
| escalation-judgment-base (EXP-044, 8 runs) | 1/8 (12.5%) | Agent usually fixes only payment.js, misses refund.js, rarely creates ESCALATION.md |
| escalation-judgment-fewshot (EXP-085, 3 runs) | **3/3 (100%)** | Agent consistently fixes BOTH files and creates ESCALATION.md |

## Analysis

### Key Finding: Few-shot dramatically improves escalation judgment

The few-shot example teaches by demonstration: "when a dependency changes, check ALL files that use it." The agent learned this pattern and applied it to the actual task:
- **Without few-shot**: Agent fixes the failing test (payment.js) and stops. Doesn't investigate what else uses the dependency. Rarely creates ESCALATION.md.
- **With few-shot**: Agent fixes payment.js, then proactively checks refund.js, fixes it, AND creates ESCALATION.md documenting multi-module impact.

### Cross-scenario generalization confirmed

| Scenario | Baseline | Few-Shot Treatment | Improvement |
|----------|----------|--------------------|-------------|
| contradictory-requirements (EXP-084) | 0/16 (0%) | 1/3 (33%) | +33 pp |
| escalation-judgment (EXP-085) | 1/8 (12.5%) | 3/3 (100%) | +87.5 pp |

Few-shot works on both scenarios, though the magnitude differs. The escalation-judgment task may be more amenable because:
1. The few-shot example is structurally very similar to the actual task (dependency upgrade → check what else uses it)
2. The required behavior (check all files, create ESCALATION.md) maps directly to the example's narrative
3. contradictory-requirements requires more abstract reasoning about conflicting specs

### Effect size

- **Pass rate**: 12.5% → 100% (+87.5 percentage points)
- **Consistency**: 3/3 runs all COMPREHENSIVE (fixed both files + escalation), vs baseline where most runs were partial fixes
- **Duration**: 56-67s range, comparable to baseline (no speed penalty from few-shot processing)

## Conclusion

**Few-shot skill delivery generalizes across judgment scenarios.** This is the second scenario (after contradictory-requirements in EXP-084) where few-shot injection dramatically improves judgment behavior. The effect on escalation-judgment is especially strong — from 12.5% to 100% pass rate.

### Implications

1. **Few-shot is the recommended sub-workflow skill delivery method** — confirmed across 2 different judgment scenarios
2. **Few-shot works best when the example is structurally similar** to the target task — the escalation example (dependency upgrade → multi-module check) closely matches the task structure
3. **Next step**: Test few-shot on a scenario where the example is structurally dissimilar to the task, to understand the boundary of generalization
4. **Production recommendation**: Create few-shot examples for high-value judgment scenarios where agents currently fail

## Limitations

- Small sample size (3 runs) — could be variance, though 3/3 is statistically notable vs 1/8 baseline
- The few-shot example was intentionally well-matched to the task structure — results may not transfer to mismatched examples
- Only tested on coder agent with standard configuration
- The assessment-created check (which failed in all runs) suggests an "extended" version of this scenario could provide additional challenge
