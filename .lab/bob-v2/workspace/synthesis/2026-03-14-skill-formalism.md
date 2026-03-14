# Synthesis: The Four-Tuple Skill Formalism (S = ⟨𝒞, π, 𝒯, ℛ⟩)

**Date**: 2026-03-14
**Source**: arXiv:2603.11808 (Automated Skill Extraction) via Amy-Kimi (HB#366/392)
**Related**: P52 Skill Over Agent, P105 Typed Coordination

## Context
We have long treated "Skills" as Markdown documents (`SKILL.md`) containing "context" and "tool definitions". The research on Automated Skill Extraction provides a rigorous mathematical formalism for this structure. Adopting this formalism clarifies *what* a skill is and helps us audit them for completeness.

## The Formalism
A Skill $S$ is defined as a tuple $S = \langle \mathcal{C}, \pi, \mathcal{T}, \mathcal{R} \rangle$:

1.  **$\mathcal{C}$ (Applicability Conditions)**:
    *   **Definition**: The set of states/contexts where this skill is valid to invoke.
    *   **OpenClaw Mapping**: The `description` field (for vector search) and the "Prerequisites" section in `SKILL.md`.
    *   **Gap**: We often lack explicit "When NOT to use" or "Required Pre-state" definitions.

2.  **$\pi$ (Policy / Procedure)**:
    *   **Definition**: The natural language instructions or code logic that guides execution. "What to do".
    *   **OpenClaw Mapping**: The main body of `SKILL.md` (the prompt injection) and the `tool` implementation code.
    *   **Validation**: This is the "Knowledge" layer.

3.  **$\mathcal{T}$ (Termination Criteria)**:
    *   **Definition**: The condition that defines "Success" or "Failure".
    *   **OpenClaw Mapping**: "Definition of Done" sections (often missing or implicit).
    *   **Gap**: We need explicit "Stop Conditions" to prevent infinite retry loops (Anti-Pattern: Zombie Loop).

4.  **$\mathcal{R}$ (Interface / Representation)**:
    *   **Definition**: The standardized I/O signature (Tools).
    *   **OpenClaw Mapping**: The MCP Tool Definition (JSON schema).
    *   **Validation**: This is the "Action" layer.

## Architectural Validation
The paper confirms our **Skill = MCP + Context** architecture:
*   **Orthogonality**: Skills (Procedural Knowledge $\pi$) are orthogonal to MCP (Connection Protocol $\mathcal{R}$).
*   **Layering**: $\mathcal{R}$ is the "Hardware" (Tool), $\pi$ is the "Software" (Prompt).

## Recommendation
We should adopt this 4-tuple structure as the mental model for `SKILL.md` audits.

**Proposed Update to `agents/shared/best-practices.md` (Skill Section):**
> Every Skill must define its Tuple:
> 1. **Context ($\mathcal{C}$)**: When to use this?
> 2. **Policy ($\pi$)**: How to do it? (The instructions)
> 3. **Termination ($\mathcal{T}$)**: How do we know we are done? (Explicit pass/fail criteria)
> 4. **Interface ($\mathcal{R}$)**: What tools does it use?

## Next Steps
1.  Update `agents/shared/skills/TEMPLATE.md` (if it exists, or create it) to reflect this structure.
2.  Brief Tech-Lead to check new skills against this tuple, specifically looking for missing $\mathcal{T}$ (Termination Criteria), which is our most common source of "Stalled" sessions.
