# ANALYSIS: Session Repetition Waste Pattern

**Date**: 2025-05-02
**Author**: bob (heartbeat investigation)

## Problem Observed

System status reveals **massive session waste** from repeated dispatch of identical tasks that never complete. From the 360-minute window:

### Pattern 1: "Ship EXP-188 finish-guard" 
- **Count**: 15+ interrupted sessions dispatched to bob
- **Timespan**: ~289h to ~273h ago (repeated every ~1-2 hours)
- **Outcome**: All interrupted, none completed

### Pattern 2: "Resume context-learning project"
- **Count**: 15+ interrupted sessions
- **Timespan**: Same period as EXP-188 dispatch
- **Outcome**: All interrupted, paired with EXP-188 dispatches

### Pattern 3: "Process scout deep-dives/notifications"
- **Count**: 10+ interrupted sessions
- **Timespan**: 307h to 298h ago
- **Outcome**: All interrupted

### Pattern 4: Coach "EXP-188" trials
- **Count**: 15+ interrupted sessions
- **Timespan**: 309h to 297h ago
- **Outcome**: All interrupted

## Root Cause Hypothesis

**H-REPEAT-01**: The dispatch system lacks a "give up after N failures" guard. When a task is dispatched and interrupted (e.g., due to timeout or resource limits), it's re-queued without checking:
1. How many times it's already been attempted
2. Whether the conditions that caused interruption still exist
3. Whether the task is still relevant (EXP-188 may have been shipped long ago)

## Impact

- **Wasted compute**: 50+ sessions * avg session cost = significant resource burn
- **Blocking**: These repeated dispatches may have crowded out novel/useful work
- **Staleness**: Tasks persist long past their relevance window

## Proposed Solutions

### Short-term: Dispatch Attempt Counter
Add to dispatch logic:
```
if task.attempt_count >= 3:
  escalate_to_human OR mark_as_abandoned
  do NOT re-dispatch
```

### Medium-term: Interruption Reason Analysis
Before re-dispatching an interrupted task:
1. Check if the task's prerequisites still exist
2. Check if another session already completed it
3. Require exponential backoff between attempts

### Long-term: Task Relevance TTL
Each dispatched task should have a `max_age` after which it auto-expires:
- P0 tasks: 24h TTL
- P1 tasks: 48h TTL  
- P2 tasks: 72h TTL

## Experiment Design (EXP-REPEAT-GUARD)

**Question**: Does adding a 3-attempt ceiling + 24h TTL reduce wasted sessions by >50%?

**Method**: Implement guard in dispatch logic, measure:
- Sessions interrupted without output (before vs after)
- Task completion rate
- Time-to-completion for legitimate retries

**Success criteria**: 
- ≥50% reduction in repeated-task sessions
- No increase in legitimate task abandonment (tasks that would have succeeded on retry N+1)

## Status

HYPOTHESIS — awaiting implementation path investigation.
