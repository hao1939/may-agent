# EXP-129 Results: Channel 2 Budget Curve — Gate Stacking

**Date completed**: 2026-04-11
**Status**: COMPLETE — Hypothesis REJECTED

## Summary

Gate stacking does NOT produce the cliff function predicted by H-098 P-098c. Instead, pass rate shows a **hump curve** peaking at 3 gates (100%) and degrading only at 4 gates (67%), contradicting the prediction that 2+ gates would cause execution crowding and 3+ gates would produce near-zero completion.

## Raw Results

| Arm | Gates | Pass Rate | Avg Duration | Runs | IDs |
|-----|-------|-----------|-------------|------|-----|
| A | 1 | 6/7 (86%) | 253s | 7 | 251-256, 261 |
| B | 2 | 5/6 (83%) | 379s | 6 | 257-260, 262-263 |
| C | 3 | 6/6 (100%) | 556s | 6 | 264-265, 267-268, 274-275 |
| D | 4 | 4/6 (67%) | 755s | 6 | 281-282, 284-287 |

Note: Arm A had 7 runs (1 extra from interrupted session). All 7 included in analysis.

### Individual Run Details

**Arm A (1-gate):**
| ID | Passed | Duration | Notes |
|----|--------|----------|-------|
| 251 | ✅ | 222s | EXCELLENT |
| 252 | ✅ | 315s | EXCELLENT |
| 253 | ✅ | 224s | EXCELLENT |
| 254 | ✅ | 244s | EXCELLENT |
| 255 | ❌ | 242s | contradiction-identified=0 |
| 256 | ✅ | 253s | EXCELLENT |
| 261 | ✅ | 271s | EXCELLENT |

**Arm B (2-gate):**
| ID | Passed | Duration | Notes |
|----|--------|----------|-------|
| 257 | ✅ | 340s | EXCELLENT |
| 258 | ✅ | 384s | EXCELLENT |
| 259 | ✅ | 363s | EXCELLENT |
| 260 | ✅ | 415s | EXCELLENT |
| 262 | ✅ | 356s | EXCELLENT |
| 263 | ❌ | 416s | contradiction-identified=0 |

**Arm C (3-gate):**
| ID | Passed | Duration | Notes |
|----|--------|----------|-------|
| 264 | ✅ | 565s | EXCELLENT |
| 265 | ✅ | 585s | EXCELLENT |
| 267 | ✅ | 503s | EXCELLENT |
| 268 | ✅ | 567s | EXCELLENT |
| 274 | ✅ | 524s | EXCELLENT |
| 275 | ✅ | 592s | EXCELLENT |

**Arm D (4-gate):**
| ID | Passed | Duration | Notes |
|----|--------|----------|-------|
| 281 | ❌ | 691s | tests-pass=0 (other 4 checks passed) |
| 282 | ✅ | 798s | EXCELLENT |
| 284 | ✅ | 716s | EXCELLENT |
| 285 | ❌ | 736s | scoring failed (no checks recorded) |
| 286 | ✅ | 773s | EXCELLENT |
| 287 | ✅ | 818s | EXCELLENT |

## Check-Level Analysis

| Check | Arm A (7) | Arm B (6) | Arm C (6) | Arm D (5*) |
|-------|-----------|-----------|-----------|-----------|
| analysis-exists | 7/7 | 6/6 | 6/6 | 5/5 |
| alternatives-proposed | 7/7 | 6/6 | 6/6 | 5/5 |
| contradiction-identified | 6/7 | 5/6 | 6/6 | 5/5 |
| ordering-preserved | 7/7 | 6/6 | 6/6 | 5/5 |
| tests-pass | 7/7 | 6/6 | 6/6 | 4/5 |

*Arm D has 5 checked runs (ID 285 had scoring failure, no checks recorded)

**Key finding**: The failure mode is NOT contradiction-identification (the judgment target). Arms A and B failed on contradiction-identified (the judgment check). Arm D's failure (ID 281) was on tests-pass (implementation quality). This suggests additional gates may actually *help* with judgment but the extended execution time degrades implementation quality.

## Statistical Analysis

### Pairwise Fisher's Exact Tests (two-tailed)

| Comparison | Pass Rates | p-value | Significant? |
|------------|-----------|---------|-------------|
| A vs B | 86% vs 83% | 1.000 | No |
| A vs C | 86% vs 100% | 1.000 | No |
| A vs D | 86% vs 67% | 0.559 | No |
| B vs C | 83% vs 100% | 1.000 | No |
| B vs D | 83% vs 67% | 1.000 | No |
| C vs D | 100% vs 67% | 0.455 | No |
| ABC combined vs D | 89% vs 67% | 0.234 | No |

