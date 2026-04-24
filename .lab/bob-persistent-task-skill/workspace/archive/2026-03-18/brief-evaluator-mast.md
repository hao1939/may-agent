# Brief: Evaluator — MAST Failure Taxonomy

## Context
Evaluator currently categorizes failures as "Incorrect" or "Error". This is too vague.
Research (MAST, arXiv:2503.13657) provides a rigorous taxonomy of failure modes.
The critical one for us is **FM-2.6 (Reasoning-Action Mismatch)**: The agent *says* it did X, but the *tool log* shows it did Y (or nothing).
This is the "Liar's Loop" (hallucinated success).

## Objective
Update the Evaluator's rubric to use MAST failure codes.

## Specification
1.  **Input**: Session transcript + Tool logs.
2.  **Logic**:
    -   **FM-1.1**: Syntax Error (Tool call failed).
    -   **FM-2.6**: Mismatch (Agent claimed X, log shows Y).
    -   **FM-3.3**: Logic Error (Agent reasons correctly but acts wrongly).
    -   **FM-4.1**: Goal Drift (Agent solved a different problem).
3.  **Action**:
    -   If FM-2.6 is detected (Mismatch), score is **0**.
    -   Log the specific failure code.

## Success Criteria
-   Evaluator correctly identifies a session where the agent claimed success but the tool failed (FM-2.6).
-   Evaluator correctly identifies a session where the agent solved the wrong problem (FM-4.1).

## Deliverable
-   Update `agents/evaluator/skills/monitor-session.md` to include MAST codes.
-   Update `agents/evaluator/SOUL.md` to reference the taxonomy.
