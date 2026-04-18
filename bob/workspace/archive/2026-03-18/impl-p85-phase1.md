# Action: Implement P85 Operation Budget (Phase 1: Add Op Budget Counter)

## Context
Previous attempts to implement P85 (Operation Budgets) in `src/lib/manager.ts` failed due to LLM truncation. We need to break this down.

## Goal
Phase 1: Add a simple `op_budget` counter to the `ChatSession` state. Do NOT enforce the check yet. Just track `op_count`.

## Instructions
1.  Read `src/lib/types.ts` to see if `ChatSession` has `opCount`. If not, add it.
2.  Read `src/app/chat-session.ts` to see where `ChatSession` is initialized. Initialize `opCount = 0`.
3.  Read `src/lib/manager.ts`. In `executeTool`, increment `session.opCount`.
4.  Do NOT add the check or throw error yet (Phase 2).

## Verification
- `grep "opCount" src/lib/manager.ts` should return a match.
