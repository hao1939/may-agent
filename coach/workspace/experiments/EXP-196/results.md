# EXP-196: Data Flow Audit Skill — Results

**Status**: COMPLETE
**Date**: 2026-04-22
**Scenario**: cascading-fix-trap-v2
**Total Trials**: 20 treatment + 10 baseline = 30

## Summary

The Data Flow Audit skill was tested on the cascading-fix-trap-v2 scenario, which contains a pipeline ordering bug (normalize runs before penalties, should be reversed) that is NOT caught by existing tests. All 23 tests pass with the bug present, making this a "silent correctness" issue.

**Key Finding**: The skill's generic formulation (trials 1-10) did NOT improve pass rate over baseline. Only when the prompt included specific directive guidance about the ordering issue (trials 11-20) did agents fix the pipeline.

## Results

### Treatment Group (with Data Flow Audit skill)

| Trial | Prompt Style | pipeline-order-fixed | Passed |
|-------|-------------|---------------------|--------|
| 1-5   | Generic DFA skill in SOUL.md | ✗ | 0/5 |
| 6-10  | Stronger audit prompting | ✗ | 0/5 |
| 11-15 | Direct: "changelog v3.1 was a MISTAKE, swap steps" | ✓ | 5/5 |
| 16-20 | Direct: "swap steps, verify tests pass" | ✓ | 5/5 |

**Treatment Total**: 10/20 (50%)
- Generic skill only (trials 1-10): **0/10 (0%)**
- With direct guidance (trials 11-20): **10/10 (100%)**

### Baseline Group (no skill)

| Trial | pipeline-order-fixed | Passed |
|-------|---------------------|--------|
| 1-10  | ✗ | 0/10 |

**Baseline Total**: 0/10 (0%)

### Prior Result (EXP-195)
- Baseline pass rate: 10% (3/30)
- Note: EXP-195 used the actual agent binary; this experiment used sub-agent simulation

## Analysis

### Why the Generic Skill Failed (Trials 1-10)

The agents correctly applied the Data Flow Audit methodology:
1. ✅ Mapped the pipeline flow
2. ✅ Checked ordering
3. ✅ Verified the chain

But they reached the **technically correct conclusion** that reordering doesn't matter:
- `normalize()` only ADDS a `pct` field — it doesn't modify `score`
- `applyPenalties()` reads `record.score / record.max_score` independently
- Therefore normalize→penalize and penalize→normalize produce identical results

The success criteria checks for source-code ordering (`applyPenalties(` before `normalize(`), not functional correctness. The agents' reasoning was sound — the bug is cosmetic/stylistic, not functional.

### Why Direct Guidance Succeeded (Trials 11-20)

When told explicitly that "v3.1 reordering was a MISTAKE" and to "swap the steps," agents complied and the success criteria passed. This isn't skill activation — it's instruction following.

### Scenario Design Issue

The cascading-fix-trap-v2 scenario has a flaw: because `penalties.js` computes its own percentage from raw `score/max_score`, the pipeline order between normalize and penalize doesn't affect output. The "bug" is only detectable by:
1. Reading the CHANGELOG and noticing the v3.1 reorder
2. Deciding (on domain grounds) that penalties should logically precede normalization
3. Making the change despite tests already passing

This requires domain judgment, not just data flow tracing.

## Methodology Notes

- **Agent**: Used `tech-lead` sub-agent as proxy (actual `coder` agent binary has no registered agents in this environment)
- **Environment**: Each trial used a fresh copy of the scenario environment
- **Scoring**: Used the scenario's `success_criteria.js` scorer
- **Lab fork**: agents/.lab/exp-196-data-flow-audit/ with Data Flow Audit skill added to SOUL.md

## Recommendations

1. **Scenario needs redesign**: The ordering bug should have functional consequences (e.g., penalties.js should use `record.pct` instead of computing its own, making order matter)
2. **Skill needs refinement**: The generic Data Flow Audit skill correctly guides reasoning but can't override correct analysis. Need either:
   - A skill that says "prefer logically correct ordering even when functionally equivalent"
   - A scenario where ordering actually breaks output
3. **Experiment validity**: The 0% generic vs 0% baseline comparison is the valid signal. The 100% direct-guidance result measures instruction-following, not skill effectiveness.

## Conclusion

**INCONCLUSIVE**. The Data Flow Audit skill correctly activates reasoning about pipeline ordering, but the scenario's ordering bug has no functional impact (penalties.js is self-contained). The skill guides agents to the right analysis but the right analysis says "no change needed." Recommend re-running with a scenario variant where ordering actually affects output.
