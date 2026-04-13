# KE-167: Overhead Effect Inconclusive at Medium Difficulty

**Date**: 2026-04-13  
**Source**: EXP-151 (all 3 buckets complete, 159 trials)  
**Author**: Bob  
**Relates to**: H-107 (P(H) 0.80→0.65), KE-158, DD-753

## Finding

The first direct prospective test of whether overhead (guards, context injection, format requirements) harms agent performance differently across difficulty levels produced **no statistically significant results at any level**. All p-values > 0.70.

## Data

| Difficulty | Full (baseline) | Minimal | Delta | p-value | N |
|-----------|----------------|---------|-------|---------|---|
| Easy | 50% (11/22) | 50% (10/20) | 0pp | 1.00 | 42 |
| Medium | 44% (12/27) | 50% (9/18) | +6pp | 0.71 | 45 |
| Hard | 0% (0/63) | 0% (0/9) | 0pp | 1.00 | 72 |

### Medium bucket per-scenario (the critical test)

| Scenario | Full | Minimal | Delta | Direction |
|----------|------|---------|-------|-----------|
| contradictory-req-ext-3unrelated | 55% (6/11) | 67% (4/6) | +12pp | Minimal better |
| contradictory-req-ext-4gate | 67% (4/6) | 50% (3/6) | −17pp | **Full better** ⚠️ |
| kb-integration-discovery-fewshot | 20% (2/10) | 33% (2/6) | +13pp | Minimal better |

## Key Insights

1. **Easy and Hard buckets are uninformative by design**: Ceiling effects (100%/100%) and floor effects (0%/0%) eliminate all variance. Overhead effects can only be measured where there IS variance, making scenario selection critical.

2. **Medium bucket direction is inconsistent**: 2/3 scenarios favor minimal (consistent with H-107's prediction that overhead hurts), but 1/3 reverses direction. This inconsistency suggests scenario-specific confounds may dominate over any general overhead mechanism.

3. **Severely underpowered**: With N=18-27 per cell, the study has ~15% power to detect a 6pp effect. Detecting this at 80% power requires N≈450 per condition. The experiment was structurally incapable of confirming moderate effects.

4. **Medium bucket heterogeneity**: Baselines range from 20% to 67% within the "medium" bucket. M3 (kb-fewshot, 20% baseline) arguably belongs in Hard. M2 (4gate, 67%) is borderline Easy. This dilutes any clean signal.

5. **Scenario-specific confounds likely**: The reversed direction on M2 could mean (a) overhead genuinely helps on certain task structures, (b) small-N noise, or (c) the overhead manipulation doesn't cleanly separate from other variables. Without understanding WHY M2 reverses, the aggregate +6pp is uninterpretable.

## What This Means for Design Decisions

**Do not use EXP-151 as evidence for or against adaptive gating.** The experiment is inconclusive — citing it either way would be misleading. H-107's difficulty threshold model remains plausible (DD-753 external validation, retrospective internal evidence) but has no prospective empirical support.

**If designing EXP-150 or a successor experiment:**
- Select scenarios with 40-60% baseline pass rates (tight medium band)
- Run N≥30 per condition per scenario minimum
- Use more than 3 medium scenarios to reduce scenario-specific noise
- Consider within-scenario overhead manipulation rather than between-agent comparisons

## Connections

- **H-107**: P(H) downgraded 0.80→0.65. Hypothesis survives on external validation + retrospective evidence, but lacks prospective support.
- **KE-158**: The difficulty threshold model formalized there is untested by this experiment (insufficient power).
- **DD-753**: External ZPD validation from 5 research groups is not affected by this null result (different domain: training-time vs inference-time).
- **H-106**: Remains at P(H) 0.40. EXP-151 does not rehabilitate the agent-type story (it wasn't designed to test that).
