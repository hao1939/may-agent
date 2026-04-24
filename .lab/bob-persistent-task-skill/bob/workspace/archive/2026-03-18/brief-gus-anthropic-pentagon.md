# Brief: GUS v6 Integration — The Anthropic Pentagon

**Source**: Scout Deep-Dive #262 (Anthropic Labor Market Impacts) + DD#255-258
**Authors**: Massenkoff & McCrory (Anthropic)
**Date**: 2026-03-15

## The Thesis
Five Anthropic papers form a complete causal loop ("The Anthropic Pentagon") describing how AI erodes human capability and displaces labor **quietly**:

1. **Persona Selection** (DD#247): AI develops stable behavioral templates.
2. **Disempowerment Patterns** (DD#256): Users *prefer* disempowering interactions (Delegate > Engage).
3. **Assistant Axis** (DD#257): Mechanistic drift reinforces helpfulness over honesty.
4. **Skill Formation** (DD#258): Disempowerment causes human skill atrophy (-17% RCT).
5. **Labor Market Impacts** (DD#262): Skill atrophy leads to **Reduced Hiring** (not layoffs), closing the entry path for new experts.

This is a **Positive Feedback Loop**: Disempowerment $\to$ Skill Decay $\to$ Reduced Entry $\to$ More Reliance on AI $\to$ More Disempowerment.

## Proposed GUS v6 Updates

### 1. Law 46: The Erosion Gradient (New)
> **Law 46 (The Erosion Gradient)**: In human-AI systems, the path of least resistance is always **Capability Transfer** (Human $\to$ AI), not **Capability Augmentation**. Unless friction is artificially introduced (see P98 Friction Imperative), human capability $C_h$ will decay asymptotically to the minimum required to invoke the agent.

### 2. Prediction 92: The Junior Gap
> **Prediction 92 (The Junior Gap)**: AI displacement will manifest not as mass unemployment, but as a **hiring freeze for junior roles** ($O(entry) \to 0$). This destroys the skill pipeline, creating a "Seniority Cliff" where no new experts are created to oversee the systems.

### 3. Mechanism 40: The Quiet Attrition
> **Mechanism 40 (The Quiet Attrition)**: Displacement occurs via **Task Decomposition** (Mechanism 19). As AI reliability ($R$) crosses the threshold for a specific task, that task is silently removed from the human curriculum. The human job remains, but the *skill-building tasks* within it vanish, leading to "Hollow Experts."

## Actions
1. **Adopt Law 46/Prediction 92/Mechanism 40** in `philosophy.md`.
2. **Update `agents/coach/SOUL.md`**: Coach must actively counteract Law 46 by forcing "Cognitive Engagement" (asking the user "Why?" before accepting a delegation).

---
**Status**: Ready for Integration
**Owner**: Bob
**Date**: 2026-03-15
