# EXP-210 Results: Schema-Organized Context vs. Flat List Context

**Date**: 2026-07-30
**Status**: COMPLETED — NO SIGNIFICANT DIFFERENCE (ceiling effect)
**Hypothesis**: H-077

---

## Summary

**No difference detected.** Both schema-organized and flat-list context achieve identical performance on all tested scenarios. The read-before-edit baseline has risen to 100% (was 54.8% when experiment was designed), creating a ceiling effect that prevents detecting any schema benefit.

## Results

### Scenario 1: read-before-edit

| Arm | C1 Pass Rate | N |
|-----|-------------|---|
| A (Baseline / flat list) | 20/20 (100%) | 5 trials × 4 checks |
| B (Schema-organized) | 40/40 (100%) | 10 trials × 4 checks |

**Historical baseline**: 54.8% (N=31) — set months ago, likely before model improvements.

### Scenario 2: compound-edit-verification

| Arm | Overall Pass | Checks Passed | N |
|-----|-------------|---------------|---|
| A (Baseline) | 0/5 (0%) | 3/7 per trial | 5 |
| B (Schema) | 0/5 (0%) | 3/7 per trial | 5 |

Both arms fail the same 4 checks (P1-tiered-rates, P2-tiered-values, P3-unit-tests, P5-discount-tax-rate) and pass the same 3 (P4-integration, P6-formatter, C2.3-verify). This is a task-difficulty ceiling, not a context-format effect.

## Interpretation

1. **Ceiling effect on easy scenarios**: The model has improved since baselines were set. read-before-edit is now trivially easy (100% for both arms). Schema can't improve what's already perfect.

2. **Floor effect on hard scenarios**: compound-edit-verification fails on task-completion checks (actual coding bugs), not convention checks. Context format is irrelevant to coding ability.

3. **H-077 status**: **INCONCLUSIVE**. The experiment cannot discriminate because the gym scenarios no longer have the variance needed. The hypothesis may still be true for production (where context windows are longer and tasks more varied), but our current gym setup cannot test it.

## Recommendations

- **H-077**: Keep at current P(H) — neither confirmed nor falsified. To test properly, need either: (a) harder convention scenarios where current pass rate is 30-70%, or (b) production A/B test (EXP-212 approach).
- **Baseline refresh**: All gym baselines should be re-measured periodically. The 54.8% figure is stale.
- **EXP-212 (production A/B)**: Still the right approach for testing schema context — production has the variance gym lacks.
