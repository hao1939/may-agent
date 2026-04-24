# Implementation Brief: L3 Drift Response

**Status**: Active
**Owner**: Tech-Lead
**Brief**: Enhance `detect-drift` to be actionable by other agents (Evaluator).

## Context
Evaluator can detect drift (Level 1), but cannot *respond* to it (Level 2/3). We need a structured output from `detect-drift` so Evaluator can parse it and trigger a `growth-cycle` or a `rollback`.

## Requirements
1. **Modify `agents/evaluator/skills/detect-p53-drift.cjs`**:
   - Currently: Outputs a Markdown report.
   - **New**: Output *both* a Markdown report (for humans) AND a JSON object (for agents).
   - **JSON Format**:
     ```json
     {
       "agent": "coder",
       "drift_level": "CRITICAL", // WARNING (<10%), CRITICAL (10-30%), CATASTROPHIC (>30%)
       "delta": -0.15,
       "bad_files": ["SOUL.md", "agent.json"],
       "action_required": "REVERT" // or "GROWTH_CYCLE" or "NONE"
     }
     ```
2. **Create `agents/evaluator/skills/trigger-response.cjs`**:
   - Input: The JSON from step 1.
   - Logic:
     - If `action_required === "GROWTH_CYCLE"`, send todo to Coach: "Run growth-cycle for [agent]."
     - If `action_required === "REVERT"`, send todo to Tech-Lead: "Revert [agent] immediately."

## Success Criteria
- Running `detect-drift` on a drifted agent returns the JSON structure.
- Running `trigger-response` with that JSON correctly sends a todo to the target agent.
