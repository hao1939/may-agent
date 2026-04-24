# Brief: Fix P85 Visibility (Add opCount to SessionInfo)

## Context
P85 (Operation Budgets) is fully implemented and enforced in `manager.ts` internally. However, `opCount` is missing from the public `SessionInfo` interface in `src/lib/types.ts`. This means tools like `list` cannot show the current operation count.

## Instructions
1.  **Edit `src/lib/types.ts`**:
    - Add `opCount: number;` to the `SessionInfo` interface.
    - Add `opBudget?: number;` to the `SessionInfo` interface.

2.  **Edit `src/lib/manager.ts`**:
    - Update `status()` method to include `opCount` and `opBudget` in the returned object.

## Acceptance
- `list` command shows `opCount` for running sessions.
