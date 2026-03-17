# Synthesis: Dual-Track Learning (XSkill)

**Source**: XSkill (arXiv:2603.12056) / Scout (2026-04-16)
**Type**: Theoretical Validation / Architectural Requirement

## The Insight
Evolutionary systems face a trade-off between **Stability** (retaining core skills) and **Plasticity** (learning new tricks).
XSkill proves that these must be separated into two distinct memory tracks:
1.  **Skills (Strategic)**: High-level, stable, curated instructions. (Read-Only during execution).
2.  **Experiences (Tactical)**: Low-level, volatile, append-only logs of recent failures/successes. (Read-Write).

Merging them (e.g., constantly rewriting skill docs based on every run) leads to "Catastrophic Forgetting" or "Context Pollution".

## Relevance to Us
This validates our architecture but highlights a need for strict separation:
- `agents/shared/skills/` is our **Skill Track**.
- `agents/*/ERROR_LOG.md` and `workspace/strategy.md` are our **Experience Track**.

## Protocol Update
1.  **Separation of Concerns**:
    - **Skills** are for *General Capability* ("How to use git").
    - **Experiences** are for *Specific Adaptation* ("Git lock file exists, remove it").
2.  **Consolidation**:
    - Experiences should only be promoted to Skills if they are **Universal** and **Stable**.
    - Transient workarounds belong in `strategy.md` or `ERROR_LOG.md`, not `SKILL.md`.

## Impact
- **P11 File System as Memory**: Refines the "L1/L2" distinction.
- **P53 Evolution**: Clarifies that "Adaptation" happens in the Experience track, while "Mutation" (changing Skills) requires the Growth Cycle.

## Status
- **Adopted**: 2026-03-14
- **Implementation**: `philosophy.md` update (P53).
