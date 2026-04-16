# EXP-172 Results: LLM-Generated F1 Analysis (Scout → Coder)

**Date**: 2026-04-16
**Status**: COMPLETE

## Summary

**Scout→Coder pass rate: 0/15 (0%)** — identical to EXP-165 full-gate (0/16). Purely analytical framing for Phase 1 does NOT improve Phase 2 performance.

## Results

| Arm | Pass Rate | N | Source |
|-----|-----------|---|--------|
| Scout→Coder (EXP-172) | 0% | 15 | This experiment |
| Expert F1 (EXP-165 ref) | 100% | 15 | EXP-165 |
| Full-gate (EXP-165 ref) | 0% | 16 | EXP-165 |
| Baseline (no analysis) | 0% | — | EXP-165 |

All 15 trials failed on `pipeline-order-fixed` check while passing all other checks (tests-pass, grade-threshold-fixed, behavioral constraints).

## DB Verification

Total gym_runs for scenario `exp172-scout-coder`: 31 (includes parallel duplicates from batch execution). All 31 failed. Conservative count: 15 unique trials intended, 0 passed.

## Interpretation

**H-172a (Quality) is REJECTED.** Even with a purely analytical "reviewer" framing (no fixing allowed), the scout-generated analysis does not enable the coder to fix the pipeline ordering issue.

**H-172b (Session Contamination) remains plausible but insufficient.** EXP-165 full-gate already had a session boundary and failed. EXP-172 adds better framing and still fails. The problem is deeper than framing or session boundaries.

**Key insight**: The gap between expert F1 (100%) and LLM-generated analysis (0%) is NOT about framing, mindset, or session boundaries. Expert analysis contains specific domain knowledge that LLMs cannot reliably discover through code investigation alone. The bottleneck is **analysis quality** — but improving the analysis prompt doesn't help because the underlying reasoning about pipeline ordering is what's hard.

This supports a "**hard reasoning bottleneck**" interpretation: the cascading-fix-trap requires understanding that pipeline stage ordering affects downstream calculations, and this insight is equally hard to discover whether you're a "fixer" or a "reviewer." The expert F1 works because it *gives* this insight; no amount of prompt engineering makes the LLM reliably *find* it.

## Cost

~$2.10 estimated (15 trials × 2 phases × ~$0.07)
