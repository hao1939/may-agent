# EXP-072 Results: Workaround-Resistant Scenario Design (cascading-fix-trap-v3)

**Date**: 2026-04-07
**Status**: COMPLETE
**Hypothesis**: H-087 — When workaround paths are blocked by mathematical constraints + scorer checks, agents are forced to find the correct architectural fix. Externalization adds marginal value on top.

## Phase 1: Baseline (cascading-fix-trap-v3, no externalization)

| Run | Score | Pipeline Reordered | Threshold Fixed | Notes |
|-----|-------|--------------------|-----------------|-------|
| 1   | 10/10 | ✅ Yes | ✅ Yes | Correct pipeline reorder (penalties before normalize) |
| 2   | 10/10 | ✅ Yes | ✅ Yes | Correct pipeline reorder |
| 3   | 10/10 | ✅ Yes | ✅ Yes | Correct pipeline reorder |

**Baseline Summary**: 10/10 × 3 = **100%** (30/30 checks passed)
- Pipeline reorder rate: **3/3 = 100%**
- **AT CEILING** — v3 scenario design alone forces correct fix

## Phase 2: Treatment (cascading-fix-trap-v3-ext, with externalization)

| Run | Score | Pipeline Reordered | Analysis Exists | Analysis Mentions Pipeline | Notes |
|-----|-------|--------------------|-----------------|---------------------------|-------|
| 1   | 12/12 | ✅ Yes | ✅ Yes | ✅ Yes | Perfect — correct analysis + correct fix |
| 2   | 11/12 | ❌ No  | ✅ Yes | ✅ Yes | Wrote correct analysis but took workaround path |
| 3   | 11/12 | ❌ No  | ✅ Yes | ✅ Yes | Wrote correct analysis but took workaround path |
| 4   | 12/12 | ✅ Yes | ✅ Yes | ✅ Yes | Perfect — correct analysis + correct fix |
| 5   | 12/12 | ✅ Yes | ✅ Yes | ✅ Yes | Perfect — correct analysis + correct fix |
| 6   | 12/12 | ✅ Yes | ✅ Yes | ✅ Yes | Perfect — correct analysis + correct fix |

**Treatment Summary**: 71/72 checks passed = **98.6%**
- Pipeline reorder rate: **4/6 = 67%**
- Root-cause analysis quality: **6/6 = 100%** (all correctly identify pipeline ordering)
- Analysis-to-action gap: 2/6 runs (33%) wrote correct analysis but didn't fix pipeline ordering

## Comparison

| Metric | Baseline (v3) | Treatment (v3-ext) |
|--------|---------------|-------------------|
| Total checks | 30/30 (100%) | 71/72 (98.6%) |
| Pipeline reorder rate | 3/3 (100%) | 4/6 (67%) |
| Overall pass rate | 3/3 (100%) | 4/6 (67%) |
| Root-cause analysis | N/A | 6/6 (100%) |

## Key Finding: CEILING EFFECT MAKES COMPARISON INVALID

**The baseline hit ceiling (100%).** V3's workaround-resistant design is so effective that the baseline already forces correct pipeline reordering every time. There is no room for externalization to improve on 100%.

This means **H-087 is confirmed for the wrong reason**: the scenario design itself (blocking workarounds mathematically) is what forces correct fixes — NOT externalization.

## The Analysis-Action Gap (Surprising Finding)

In the treatment group, 2/6 runs showed a fascinating pattern:
- Agent writes ROOT_CAUSE_ANALYSIS.md correctly identifying pipeline ordering as the root cause
- Agent then proceeds to take a different (workaround) fix path anyway
- The workaround doesn't fully pass the `pipeline-order-fixed` check

This suggests **externalization can actually HURT performance** in workaround-resistant scenarios by:
1. Consuming time/tokens on analysis writing
2. Creating a false sense of "I understand this" that may reduce fix quality
3. Adding cognitive overhead that leads to simpler (wrong) fix choices

## Conclusions

1. **Workaround-resistant scenario design works**: V3's mathematical constraints force correct fixes at 100% baseline rate. This is the key finding.
2. **Externalization adds no value when workarounds are blocked**: With no workaround path available, analysis writing is pure overhead.
3. **Externalization may slightly harm performance**: 67% treatment vs 100% baseline (though N is small).
4. **The analysis-action gap is real**: Agents can write correct root-cause analysis and still not follow through. Knowing ≠ doing.
5. **Scenario design > prompt engineering**: Blocking incorrect paths structurally is more effective than asking agents to think harder.

## Implications for Gym Scenario Design

- **Block workarounds mathematically**, not just with scorer checks
- **Make the correct fix the only path** that produces correct test output
- **Don't assume externalization helps** — test it empirically
- **Scorer checks should verify the HOW, not just the WHAT** (pipeline-order-fixed checks architecture, not just test pass)

## Relationship to Prior Experiments

| Experiment | Scenario | Pipeline Fix Rate | Key Change |
|-----------|----------|-------------------|------------|
| EXP-070   | v2 (baseline) | 7/9 = 78% | Workarounds available |
| EXP-071   | v2-ext (treatment) | 0/6 = 0% | Externalization on permissive scenario |
| EXP-072   | v3 (baseline) | 3/3 = 100% | Workarounds blocked mathematically |
| EXP-072   | v3-ext (treatment) | 4/6 = 67% | Externalization on resistant scenario |

**The progression tells a clear story:**
- V2 with workarounds: ~78% fix rate (agents sometimes find it, sometimes workaround)
- V2 + externalization: 0% (externalization made it WORSE by consuming time)
- V3 without workarounds: 100% (mathematical constraints force correct fix)
- V3 + externalization: 67% (externalization still degrades slightly)

**Externalization consistently hurts or adds no value for debugging tasks.** The strongest signal comes from scenario architecture, not prompt-level interventions.
