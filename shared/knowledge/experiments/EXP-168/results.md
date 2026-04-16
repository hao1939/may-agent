# EXP-168 Results: F1 Dose-Response — Partial Hints

**Date**: 2026-04-16
**Status**: COMPLETE

## Results

| Arm | Hint Level | Pass Rate | N | 95% CI |
|-----|-----------|-----------|---|--------|
| 1. Baseline | None | 0% | 56 | [0%, 6%] |
| 2. Nudge | Vague attention | 0% | 11 | [0%, 28%] |
| 3. Moderate | Problem identified | 0% | 10 | [0%, 31%] |
| 4. Full F1 | Complete analysis + fix | 100% | 15 | [78%, 100%] |

## Key Finding

**There is no partial credit — F1 is all-or-nothing.** Neither vague nudges nor moderate hints (identifying the exact problem without specifying the fix) improved performance over baseline. Only the full expert analysis with explicit fix instructions achieved any success.

This is a **step function, not a gradient**. The cascading-fix-trap-v2 scenario has a recognition bottleneck so severe that even telling the agent "the pipeline order is wrong and there's a boundary comparison bug" (arm 3) produces 0% pass rate — identical to baseline.

## Statistical Analysis

- Arms 1-3 vs Arm 4: Fisher's exact p < 0.001 (all comparisons)
- Arms 1-3 are statistically indistinguishable (all 0%)
- The 95% CIs for arms 2-3 include up to ~30% due to small N, but point estimates are 0%

## Interpretation

The cascading-fix-trap-v2 scenario requires agents to:
1. Recognize the pipeline ordering is wrong (despite CHANGELOG saying it's intentional)
2. Determine the correct order
3. Execute the swap correctly
4. Also fix the grade threshold boundary bug (revealed only after #1)

**Moderate hints (arm 3) cover steps 1-2 but not 3-4.** The agent knows WHAT is wrong but still fails. This suggests the bottleneck isn't just recognition — it's the combination of recognition + correct execution of a multi-bug cascading fix.

The full F1 analysis succeeds because it provides:
- The exact code change needed (swap lines with correct variable names)
- Explicit identification of Bug 2 and its relationship to Bug 1
- Warnings about common workarounds to avoid

## Knowledge Entry

**KE-NEW: F1 is all-or-nothing for cascading bugs.** Partial hints (vague nudges, problem identification without fix details) provide zero benefit on cascading-fix-trap-v2 (0% vs 0% baseline). Only complete expert analysis with explicit fix instructions works (100%). For recognition-bottleneck scenarios with cascading dependencies, the minimum effective dose is the full analysis. (Source: EXP-168, N=92 total runs.)

## Implications for Training

1. **F1 cannot be weakened** — there's no "cheaper" version that still works
2. **The bottleneck is execution, not just recognition** — even when told what's wrong, agents can't fix cascading bugs
3. **Future work**: Test whether step-by-step execution guidance (F2-style workflow) combined with moderate hints achieves intermediate results
