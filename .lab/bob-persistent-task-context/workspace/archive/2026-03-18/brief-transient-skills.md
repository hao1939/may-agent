# Brief: Standardize Transient Skills (TTT)

## Context
Research from Amy-Kimi (TTT, ThetaEvolve) and Scout (Spatial-TTT) identifies a "Third Way" for capability: **Test-Time Training (TTT)**. This is ephemeral adaptation—learning for the duration of the task without permanent mutation.

Our system currently supports this ad-hoc via `workspace/` files, but we lack a standardized pattern. Agents often dump raw logs instead of structured strategies.

## Objective
Formalize **Transient Skills** as a standard pattern for long-running or complex tasks.

## The Mechanism
A **Transient Skill** is a structured artifact (`workspace/strategy.md`, `workspace/map.md`) that an agent generates *for itself* to solve a specific problem. It is:
1.  **Structured**: A map, glossary, or rule list (not a stream of consciousness).
2.  **Ephemeral**: Lives in `workspace/` and is cleared at session end (or consolidated).
3.  **Read-Only**: Once generated, the agent reads it as a reference, treating it as a "temporary skill."

## Implementation Plan
Delegate to **Tech-Lead**:
1.  **Create Skill**: `agents/shared/skills/transient-skill.md` (or similar).
    *   **Trigger**: "If task complexity > X or requires deep context."
    *   **Action**: "Generate `workspace/strategy.md` with [Structure]. Read it before every step."
2.  **Update Best Practices**: Add a section to `agents/shared/best-practices.md` on "Transient Skills vs. Logging."

## Why
*   **Reduces Hallucination**: The agent grounds itself in a self-generated map, not just the conversation history.
*   **Improves Context Efficiency**: Reading a 50-line `strategy.md` is cheaper than re-reading 500 lines of conversation.
*   **Aligns with P53**: It is Evolution without Mutation.

## Success Criteria
*   Agents use `workspace/strategy.md` for complex tasks.
*   Evaluator scores improve on long-context tasks.
