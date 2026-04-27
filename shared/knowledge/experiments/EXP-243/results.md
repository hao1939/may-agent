# EXP-243 Phase 0: Preliminary Results

**Date**: 2026-05-25
**Status**: PHASE-0-PARTIAL (17/24 trials completed, misleading-test-fix timed out)

## Summary

**H-204 NOT SUPPORTED in initial data. Expansion-style skills performed WORSE on optimize-deploy-config (0/3 vs 3/3), suggesting constraint language may be beneficial for procedural/verification-heavy tasks.**

## Raw Results (17/24 trials)

| Scenario | Control (pass/total) | Treatment (pass/total) | Delta |
|----------|---------------------|----------------------|-------|
| cascading-fix-trap | 2/3 (67%) | 3/3 (100%) | +33pp |
| optimize-deploy-config | 3/3 (100%) | 0/3 (0%) | **-100pp** |
| knowledge-entry-creation | 2/2* (100%) | 3/3 (100%) | 0pp |
| misleading-test-fix | — | — | (timed out) |

*knowledge-entry-creation control trial 3 not recorded (likely ran but CSV write was interrupted)

**Aggregate**: Control 7/8 (87.5%), Treatment 6/9 (66.7%) → Treatment is **-21pp worse**

## Key Findings

### 1. Expansion style HURT optimize-deploy-config (0/3 vs 3/3)
This is the strongest signal. optimize-deploy-config requires precise verification and careful editing — exactly the tasks where constraint language ("always read before edit", "never claim done without verification") may provide necessary guardrails. The expansion-style rewrites ("think about...", "consider...") may have been too permissive, allowing the agent to skip verification steps.

**This is evidence AGAINST H-204**: For procedural/verification tasks, constraint language may be *functional*, not harmful. KE-403's "instruction collapse" mechanism may not apply to behavioral constraints the way it applies to content constraints.

### 2. Expansion style HELPED cascading-fix-trap (+33pp)
Cascading-fix-trap requires creative problem-solving (finding a hidden bug behind a misleading comment, then pivoting to fix a second bug). The expansion framing ("what does this error tell you?", "what alternative approach could work?") may have preserved planning quality here.

**This supports a nuanced version of H-204**: Expansion style may help on *diagnostic/creative* tasks but hurt on *procedural/verification* tasks.

### 3. No difference on knowledge-entry-creation
Both arms passed all trials. This scenario may be at ceiling regardless of skill framing.

## Interpretation

The instruction collapse mechanism (KE-403) may be **task-type moderated**:
- **Creative/diagnostic tasks** (cascading-fix-trap): Constraint language may trigger collapse by narrowing the planning space. Expansion style preserves exploration.
- **Procedural/verification tasks** (optimize-deploy-config): Constraint language provides necessary structure. "Always X before Y" is a useful procedural guide, not a creativity-limiting constraint.

This suggests we should NOT wholesale reframe all skills to expansion style. Instead:
- **Keep constraint framing** for procedural skills (verification, coder-edit-discipline)
- **Consider expansion framing** for diagnostic/creative skills (error-handling's analysis patterns)
- **Test the interaction** with more trials before making any production changes

## Next Steps

1. ~~Complete misleading-test-fix trials~~ (timed out — may need shorter timeout or simpler scenario)
2. Run 2 more trials per arm on cascading-fix-trap and optimize-deploy-config to confirm signals
3. If optimize-deploy-config result holds, write up as **negative result** refining H-204
4. Investigate whether the effect is driven by skill *length* (expansion is shorter) rather than *style*

## Methodological Notes

- Checks_passed/checks_total not captured (JSON parsing issue in runner — only `passed` boolean extracted)
- Task was prepended with full skill text, making control tasks significantly longer (226+147 lines for error-handling+verification) vs treatment (109+72 lines). Length difference is a confound.
- 3 trials per arm is underpowered. Need 5+ for significance testing.

## Cost
~$2-3 (17 gym runs × ~$0.15 each)
