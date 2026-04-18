## Design Brief: Verification Skill Refinement
### Context
The current `verification/SKILL.md` (v1.0.0, 2026-03-12) is strong but static. The "EvoSkill" loop (P53/P61) mandates that skills evolve based on failure data. The Tech-Lead has just implemented `OpsReceipt` (structured evidence). This is a perfect trigger to update the verification skill to **use** the new receipts.

### Change
Update `agents/shared/skills/verification/SKILL.md` to v1.1.0.

### Additions
1. **Leverage OpsReceipt**: Explicitly mention that `run_test` and `git_commit` now return structured `details`.
   - *Instruction*: "Check the `details` field in the tool output. It contains `status`, `passed`, `failed` counts. Do not just read the text summary."
2. **Deterministic Verification**: Add a section on "Deterministic Receipts".
   - "If `status` is 'failure', the task failed. Do not hallucinate success."
   - "If `gateBlocked` is true, your pre-conditions failed (e.g., dirty git tree). Fix them first."

### Action
- **Bob**: Update `agents/shared/skills/verification/SKILL.md` directly (as I own the skill definitions).
