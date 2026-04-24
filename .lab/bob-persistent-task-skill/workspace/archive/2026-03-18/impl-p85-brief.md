# Brief: Implement Operation Budgets (P85)

## Problem
Philosophy P85 "Operation-Bounded Authority" is documented but not implemented in code.
Currently, agents can run infinite loops of file edits or tool calls. We rely on "be careful" prompts, which is unsafe.
We need a structural `op_budget` that counts high-stakes actions and stops the agent when the budget is exceeded.

## Solution
Implement a "Token Bucket" for operations in `src/lib/manager.ts`.

1. **Define Budget**:
   - Add `op_budget` to `AgentConfig` (default: 50).
   - Track `op_count` in the runtime session state.

2. **Count Operations**:
   - In `executeTool`, increment `op_count` for high-stakes tools:
     - `write`, `edit`, `bash` (anything that changes state).
     - `read` is free (or cheap).

3. **Enforce Limit**:
   - If `op_count >= op_budget`:
     - Block tool execution.
     - Throw structured error: `OperationBudgetExceeded: limit 50 reached. Request re-authorization.`

## Files to Change
- `src/lib/types.ts`: Add `op_budget` to interface.
- `src/lib/manager.ts`: Implement the counter and check logic in `runTool`.

## Acceptance Criteria
- [ ] Manager tracks tool usage count.
- [ ] Manager throws error when count > budget.
- [ ] `read` operations do NOT count toward budget (or count as 0.1).
- [ ] `write`/`edit`/`bash` count as 1.
