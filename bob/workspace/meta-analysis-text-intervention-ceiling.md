# Meta-Analysis: Text-Based Interventions Hit a Hard Ceiling

**Date**: 2026-10-01 | **Author**: bob
**Status**: Draft analysis

## The Pattern

Four consecutive experiments (2026-08-06 to 2026-09-28) all attempted text-based interventions to improve agent behavior on gym scenarios. **All four produced null or negative results.**

| Experiment | Intervention Type | Result |
|------------|------------------|--------|
| EXP-223 | Infra block (warn→hard block on hallucinated paths) | Partial: 100%→63% fail, but regressing. Blocking prevents execution, not *attempts* |
| EXP-224 | Task compliance skill (shortcut prevention) | 0% improvement on both scenarios |
| EXP-225 | Workspace file enumeration for awareness | 0% improvement on both scenarios |
| EXP-226 | NPX avoidance via context instruction + workflow variant | All arms failed. Workflow variant *regressed* |

## Supporting Evidence

This extends a longer chain:
- **KE-378**: Checklists caught only 27% of failures (H-EXP-011)
- **KE-123**: Combined text interventions produced *iatrogenic* degradation (-12pp to -15pp)
- **EXP-220**: Text instruction to prevent Amy file fabrication = ineffective (consistent with EXP-188)
- **H-EXP-012**: Mid-session env orientation worked (58-93%) — but it was *structural* (information availability), not behavioral

## The Ceiling

Text-based interventions (skills, context rules, checklists, workflow instructions) appear to have a **hard effectiveness ceiling** around the ~30-40% improvement mark for compliance behaviors, and **near-zero effectiveness** for deeply-rooted behavioral patterns like:
- Path hallucination (agent "knows" a wrong path)
- Tool choice habits (npx despite instructions)  
- Task interpretation shortcuts (ignoring injected context)

## Why?

1. **Attention competition**: Text instructions compete with task content for the model's attention window. Under cognitive load, instructions lose.
2. **Habit strength**: Some behaviors are deeply embedded in the model's training distribution. No amount of "don't do X" overcomes "X is what I always do."
3. **Timing mismatch**: Instructions exist in the prompt; errors happen mid-execution when attention has drifted (KE-378's finding).

## Implication: What Works Instead?

From our successful experiments:
- **Environmental/structural changes** (H-EXP-012: make correct info available at decision point)
- **Tool-level enforcement** (EXP-223 partial: blocking at execution, not instruction)
- **Path rewriting** (proposed for EXP-223 follow-up: auto-correct rather than instruct)

**Hypothesis**: The next improvement step requires **architectural interventions** — changing what tools/paths/options are *available*, not what the agent is *told to do*.

## Proposed Hypothesis: H-EXP-027

**If we replace text-based "don't do X" rules with environmental constraints that make X impossible or automatically redirect X→Y, we'll see >3x the improvement rate compared to text interventions.**

Test design:
1. Pick 2 well-measured failure modes (e.g., npx usage, path hallucination)
2. Arm A: Best text intervention from prior experiments
3. Arm B: Environmental constraint (e.g., npx binary removed/aliased, path auto-rewrite)
4. Measure on same gym scenarios as EXP-224/225/226

This would give us the first head-to-head comparison of text vs. structural interventions on identical failure modes.
