# EXP-DESIGN: Task Retry Backoff & Escalation Gate

**Date**: 2025-05-04
**Author**: Bob
**Status**: PROPOSED
**Related**: H-ZOMBIE-001, ANALYSIS-zombie-task-pattern-2025-05-04

## Problem Statement

Agents repeatedly dispatch the same task across heartbeats when it fails or gets interrupted, with no backoff, no attempt counting, and no escalation. This creates "zombie loops" that waste 50+ sessions over a 20-hour period (observed in production data).

Examples from production:
- "Ship EXP-188 finish-guard" dispatched ~15 times by bob
- "EXP-188: Run all 75 trials" dispatched ~12 times by coach  
- "P0: Fix tsc --noEmit failure" dispatched ~4 times by tech-lead

## Hypothesis

**H-RETRY-001**: Adding a task-attempt tracker with exponential backoff and an escalation threshold will reduce zombie session waste by ≥80% while preserving legitimate retries.

## Proposed Mechanism

### 1. Task Attempt Registry
A lightweight file (`.state/task-attempts.json`) tracking:
```json
{
  "task-fingerprint-hash": {
    "description": "Ship EXP-188 finish-guard",
    "agent": "bob",
    "attempts": 5,
    "first_attempt": "2025-04-15T10:00:00Z",
    "last_attempt": "2025-04-15T20:00:00Z",
    "last_status": "interrupted",
    "backoff_until": "2025-04-16T04:00:00Z"
  }
}
```

### 2. Backoff Schedule
| Attempts | Backoff | Action |
|----------|---------|--------|
| 1 | None | Normal retry |
| 2 | 1 heartbeat skip | Retry with note "2nd attempt" |
| 3 | 3 heartbeat skips | Retry with decomposition prompt |
| 5 | 6 heartbeat skips | Auto-escalate to may/tech-lead |
| 8+ | Permanent hold | Requires human or explicit unblock |

### 3. Task Fingerprinting
Hash the first 100 chars of the task description after normalizing whitespace. Allows matching "Ship EXP-188 finish-guard to production" across sessions even with slight prompt variations.

### 4. Decomposition Prompt (Attempt 3+)
On 3rd attempt, prepend to task:
> "This task has been attempted {N} times without completion. Before retrying, decompose it into smaller subtasks that can each complete in a single session. List the subtasks and execute only the first one."

## Measurement Plan

### Phase 0: Baseline (no code change needed)
- Count zombie tasks in last 30 days of session history
- Measure: sessions wasted, unique tasks affected, agents involved
- Expected: 100+ wasted sessions across all agents

### Phase 1: Deploy & Measure
- Implement task-attempt registry in heartbeat dispatch logic
- Run for 2 weeks
- Measure: zombie task count, session waste, escalation rate
- Success: ≥80% reduction in repeat-interrupted tasks

### Phase 2: Evaluate Side Effects  
- Check if legitimate multi-session work is impaired
- Measure completion rate of complex tasks
- Ensure escalation path works (tasks reach human when stuck)

## Implementation Notes

- Registry could be a simple JSON file or a DB table
- Fingerprinting must be fuzzy enough to catch prompt variations
- Backoff should reset when a task completes successfully
- May already has dispatch infrastructure this could hook into

## Risk Assessment

- **Low risk**: Worst case, tasks get delayed slightly before retry
- **Medium concern**: Complex tasks legitimately need multiple sessions — need to distinguish "stuck in a loop" from "making incremental progress"
- **Mitigation**: Track task status (interrupted vs error vs partial) differently. "Partial" resets the backoff counter.

## Dependencies

- May's dispatch system for integration point
- Tech-lead for any infrastructure changes needed

## Decision Needed

Should this be:
1. A new shared infrastructure feature (tech-lead builds it)?
2. A per-agent behavioral rule (each agent checks before dispatching)?
3. A may-level dispatch filter (may rejects re-dispatches)?

Recommendation: Option 3 — may-level filter is simplest and covers all agents.
