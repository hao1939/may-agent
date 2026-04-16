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

## Replication with Clean Environments (EXP-172b)

**Date**: 2026-04-16 (later same day)
**Context**: EXP-173 discovered that commit 3a47692c had contaminated the exp172-scout-coder environment — `grades.js` already had `>=` (the fix) instead of `>` (the bug), and `homework.js` had workaround code. The pipeline ordering bug was still present, but the grade threshold bug was pre-fixed.

### Environment Fix
Restored clean buggy versions of `grades.js` and `homework.js` from `cascading-fix-trap-v2` base scenario. Verified both bugs are present before running.

### Results

| Arm | Pass Rate | N | Notes |
|-----|-----------|---|-------|
| Scout→Coder (clean env) | **0/12 (0%)** | 12 | All fail on `pipeline-order-fixed` |
| Baseline (no analysis) | **0/5 (0%)** | 5 | Confirms scenario discriminates |

All 12 clean-env trials show the exact same pattern as the original 15:
- ✓ all-tests-pass (agent makes tests pass via workaround)
- ✗ pipeline-order-fixed (agent does NOT reorder pipeline stages)  
- ✓ grade-threshold-fixed (agent fixes `>` to `>=`)

### Interpretation

**Original EXP-172 result CONFIRMED** — contamination did not affect the outcome. Even with both bugs properly present, the scout→coder approach fails at 0%. The contamination only affected `grades.js` threshold, which was already being fixed by the coder anyway.

The core finding stands: **LLM-generated analysis cannot reliably identify pipeline ordering as the root cause**, regardless of environment state. The hard reasoning bottleneck is real.

**Contrast with EXP-173**: EXP-173 showed that human-written hints (even moderate) achieve 100% on clean envs. The discrimination is specifically between LLM-generated vs human-written analysis, not between contaminated vs clean environments.

### DB References
- Clean-env runs: gym_runs IDs 2114-2125 (scenario=exp172-scout-coder, all failed)
- Baseline runs: gym_runs IDs 2109-2113 (scenario=cascading-fix-trap-v2, all failed)

## Cost

~$2.10 estimated (15 trials × 2 phases × ~$0.07) + ~$1.70 for 12 replication trials