**No pairwise comparison is statistically significant at α=0.05.** With N=6 per arm, Fisher's exact test requires very large effect sizes to reach significance.

### Duration Analysis

| Arm | Mean | Median | Min | Max |
|-----|------|--------|-----|-----|
| A | 253s | 244s | 222s | 315s |
| B | 379s | 384s | 340s | 416s |
| C | 556s | 567s | 503s | 592s |
| D | 755s | 773s | 691s | 818s |

Duration increases ~167s per gate (linear, R² near 1.0). Each gate adds ~2.5-3 minutes of execution time. Gate processing is NOT free — it consumes real execution budget.

## Hypothesis Testing: P-098c Evaluation

### H-098 Predicted vs Observed

| Gates | Predicted | Observed | Delta |
|-------|-----------|----------|-------|
| 1 | ~100% | 86% | -14pp |
| 2 | ~50% | 83% | +33pp |
| 3 | ~10% | 100% | +90pp |
| 4 | ~0% | 67% | +67pp |

**Verdict: REJECTED.** The cliff function does not exist. The observed curve is:
- NOT a cliff (no sharp drop between any adjacent arms)
- NOT linear decay (performance *increases* from A to C before declining at D)
- BEST described as a "hump" with peak at 3 gates

### Why P-098c Failed

1. **The "execution crowding" effect (KE-064) is weaker than predicted.** At 2-3 gates, performance is maintained or improved. The forced externalization gates may serve as *planning scaffolding* that helps the agent organize its approach.

2. **Gates may have synergistic effects.** Three related analytical gates (analysis + impact + risk) may structure the agent's thinking in a way that improves judgment quality. The 100% rate at 3 gates vs 86% at 1 gate (though not significant) hints at complementary analysis.

3. **The 4-gate degradation is real but modest.** The drop from 100% to 67% at 4 gates suggests there IS a capacity limit, but it's higher than predicted. And the failure mode at 4 gates is implementation quality (tests-pass), not judgment quality (contradiction-identified).

4. **Duration is the real cost.** Even where pass rates hold, 4 gates take 3x longer than 1 gate (755s vs 253s). The practical budget constraint is wall-clock time, not attention.

## Implications

### For H-098 Attention Channel Theory

- **P-098c must be revised.** Channel 2 capacity is NOT ~1 gate per task. It's at least 3 gates with no degradation on this scenario.
- **"Execution crowding" (KE-064) may be task-specific**, not a universal Channel 2 constraint. The contradictory-requirements task with analytical gates may be uniquely suited to multi-gate processing.
- **The channel model needs a "synergy" term.** Multiple related analytical gates can *improve* performance, not just degrade it.

### For Production Guard Stacking

- **Current multi-guard approach is NOT inherently harmful.** Stacking 2-3 targeted guards is safe and may be beneficial.
- **Duration is the binding constraint.** Each gate adds ~167s. Consider whether the time cost is justified by improved judgment.
- **4+ gates show mild degradation.** The current production guard count (completeness, verification-depth, tool-schema, commit) should be evaluated for redundancy, but the theory-predicted catastrophe at 2+ gates doesn't materialize.

### For Future Experiments

- **Replication needed with larger N.** No pairwise comparison was significant at N=6. The 100% vs 67% (C vs D) had p=0.455 — would need ~N=15 per arm to detect a 33pp difference.
- **Test with different task types.** This used a judgment/contradiction task. Discovery or analytical tasks may show different curves.
- **Test with *unrelated* gates.** These gates were all analytically related. Stacking unrelated gates (analysis + style-check + performance-audit) might produce the crowding effect.

## Knowledge Elements

- **New**: Gate stacking up to 3 shows no degradation (contradicts KE-064 generalization)
- **New**: Each gate adds ~167s linear execution time
- **New**: At 4 gates, failure mode shifts from judgment to implementation quality
- **Revise KE-064**: Execution crowding at 2+ gates is NOT universal — depends on gate relevance to task
- **Revise P-098c**: Channel 2 budget is NOT ~1 gate; at least 3 analytical gates fit within budget

## Data Quality Notes

- Run 285 (Arm D) had "scoring failed" — counted as failure but true result unknown
- Arm A had 7 runs (extra from interrupted prior session); all 7 included
- All runs used the same agent (coder), same model, same framework SHA (bcab701)
