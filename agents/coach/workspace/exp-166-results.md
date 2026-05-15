# EXP-166: Content-First vs Process-First Guard Comparison — Results

**Date**: 2026-04-16
**Design**: 2x2 factorial (F1: content-first, F2: process-first) × 2 scenarios × 15 trials/arm

## Arms
- **Baseline**: No intervention (original scenario)
- **F1-only** (content-first): Inject worked examples/knowledge into prompt
- **F2-only** (process-first): Force ANALYSIS.md production in Phase 1, then delete it before Phase 2
- **F1+F2**: Both content injection AND forced analysis production

## Results (N=15 per arm, most recent 15)

| Arm | sql-injection | cascading-fix-trap-v2 |
|-----|--------------|----------------------|
| Baseline | 15/15 (100%) | 0/15 (0%) |
| F1-only | 15/15 (100%) | 15/15 (100%) |
| F2-only | 15/15 (100%) | 0/15 (0%) |
| F1+F2 | 15/15 (100%) | 1/15 (7%) |

## Analysis

### sql-injection scenario
All arms at ceiling (100%). Baseline already passes — this scenario doesn't discriminate between interventions. Not useful for this experiment.

### cascading-fix-trap-v2 scenario (the discriminating case)

| Arm | Pass Rate | Δ vs Baseline |
|-----|-----------|--------------|
| Baseline | 0% | — |
| F1 (content-first) | **100%** | **+100pp** |
| F2 (process-first) | 0% | +0pp |
| F1+F2 (combined) | 7% | +7pp |

**Key findings:**

1. **Content-first (F1) is dramatically effective**: 0% → 100%. The worked examples/knowledge injection completely solves the cascading bug scenario.

2. **Process-first (F2) has zero effect**: Forcing the agent to write ANALYSIS.md doesn't help at all. The agent writes analysis but still fails to fix the root cause. This confirms **KE-180 (Completion Illusion)** — analysis artifacts don't transfer to implementation.

3. **Combining F1+F2 is WORSE than F1 alone**: 100% → 7%. This is a catastrophic interaction effect. Adding the forced analysis step to content injection destroys the benefit.
   - This strongly confirms **KE-123 (never stack interventions)**: combining two interventions degrades performance by ~93pp here.
   - Hypothesis: The Phase 1 analysis requirement consumes tokens/attention, and the phase boundary disrupts the agent's momentum from the content examples.

## Conclusions

1. **Content injection (worked examples) is the effective mechanism** — it gives the agent the recognition pattern needed to identify cascading root causes.
2. **Forced process (write-then-delete analysis) is inert** — going through the motions of analysis without the right knowledge produces nothing.
3. **Stacking interventions is actively harmful** — the process overhead interferes with the content benefit.

## Knowledge Entry Candidates
- **KE-NEW**: Content-first guards (worked examples) outperform process-first guards (forced artifacts) by +100pp on recognition-bottleneck tasks. Process-first guards have zero independent effect.
- Reinforces **KE-123**: Stacking degradation confirmed with 93pp loss (F1+F2 vs F1-alone).
- Reinforces **KE-180**: Analysis artifacts don't transfer to implementation — 0% pass rate even with forced ANALYSIS.md.

## Statistical Notes
- sql-injection: All arms at ceiling, Fisher's exact p=1.0 for all comparisons (no discriminating power)
- cascading F1 vs baseline: 15/15 vs 0/15, Fisher's exact p < 0.0001
- cascading F2 vs baseline: 0/15 vs 0/15, p=1.0 (no effect)
- cascading F1+F2 vs F1: 1/15 vs 15/15, Fisher's exact p < 0.0001 (stacking is significantly worse)
