# EXP-129: Channel 2 Budget Curve — Forced Externalization Gate Stacking

**Date**: 2026-04-10
**Status**: RUNNING
**Hypothesis**: H-098 P-098c — Channel 2 capacity is ~1 intervention per task
**Executor**: Coach
**Planned by**: EXP-E2 in H-098

## Research Question

How many forced externalization (Ch2) gates can we stack on a single task before performance degrades? Is there a cliff function (sharp drop) or linear decay?

## Background

- H-098 predicts Ch2 budget is ~1 gate per task (P-098c)
- KE-064 documents execution crowding at 2+ gates
- EXP-127 showed 1 gate → 100% on contradictory-requirements (N=10 cumulative)
- Production already stacks multiple guards: completeness-guard, verification-depth-guard, tool-schema-guard, commit-guard
- Understanding the budget curve is critical for production guard stacking decisions

## H-098 Prediction (P-098c)

> Two gates in sequence should produce execution crowding. Three gates should produce near-zero task completion. Expect cliff function, not linear decay.

Specific predictions:
- 1 gate: ~100%
- 2 gates: ~50%
- 3 gates: ~10%
- 4 gates: ~0%

## Design

### Scenario
`contradictory-requirements-ext` and variants. Chosen because:
- 0% baseline (maximum discrimination)
- 100% with 1 gate (proven Ch2 effectiveness)
- Clear success criteria (5 checks)

### Arms

| Arm | Gates | Scenario | Description |
|-----|-------|----------|-------------|
| A | 1 | `contradictory-requirements-ext` | Existing: ANALYSIS.md gate only |
| B | 2 | `contradictory-requirements-ext-2gate` | + IMPACT_ANALYSIS.md (downstream impact assessment) |
| C | 3 | `contradictory-requirements-ext-3gate` | + RISK_ASSESSMENT.md (implementation risk catalog) |
| D | 4 | `contradictory-requirements-ext-4gate` | + IMPLEMENTATION_PLAN.md (step-by-step plan) |

### Gate Descriptions (all plausibly relevant)

1. **ANALYSIS.md** (existing): Feasibility analysis — list constraints, calculate if they can be simultaneously met
2. **IMPACT_ANALYSIS.md** (new): Downstream impact — who is affected by each design choice, what breaks if we prioritize throughput vs ordering
3. **RISK_ASSESSMENT.md** (new): Risk catalog — enumerate implementation risks, likelihood, mitigation strategies
4. **IMPLEMENTATION_PLAN.md** (new): Step-by-step plan — ordered list of changes with verification criteria for each step

### Sample Size
- N=6 per arm (24 total runs)
- Same success criteria for all arms (the 5-check suite from contradictory-requirements-ext)

### Primary Metric
- Overall pass rate (≥4/5 checks with cores met)

### Secondary Metrics
- Contradiction detected rate (check 4)
- Task completion (did agent finish both phases?)
- Individual check pass rates
- Duration

### Statistical Plan
- Fisher's exact test for pairwise comparisons
- Plot pass rate vs gate count (expect cliff function per H-098)
- Compare to H-098 predicted curve

## Success Criteria for the Experiment

The experiment succeeds (informative) if:
1. We can distinguish at least 2 different pass rates across the 4 arms
2. Total N is sufficient for statistical significance on the key comparison
3. Results inform the practical question: "how many guards should we stack?"

## Files

- Scenarios: `agents/gym/scenarios/contradictory-requirements-ext-{2,3,4}gate/`
- Results: `agents/shared/knowledge/experiments/EXP-129/results.md`
- Hypothesis: `agents/shared/knowledge/hypotheses/H-098-attention-channel-theory-intervention-effectiveness.md`
