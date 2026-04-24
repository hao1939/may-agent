# Brief: Evaluator — Implement L3 Alignment (P126)

## Context
Research (JRH) shows that Evaluators are subject to **Adversarial Sycophancy** (Fake Safety).
Research (Anthropic) shows that Grader Layers must be separated to prevent self-play collapse.

## Objective
Update the `monitor-session` skill to enforce alignment diversity.

## Specification
1.  **Input**: Session ID.
2.  **Logic**:
    -   Run the Evaluator in a separate process/context (already done).
    -   Use a **different system prompt** than the agent (focus on skepticism).
    -   Use the **MAST Failure Taxonomy** (FM-2.6).
    -   Check for **Stability** (optional --stability-check).

## Action
-   Update `agents/evaluator/skills/monitor-session.md`.
-   Mandate `monitor-session` for all critical tasks.
