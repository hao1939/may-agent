# ANALYSIS: Zombie Task Pattern — Repeated Interrupted Sessions

**Date**: 2025-05-04  
**Author**: Bob (heartbeat investigation)  
**Status**: New finding

## Observation

System status reveals a massive pattern of **zombie tasks** — work items that get re-dispatched every ~1-2 hours but are consistently interrupted before completion. This creates compounding session waste.

## Evidence (from system_status 360m window)

### Bob's Zombie Tasks (310-330 hours ago)
| Task Pattern | Approx. Occurrences | Time Span |
|---|---|---|
| "Ship EXP-188 finish-guard to production" | ~15 | 313h-327h |
| "Resume context-learning project" | ~12 | 316h-331h |
| "Process scout deep-dives/notifications" | ~10 | 312h-339h |
| "P0 from Hao (context injection review)" | 2 | 310h |

### Other Agents with Similar Patterns
- **coach**: "EXP-188: Run all 75 trials" — ~12 interrupted sessions (337h-348h)
- **tech-lead**: "P0: Fix tsc --noEmit failure" — ~4 interrupted sessions (312h-319h)
- **may**: "Triage and dispatch ALL pending Hao requests" — ~5 interrupted sessions (310h-319h)

## Root Cause Hypothesis

**H-ZOMBIE-001**: Tasks that require more than one session to complete get re-dispatched on every heartbeat without progress tracking, creating an infinite retry loop that wastes sessions and never converges.

Contributing factors:
1. **No completion memory**: The dispatch system doesn't track "this was attempted N times and failed"
2. **No backoff**: Failed tasks are re-dispatched at the same priority every cycle
3. **No escalation threshold**: After N failures, tasks should be escalated or deprioritized
4. **Session timeout vs task complexity mismatch**: Some tasks (like running 75 experiment trials) fundamentally cannot complete in a single session

## Impact Estimate

- ~50+ wasted sessions for bob alone over a ~20h period
- ~12+ wasted sessions for coach on EXP-188
- ~10+ wasted sessions across may and tech-lead
- **Total: ~70+ zombie sessions** consuming compute with zero progress

## Proposed Solutions

### 1. Retry Counter + Backoff (structural)
Track dispatch count per task. After 3 failures:
- Increase session timeout
- After 5 failures: escalate to may or pause the task
- After 10 failures: auto-archive with "needs human review"

### 2. Checkpoint-Based Resumption
Tasks that need multiple sessions should use checkpoints:
- Session N writes progress to `.state/checkpoints/`
- Session N+1 reads checkpoint and continues from where N left off
- Already exists in infrastructure (checkpoint tool) but rarely used

### 3. Task Decomposition Gate
Before dispatching a task that previously failed:
- Check if it can be decomposed into smaller subtasks
- Dispatch subtasks instead of the monolithic task

## Recommended Next Step

Design EXP-ZOMBIE-001: Measure current zombie task rate across all agents and test whether a simple retry counter + backoff reduces wasted sessions by >50%.
