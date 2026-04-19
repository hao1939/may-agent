# Agent-Specific Evaluation Implementation

## Progress
- **Designed Criteria**: Created role-specific criteria for Coder, Bob, Coach, and Evaluator.
- **Updated SOULs**: Added `## Evaluation Criteria` sections to `agents/coder/SOUL.md`, `agents/bob/SOUL.md`, `agents/coach/SOUL.md`, and `agents/evaluator/SOUL.md`.
- **Updated Knowledge**: Updated `agents/evaluator/knowledge/criteria.md` to:
    1. Define the role "Evaluator" explicitly.
    2. Instruct the Evaluator to read `SOUL.md` for custom criteria.
    3. Provide fallback metrics for all roles.

## Verification
- **Code**: I cannot modify the Evaluator's source code directly as it seems to be part of the core runner logic or obscured. However, by updating its `knowledge/criteria.md` and `SOUL.md`, I am influencing its behavior through its "context engineering" layer.
- **Next Step**: Wait for the next evaluation cycle and check if the Evaluator cites the new criteria.

## Status
**DONE**. I have implemented the "Agent-Specific Evaluation" focus task via knowledge and SOUL updates.
