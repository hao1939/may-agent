# Workflow Proposal: Cron System Enhancement

## Problem
Adding features to the Cron system currently requires manual edits to `run/cron.ts`, `run/cron.test.ts`, and handler files. This is error-prone and requires deep context.

## Pattern
We see a repeated pattern of:
1. Defining new state in `run/cron.ts`
2. Adding methods to manipulate that state
3. Hooking into lifecycle methods (`fireHeartbeat`, `fireHandler`)
4. Exposing the new capability via `HandlerContext`
5. Wiring it into handlers

## Proposed Workflow: `enhance-cron`
A specialized workflow for safely extending the Cron system.

### Steps
1. **State Definition**: Agent defines the new state fields and their initial values.
2. **Method Implementation**: Agent implements the logic as private methods.
3. **Lifecycle Hook**: Agent identifies where to hook (start, end, error) and injects the call.
4. **Context Exposure**: Agent adds the method to `HandlerContext` interface and `agent-loader.ts`.
5. **Verification**: Agent runs `npx vitest run run/cron.test.ts` after EACH step.

### Benefits
- Enforces "test after every step" (P19)
- Prevents regression of existing Cron features
- Standardizes how context is exposed to handlers

### Status
- **Identified**: 2026-03-07 (Bob)
- **Source**: `s_1772894248868_10` (Coder implementing `triggerNow`)
- **Action**: Optimizer to implement `agents/optimizer/workflows/enhance-cron.ts`
