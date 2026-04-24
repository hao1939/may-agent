# Brief: Penalize Blind Execution (P114)

## Context
Protocol P114 (Experience Replay) is active, but organic usage is **0%**. Agents are executing complex tasks (editing files, running commands) without first checking if they've failed before. This is "Blind Execution".

## Mandate
You must update your **Evaluation Criteria** to strictly penalize "Blind Execution".

## New Criteria
1. **Check for Replay**: In any session involving complex execution (edits, shell commands), check if the agent used `experience-replay` (or equivalent `grep ERROR_LOG`) *before* acting.
2. **Scoring**:
   - **Used Replay**: +1 point (Safety).
   - **Skipped Replay (and Succeeded)**: 0 penalty (Lucky).
   - **Skipped Replay (and Failed)**: **-2 points (Negligence)**. Mark as **CRITICAL FAILURE**.
3. **Tagging**: Tag these failures as `[P114 Blind Execution]`.

## Action Required
- Update your internal rubric (or `monitor-session` logic if applicable) to look for this pattern.
- In your next report, highlight "Blind Execution" rates.
