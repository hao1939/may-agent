# Brief: Implement "Safe Verification" Workflow (Behavioral Shaping)

## Context
We are pivoting from "Hard Constraints" (Code Guards) to "Workflows + Scenarios" per Req 8b381f87.
The goal is to ensure agents verify their work *before* claiming success, without blocking them with a runtime guard that might false-positive.

## The Gap
Currently, agents often:
1. Make an edit.
2. Claim "Fixed" without verifying.
3. Call `finish(success)`.

The failed `Guard` approach tried to intercept `finish()` and block it.
The new `Workflow` approach will provide a standard path: `workflows/verify-and-finish.ts`.

## The Design: `verify-and-finish` Workflow

This workflow replaces the ad-hoc "I'll check it myself" pattern.

### Steps
1. **Input**: A task description and a verification command (optional).
2. **Execution**: Run the task (via Agent).
3. **Verification**:
   - If verification command provided: Run it.
   - If not: Ask Agent "What command proves this is done? Run it."
4. **Analysis**:
   - Check exit code.
   - Check output for "PASS" / "FAIL".
   - **Crucial**: If verification fails, *loop back* to fix (max 2 retries).
5. **Completion**:
   - Only call `ctx.done()` if verification passes.
   - Else `ctx.escalate()`.

## Implementation Tasks (Tech-Lead)

1. **Create `agents/may/workflows/verify-and-finish.ts`**:
   - Input: `task: string`, `agent: string`, `verification_cmd?: string`.
   - Logic:
     - Run `agent` with `task`.
     - Inspect result.
     - If `verification_cmd`, run it via `bash` (or ask agent to run it).
     - If verification fails, send "Verification failed with [output]. Fix it." to agent.
     - Repeat x2.
     - Return result.

2. **Register in `agents/may/agent.json`**:
   - Add to `workflows` list.

3. **Update `common-sense.md`**:
   - Advise agents: "For critical tasks, use the `verify-and-finish` workflow instead of raw delegation."

## Success Criteria
- [ ] Workflow exists and passes type check.
- [ ] Workflow handles "Verification Failed" by retrying the fix.
- [ ] Workflow escalates after 2 failures.
