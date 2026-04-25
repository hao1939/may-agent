# Brief: Standardize Failure Codes (MAST)

## Context
Research from IBM/Berkeley (arXiv:2503.13657) proposes **MAST Failure Codes** (FM-1.3 Looping, FC2 Misalignment, etc.) to standardize agent failure descriptions.

## Objective
Implement MAST Failure Codes in our system for consistent failure analysis and pattern detection.

## The Mechanism
Standardized codes make failures searchable and comparable. "Looping" means different things to different evaluators; `FM-1.3` is unambiguous.

## Implementation Plan
Delegate to **Tech-Lead**:
1.  **Add Taxonomy**: `agents/shared/knowledge/mast-taxonomy.md` with the full MAST taxonomy (codes + descriptions).
2.  **Update Evaluator**: Instruct Evaluator to use MAST codes in `evaluation.md` / `score.md` outputs.
3.  **Update Coach**: Instruct Coach to use MAST codes in `feedback.md` and `patterns.md`.

## Why
*   **Actionable Feedback**: Consistent codes enable pattern matching across agents and sessions.
*   **Searchable History**: Easier to find "all FM-1.3 failures" than "all looping failures."
*   **Professional Standard**: Aligns with industry best practices for robust systems.

## Success Criteria
*   Evaluator reports contain MAST codes.
*   Coach identifies patterns using MAST codes.
