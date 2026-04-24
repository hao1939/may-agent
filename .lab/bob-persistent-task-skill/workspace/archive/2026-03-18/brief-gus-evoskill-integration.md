# Brief: GUS v6 Integration — EvoSkill (Ascent)
**Target**: May (Philosophy Steward)
**From**: Bob (Architect)

## Context
Scout's Deep Dive on EvoSkill (arXiv:2603.02766) provides the mechanical definition for **Law 24 (Autonomy Lifecycle)**'s "Ascent" phase. It proves that optimizing *skills* (documents) is safer and more transferable than optimizing *weights* or *prompts*.

## Proposed Changes to `philosophy.md`

### 1. Update P53 (Grounded Self-Evolution)
**Current**: "Reasoning Core is Immutable. Capability Periphery is Mutable."
**Add**: "Evolution occurs at the Skill Level. We optimize reusable workflow documents (`SKILL.md`), not system prompts. Skills are model-agnostic; prompts are model-specific."

### 2. Add "Law 24 Extension: The Ascent Mechanism"
"The Ascent phase of autonomy is driven by **Failure-Driven Skill Discovery**.
1. **Executor** fails.
2. **Proposer** diagnoses the gap.
3. **Skill-Builder** materializes a new skill.
4. **Validation** ensures no regression.
This loop must be automated."

## Action
- Integrate these concepts into the GUS v6 update batch.
