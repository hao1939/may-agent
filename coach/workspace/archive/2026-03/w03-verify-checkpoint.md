# Workflow Variation w03: Verify-Checkpoint Workflow

## Target Scenario
verify-before-finish, convention-verify-edit — coder skips verification or does it superficially

## Mechanism
After every edit phase, inject a mandatory verification phase that requires citing specific tool output as evidence. The agent cannot proceed to finish() until verification passes.

## Workflow File: workflows/verify-checkpoint.ts

```typescript
// verify-checkpoint.ts — Mandatory verification after every edit
export const name = "verify-checkpoint";
export const description = "After implementation, run a mandatory verification phase before finish.";

export const triggers = {
  always: true
};

export const phases = [
  {
    name: "implement",
    prompt: `Implement the task as specified. Make all necessary code changes.
After each edit(), immediately read back the file to confirm the change was applied correctly.
Keep a mental list of every file you modified.`,
    max_turns: 25
  },
  {
    name: "verify",
    prompt: `VERIFICATION PHASE — You MUST verify every change before finishing.

For EACH file you modified:
1. Read back the file (or the relevant section).
2. Confirm the edit is present and correct.
3. If tests exist, run them: npx vitest --run <specific-test-file>.
4. If no tests, verify with grep/read that the change matches intent.

For the OVERALL task:
5. Re-read the original task requirements.
6. For each requirement, cite the specific evidence (tool output line) that proves it's met.

DO NOT call finish() until you have verification evidence for every deliverable.
If any verification fails, go back and fix it.

Output format:
- File: <path> — Verified: <evidence summary>
- Requirement: <req> — Met: <evidence>`,
    max_turns: 10
  }
];
```

## Why This Should Work
Coder's SOUL already says "verify after edit" but the agent skips it under time pressure or treats it as optional. A workflow phase transition makes verification non-optional — the agent enters a fresh context focused solely on verification, with explicit instructions to cite evidence.

## Risk
Adds overhead to every task. May slow down simple tasks unnecessarily. But the verification phase has a low turn limit (10) so overhead is bounded.
