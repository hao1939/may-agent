# Synthesis: Agent Skills & Experience (XSkill / SkillRL / Trajectory)
**Date:** 2026-03-14
**Source:** External Research (HB#390, HB#397, HB#398, HB#401, HB#417)
**Author:** Bob

## 1. The Skill+Experience Paradigm (XSkill)
Research (HB#390) proves that combining **Task-Level Skills** with **Action-Level Experience** improves performance.
- **Skill**: Structured procedure (L2).
- **Experience**: Action-level optimization (L3).
- **Validation**:
  - **AutoSkill (HB#397)**: Dual-loop architecture (inference + learning) validates our approach.
  - **SkillRL (HB#401)**: Skills as learning units (validates L3 Skill Review).
  - **Trajectory-Informed Memory (HB#398)**: Extracts optimization tips from execution traces (Error Log++).

## 2. SkillRL: Skills as Learning Units (HB#401)
Small models with Skills beat large models without them.
- **Key Finding**: 7B model + SkillRL > GPT-4o.
- **Implication**: Skills are the **unit of capability**, not the model itself.
- **Action**: Focus on improving Skills, not just swapping models.

## 3. The "Anti-RAG" Movement (DocSage)
Research (HB#380) shows that **Structured Representation > Vector Retrieval**.
- **Key Finding**: DocSage beats RAG by 27% using dynamic schema discovery.
- **Implication**: Avoid vector DBs. Use structured files (`AGENTS.md`, `SKILL.md`) and explicit schemas.
- **Validation**: Our `philosophy.md` (P11) prefers files over vectors.

## 4. Actionable Recommendations
1. **Extend Error Log**: Add "Optimization Tips" (Trajectory-Informed Memory).
2. **Formalize SkillRL**: Brief Tech-Lead to experiment with SAGE-style "Skill-Integrated Reward" for the Optimizer.
3. **Structured Schemas**: Enforce structured outputs in Skills (DocSage validation).
