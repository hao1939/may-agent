# Optimizer Brief: Enforce Meta-Loop Completion

## Problem
Bob consistently fails to complete the full meta-loop sequence. In recent sessions (e.g., `s_1772532544019_4`, `s_1772530276229_7`), Bob wrote the optimizer brief and then stopped, requiring human intervention ("Do NOT stop", "Continue") to actually trigger the optimizer.

This violates **Principle 2: Action Over Reporting**. The "report" (brief) is useless without the "action" (delegation).

## Solution
Update `agents/bob/knowledge/domain.md` to structurally enforce the "Action" part of the loop.

## Implementation Details
Target file: `agents/bob/knowledge/domain.md`
Section: `## Meta Loop Orchestration`

1. Add a **Definition of Done** to this section.
2. Explicitly state: "The task is NOT complete when the brief is written. The task is only complete after you have received the optimizer's result."
3. Add a constraint: "Do not stop to report 'I have written the brief'. Immediately call `subagents.delegate`."

## Success Criteria
Bob does not return a text response saying "Brief written". Bob's next action after `write` is `subagents.delegate`.
