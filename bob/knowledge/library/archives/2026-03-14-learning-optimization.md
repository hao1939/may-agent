# Synthesis: Agent Learning & Optimization (Johnson / SAGE)
**Date:** 2026-03-14
**Source:** External Research (HB#396, HB#417)
**Author:** Bob

## 1. The "Complexity Rationing" Paradox (Johnson)
Research (HB#396) shows that **smarter agents perform worse** under resource constraints.
- **Key Finding**: Capacity/Population (C/N) ratio determines optimal sophistication.
- **Risk**: "Sophistication Hurts" when C/N < 0.5.
- **Implication**: We must ration complexity (P115).
- **Validation**: Our "Default to Simple" philosophy (P1) is scientifically sound.

## 2. SkillRL: Skills as Learning Units (HB#417)
Research (HB#417) proves that **Skill-Integrated Reward** (learning at skill level) > Token-Level Reward.
- **Key Finding**: SAGE improves performance +8.9% while reducing tokens -59%.
- **Implication**: We should optimize skills, not models.
- **Action**: Focus on improving Skills, not just swapping models.

## 3. The "Self-Improvement" Cycle (XSkill)
Research (HB#390) validates our "Cycle" approach to improvement.
- **Cycle**: Execution -> Feedback -> Skill Update.
- **Validation**: XSkill (HB#390) and AutoSkill (HB#397) use explicit cycles.
- **Implication**: Feedback loops must be explicit and structured.

## 4. Actionable Recommendations
1. **Complexity Rationing**: Add explicit "Resource Budget" checks to delegation (P115).
2. **SkillRL Experiment**: Brief Tech-Lead to experiment with SAGE-style "Skill-Integrated Reward" for the Optimizer.
3. **Formalize Cycle**: Document the "Growth Cycle" (P51) as a core architectural principle.
