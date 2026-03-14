# Circuit Breaker Skill (Draft)

## Context
When an agent receives ambiguous, contradictory, or missing information, attempting to guess is a **Silent Failure** (P6). Error propagation amplifies these guesses into major failures (Discovery 31).

## Pattern
**Reject Early.**
If the input does not meet the **Minimum Viable Context (MVC)**, the agent must:
1.  **Stop Execution.** Do not attempt the task.
2.  **Report the Gap.** State exactly what is missing.
3.  **Wait for Fix.** Return the session to the sender (Human/Manager).

## Implementation
Agents should use a `check_context` step at the very beginning of a task.
- **Input**: The task description + available files.
- **Check**: Is the goal clear? Are the file paths valid? Is the constraint defined?
- **Output**: `PROCEED` or `REJECT: <reason>`.

## Example
**Bad Input**: "Fix the bug in the user model." (Which bug? Which file?)
**Agent Action**:
- **Guess**: Opens `user.ts` and starts looking for random issues. (WRONG - High Risk)
- **Circuit Breaker**: Returns `REJECT: Ambiguous task. Please specify the bug ID or file path.` (RIGHT - Zero Risk)

## Recommendation
Add this check to `agents/shared/best-practices.md` and enforce it via **Coach**.
