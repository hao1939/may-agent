# KE-169: Targeted Guard Removal Shows No Effect on General Tasks

**Date**: 2026-04-13  
**Source**: EXP-152 Phase 1 (45 trials)  
**Confidence**: Medium  
**Tags**: guards, environmental-memory, null-result, H-108

## Finding

Targeted removal of individual guard artifacts (read-before-edit skill, path hallucination prevention, verification guards) from agent context does **not** produce a statistically detectable performance change on a general knowledge-integration task (`kb-discovery-baseline-126`).

| Condition | Pass Rate | Δ vs Full Context | p (Fisher) |
|-----------|-----------|-------------------|------------|
| Full Context | 53.3% (8/15) | — | — |
| no-path (removed path guard) | 60.0% (6/10) | +6.7pp | 1.000 |
| no-rbe (removed read-before-edit) | 40.0% (4/10) | −13.3pp | 0.688 |
| no-verify (removed verification) | 50.0% (5/10) | −3.3pp | 1.000 |

## Interpretation

**This is a null result on an unmatched scenario, not a falsification of H-108.** The experiment tested guard removal on a general task rather than tasks that specifically exercise each guard's failure prevention. H-108 predicts environmental memory effects on **guard-relevant** tasks — the absence of effect on a guard-irrelevant task is weakly informative.

However, the null result does provide one important constraint: **individual guard removal does not cause general performance degradation**. Whatever memory function guards serve, it's not a diffuse "all guards help all tasks" effect — it must be specific to the failure modes each guard encodes.

## Confounds

1. **SOUL.md baseline**: All lab forks include a SOUL.md that production coder lacks, adding uncontrolled variance.
2. **Scenario mismatch**: `kb-discovery-baseline-126` doesn't specifically exercise read-before-edit, path navigation, or verification quality.
3. **Bimodal scoring**: Failures cluster at 6/8 checks across all conditions, suggesting a scenario-level bottleneck unrelated to guard presence.

## Implications

- Guard effects (if they exist) are **context-specific**, not universal. A guard that prevents read-before-edit errors only matters in tasks requiring file edits.
- This aligns with KE-143 (guard redundancy) and EXP-151 (overhead inconclusive): guard impacts may be small and task-dependent.
- Phase 2 should test guard-specific scenarios to give H-108 a fair test.

## Connected Knowledge

| Entry | Relationship |
|-------|-------------|
| H-108 | Direct test — Phase 1 is weakly negative (P(H) 0.55 → 0.50) |
| EXP-151/KE-168 | Pattern: both EXP-151 and EXP-152 Phase 1 show null results on general tasks |
| KE-143 | Consistent: guard effects are context-specific, not universal |
| DD-755 | Theoretical basis — artifact memory may require guard-relevant scenarios to manifest |
