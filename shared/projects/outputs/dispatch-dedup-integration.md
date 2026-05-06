# Dispatch Dedup Guard Integration

## Changes Made

### `agents/may/handlers/project.ts`
- Added import of `shouldDispatch`, `recordDispatch`, `recordOutcome` from `dispatch-dedup-guard.js`
- Wrapped `runAgent` → `callAgent` path with:
  - `shouldDispatch()` check before dispatch (returns blocked response if not allowed)
  - `recordDispatch()` call before actual dispatch
  - `recordOutcome()` call after dispatch completes

### `agents/may/handlers/run-workflow.ts`
- Added same import
- Wrapped `runAgent` → `callAgent` path with identical guard pattern

## Behavior
- Before any agent dispatch, the dedup guard checks if the task has failed too many times (≥3 in 7 days) or is currently running
- If blocked, returns a synthetic "blocked" result without calling the agent
- On success, resets failure counter; on failure, increments it toward the block threshold
