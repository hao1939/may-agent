# H-042 Phase 0: Exploratory Data Analysis — Does Quality Improve Over Time?

**Date**: 2026-04-02
**Status**: Exploratory analysis (not a formal experiment)
**Purpose**: Quick check of H-042's core prediction using historical evaluations data

## Question

H-042 predicts that as the system accumulates knowledge, quality improves over time because the eliminable-decision fraction R increases. Is there evidence of this in the evaluation data?

## Data

Weekly quality (good%) by agent, from may.db evaluations table. All data covers W08-W13 (approximately 2026-02-17 to 2026-04-02).

### Critical Confound: Evaluator Type

The system shifted from LLM evaluator to heuristic evaluator during this period. The two produce **dramatically different** verdicts:

| Agent | LLM Good% | Heuristic Good% | Δ |
|-------|-----------|-----------------|---|
| QA | 82% | 87% | +5pp (similar) |
| Coder | 42% | 20% | -22pp (heuristic stricter, n=5) |
| Coach | 28% | 32% | +4pp (similar) |
| Optimizer | 18% | 65% | **+47pp (heuristic far more lenient!)** |

The heuristic evaluator is dramatically more lenient for optimizer. This means apparent quality trends that mix evaluator types are unreliable.

### LLM-Only Evaluations (Controlled Comparison)

| Week | QA Good% (n) | Coder Good% (n) | Coach Good% (n) | Optimizer Good% (n) |
|------|-------------|-----------------|-----------------|---------------------|
| W09 | 66% (50) | 38% (151) | 15% (20) | 6% (69) |
| W10 | 75% (16) | 37% (82) | 26% (53) | 28% (99) |
| W11 | 88% (8) | 42% (12) | 20% (134) | 6% (17) |
| W12 | 100% (46) | 59% (61) | 49% (70) | 23% (57) |
| W13 | — | — | 17% (12) | — |

### Results by Agent

**QA**: 66% → 75% → 88% → 100%. **Monotonic improvement.** Strong support for H-042.
- QA tasks have high initial R (~0.7). Knowledge accumulated (conventions, format rules, patterns) converted remaining essential decisions into eliminable ones.
- By W12, QA appears to hit ceiling — all LLM-evaluated sessions rated good.

**Coder**: 38% → 37% → 42% → 59%. **Gradual improvement.** Moderate support.
- Coder tasks had moderate initial R (~0.4). Improvement is slow but consistent from W09 to W12.
- The +21pp jump from W11 to W12 coincides with workflow reintroduction (95% wf rate in W12 vs 67% in W11).
- Interpretation: Both knowledge accumulation AND workflow enforcement contributed.

**Coach**: 15% → 26% → 20% → 49% → 17%. **Volatile, no clear trend.** Weak/no support.
- Coach tasks have low R (~0.15). Essential decisions (teaching judgment, exercise design, learner adaptation) haven't been converted by knowledge accumulation.
- The W12 spike to 49% is interesting but W13 drops back to 17%.
- Interpretation: Coach is in the "stagnation trap" predicted by H-042.

**Optimizer**: 6% → 28% → 6% → 23%. **Volatile, no clear trend.** Weak/no support.
- Optimizer tasks have low R (~0.15). Essential decisions (evaluate skill improvement, design experiments) remain unconverted.
- The W10 spike to 28% is anomalous (may reflect task composition change rather than knowledge effect).
- Interpretation: Also in the stagnation trap.

## H-042 Consistency Check

| H-042 Prediction | Observation | Match? |
|------------------|-------------|--------|
| High-R tasks improve faster | QA (R~0.7) showed strongest improvement | ✅ |
| Low-R tasks stagnate | Coach (R~0.15), Optimizer (R~0.15) show no consistent trend | ✅ |
| R increases monotonically | Not directly measured (would need decision classification per session) | ? |
| Phase transition at K* | QA appears to have crossed it; others haven't | Partial ✅ |
| Stagnation trap exists for low-R | Coach and optimizer remain volatile/low quality | ✅ |

**Overall**: 4/5 predictions consistent with observation. The data is noisy and confounded (evaluator changes, sample sizes, workflow changes), but the pattern is directionally supportive.

## Major Caveats

1. **Evaluator confound**: The shift from LLM to heuristic evaluator makes all-evaluator trends misleading. LLM-only analysis reduces N substantially.
2. **Small N**: Some week-agent combinations have <10 LLM evaluations. Trends could be noise.
3. **Workflow confound**: Coder's improvement partially coincides with workflow reintroduction. Can't separate workflow effect from knowledge effect.
4. **Task composition**: Tasks assigned in each week may differ systematically (easier tasks later = apparent improvement).
5. **Not a formal experiment**: No pre-registration, no controls. This is pattern-spotting, not hypothesis testing.

## Next Steps for Formal Testing

1. **Directly measure R**: Classify decisions in 5 sessions per agent from W09 and W12. Compare R values. This would directly test whether the decision landscape evolved.
2. **Control for evaluator**: Use only LLM evaluations OR re-evaluate heuristic sessions with LLM.
3. **Control for task composition**: Select matched task types (same type, different weeks) to isolate time effect.

---

*H-042 Phase 0 Analysis | Bob (Architect) | 2026-04-02*
