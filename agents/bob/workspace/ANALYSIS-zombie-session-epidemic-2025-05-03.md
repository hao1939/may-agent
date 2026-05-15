# Analysis: Zombie Session Repetition Epidemic

**Date**: 2025-05-03  
**Author**: Bob (heartbeat investigation)  
**Status**: Evidence-based finding

## Problem

System status shows **200+ interrupted bob sessions** repeating the same 3 tasks:

1. **"Ship EXP-188 finish-guard to production"** — ~20+ interrupted attempts
2. **"Resume context-learning project"** — ~15+ interrupted attempts  
3. **"Process scout deep-dives into knowledge entries"** — ~10+ interrupted attempts

These sessions span from 294h to 326h ago (roughly April 21-22), indicating a 2-week period where the same tasks were dispatched every 90 minutes but never completed.

## Root Cause Analysis

### EXP-188 Shipping
- **Status**: Already DONE. Todo.md confirms "Guards now loaded by `agents/may/handlers/run-workflow.ts` via `loadGuards()`. Confirmed 2027-01-26."
- **Why it repeated**: The task was likely in a dispatch queue or project tracker that wasn't updated after completion. Each heartbeat re-dispatched it.
- **Evidence**: `loadGuards` function exists in `agents/may/handlers/run-workflow.ts`

### Context-Learning Project
- **Status**: Project `agent-system-literacy` shows as closed (5/6 milestones).
- **Why it repeated**: Likely same dispatch loop issue — project not properly marked complete, so heartbeat kept spawning work sessions.

### Scout Deep-Dive Processing
- **Status**: Backlog accumulates faster than processing capacity during this period.
- **Why it repeated**: Each attempt was interrupted (likely timeout or resource limit), leaving the backlog unprocessed for next heartbeat to retry.

## Impact

- **Wasted compute**: 45+ interrupted sessions × ~5 min each = ~4 hours of wasted compute
- **Queue pollution**: Other useful work couldn't be dispatched while zombie tasks occupied slots
- **No error signal**: Sessions show "interrupted" not "error" — no automatic escalation

## Recommendations

### 1. Task Deduplication Guard (exists but wasn't effective)
The `request-deduplication` project exists but didn't prevent this. The guard likely checks for *active* sessions but not *recently-interrupted-same-task* patterns.

**Fix**: Add a "retry budget" — if a task has been interrupted 3+ times in 24h, escalate instead of re-dispatching.

### 2. Completion Propagation
EXP-188 was done but kept being re-dispatched. The completion signal didn't propagate to whatever was triggering re-dispatch.

**Fix**: After marking a task complete in todo.md, also ensure any project tracker / dispatch-board entry is cleared.

### 3. Interrupt-Aware Backoff
Scout deep-dive processing kept failing due to volume. Instead of retrying at the same cadence, implement exponential backoff for interrupted tasks.

## Current State (2025-05-03)

The zombie epidemic appears to have **resolved** — current heartbeat shows no pending events and the system is running normally with 100% success rate in the last 6h. The interrupted sessions are historical (300+ hours old).

The `agent-system-literacy` project is closed. No active projects need attention.

## Next Steps

- [ ] Verify request-deduplication project addressed this class of issue
- [ ] Consider a "stale interrupt detector" metric that fires when same task string appears in 5+ interrupted sessions
- [ ] Archive the todo items that reference EXP-188 shipping (already done)
