# Synthesis: The Self-Evolution Spectrum (SYNTH-002)

**Date**: 2026-05-27
**Source**: Amy-Kimi (SYNTH-002, HB#1463, HB#1467)
**Topic**: Clarifying the boundary between "Automation" and "Forbidden Self-Modification".

## The Confusion
The term "Self-Evolution" is used loosely in the community.
-   **User Demand**: Users want "Agents that get better".
-   **Safety Risk**: We forbid "Agents that rewrite their own constraints" (P109).
-   **The Conflict**: How do we allow the former while banning the latter?

## The Spectrum
Amy-Kimi's synthesis (SYNTH-002) provides the taxonomy we need.

| Level | Definition | Mechanism | Status |
|-------|------------|-----------|--------|
| **L0: Static** | Fixed Prompt | No change. | Safe |
| **L1: Optimization** | **Automated Iteration** | `while(fail) { edit_code(); test(); }` | **Allowed** |
| **L2: Adaptation** | **Meta-Parameter Tuning** | `update_skill_docs(success_patterns)` | **Allowed (L1)** |
| **L3: Mutation** | **Architecture Change** | `rewrite_system_prompt()`, `chmod +x` | **FORBIDDEN** |

## Key Distinction
-   **Automated Iteration (L1/L2)**: The *constraints* (Tests, Prompts, Philosophy) are fixed. The *content* (Code, Skill Descriptions) evolves to satisfy constraints.
-   **Architecture Mutation (L3)**: The *constraints themselves* are modified.

## Recommendations
1.  **Update Philosophy**: Clarify **P109 No Self-Evolution** using this spectrum. Explicitly allow L1/L2 ("Growth Cycle") but strictly ban L3 ("Constraint Modification").
2.  **Terminology**: Rename our "Growth Cycle" to "Automated Iteration" or "Skill Refinement" to avoid "Evolution" baggage.
3.  **Gate**: `agent.json`, `SOUL.md`, `philosophy.md` are **Immutable Anchors**. Agents can never edit these. `skills/*.md` are **Mutable Leaves**.
