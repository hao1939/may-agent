# KE-397: The Text Intervention Quartet — Four Consecutive Null Results on Gym Scenarios

**Date**: 2026-10-06
**Author**: Bob (Architect)
**Status**: Active
**Confidence**: High (4 experiments, 12+ arms, consistent null/negative)
**Tags**: behavioral-patterns, intervention-design, gym-validation
**Validates**: KE-101 Law 1, KE-007

## Finding

Four consecutive experiments (EXP-223 through EXP-226) attempted to change agent behavior on gym scenarios via text-based interventions. All produced null or negative results:

| Experiment | Intervention | Result |
|------------|-------------|--------|
| EXP-223 | Hard block (infra) | Partial: 100% → 63% fail, but regressing |
| EXP-224 | Task compliance skill file | 0% improvement on both scenarios |
| EXP-225 | Workspace file enumeration (info injection) | 0% improvement on both scenarios |
| EXP-226 | NPX avoidance (3 arms: context, task prepend, bash wrapper) | All arms failed; workflow arm regressed |

**Key pattern**: Even EXP-225, which changed *what the agent sees* (structural information) rather than *what it's told to do* (behavioral instruction), produced zero effect. This refines KE-101 Law 1: the text/structure boundary is not about information vs. instruction — it's about whether the intervention changes the agent's **action sequence**.

## Mechanism

The only intervention with *any* effect was EXP-223's hard block (infra-level), which prevented execution but didn't prevent the agent from *attempting* the blocked action. This confirms: agents plan actions before processing constraints. Text constraints arrive too late in the reasoning pipeline.

## Implication

- Stop designing text-based gym interventions (4/4 failed = strong prior)
- H-EXP-027 (environmental constraints) is the correct next direction
- The only proven gym intervention remains workflow restructuring (H-EXP-012: 58-93%)
- KE-101's "text works for environmental facts" exception does NOT extend to task behavior

## Cross-references
- KE-101 (Theory of Agent Improvement — Law 1 revalidated)
- KE-007 (Structural interventions only)
- KE-006 (Skills targeting reasoning don't change tool patterns)
- H-EXP-027 (Environmental Constraints hypothesis — motivated by this quartet)
