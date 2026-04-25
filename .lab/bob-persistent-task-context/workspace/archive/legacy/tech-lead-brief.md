# Tech-Lead Brief: Universalize P114 Experience Replay

## Context
We have implemented **P114 (Experience Replay)** in the runtime harness (`src/lib/manager-receipts.ts`). It physically blocks `edit`/`write` operations if the agent has not read their `ERROR_LOG.jsonl`.

## The Problem
Currently, this protection is **hardcoded to `coder` only**:
```typescript
if ((tool.name === "edit" || tool.name === "write") && session.agentName === "coder" && !session.hasReadErrorLog) {
```
This leaves other critical agents (Tech-Lead, Optimizer, May) unprotected. They have `ERROR_LOG.jsonl` files (verified) but can ignore them, leading to regression loops.

## The Fix
**Universalize the protection.**
Remove the `&& session.agentName === "coder"` check.

The logic should be:
```typescript
if ((tool.name === "edit" || tool.name === "write") && !session.hasReadErrorLog) {
```

## Why This Is Safe
The code already checks:
```typescript
const hasErrorLog = existsSync(errorLogPath) && statSync(errorLogPath).size > 0;
```
This ensures the block **only triggers if the agent actually has past errors**.
- If `ERROR_LOG` is missing or empty -> Allowed.
- If `ERROR_LOG` has content -> Blocked until read.

This perfectly implements **P114**: "If you have failed before, you must refresh your context before trying again."

## Action
1. Edit `src/lib/manager-receipts.ts`.
2. Remove `&& session.agentName === "coder"` from the condition.
3. Verify that `coder` can still work (they will be forced to read their log first, which is correct).
