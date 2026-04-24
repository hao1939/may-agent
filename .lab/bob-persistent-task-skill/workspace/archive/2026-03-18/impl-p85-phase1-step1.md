# Action: Add opCount to SessionInfo (Phase 1)

## Context
We need to implement P85 (Operation Budgets). Step 1 is tracking the count.
I've checked `src/lib/types.ts` and `SessionInfo` does NOT have `opCount`.
`SubagentDefinition` has `opBudget`.

## Instructions
1.  **Edit `src/lib/types.ts`**:
    - Add `opCount: number;` to the `SessionInfo` interface (around line 53).

2.  **Edit `src/lib/manager.ts`**:
    - In `run()`, initialize `opCount: 0` when creating the session object.
    - In `executeTool()`, increment `session.opCount++` if the tool is `write`, `edit`, or `bash`.

## Detailed Edit Request
I will ask `tech-lead` to apply these exact changes.
