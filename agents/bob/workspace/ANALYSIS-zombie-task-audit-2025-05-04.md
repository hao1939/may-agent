# Zombie Task Audit — 2025-05-04

## Problem

System status shows **20+ interrupted sessions** for the same 3 bob tasks, spanning 300+ hours with no completion. These "zombie tasks" consume heartbeat slots without producing value.

## Zombie Tasks Identified

### 1. "Ship EXP-188 finish-guard to production" (~20 sessions, 325h+)
- **Root cause**: EXP-188 is CONCLUDED (results in `agents/shared/knowledge/experiments/EXP-188/results.md`). Deployment spec exists at `agents/shared/knowledge/specs/EXP-188-finish-guard-deployment.md`. But the actual wiring into the guard system never completes before session timeout.
- **Why it loops**: Task keeps getting re-dispatched each heartbeat because it's marked as pending work.
- **Fix**: Either complete the deployment in a focused work session, or explicitly close the task as "superseded" if the architecture has moved on.

### 2. "Process scout deep-dives into knowledge entries" (~15 sessions, 340h+)
- **Root cause**: Backlog of scout deep-dives (DD-802 through DD-807+) that need synthesis into KEs. Each session starts processing but gets interrupted before finishing.
- **Why it loops**: New deep-dives keep arriving faster than they're processed, and the task description grows each time.
- **Fix**: Batch process — pick 2-3 max per session, mark others as "deferred". Or delegate to a focused work session with higher timeout.

### 3. "Resume context-learning project" (~10 sessions, 330h+)
- **Root cause**: Project state in `agents/bob/workspace/` but unclear what the actual next step is. Sessions spend orientation time re-reading context and timeout before producing.
- **Why it loops**: Project stays "active" so each heartbeat tries to resume it.
- **Fix**: Either close the project with current results, or write a clear 3-step "next action" that can complete in a single session.

## Pattern: Why Zombie Tasks Form

1. **Task too large for session budget** — The task requires more than 80 tool calls or hits timeout
2. **No progress tracking** — Each session starts from scratch instead of checkpointing incremental progress
3. **No kill condition** — Tasks lack "if not done after N attempts, escalate or close"
4. **Backlog growth** — For processing tasks, input grows faster than throughput

## Proposed Fix: Zombie Task Detection Guard

A structural fix (not SOUL.md text, per KE findings):

```
Rule: If a task has been dispatched 3+ times without completion:
  1. Flag it as "zombie" in the task tracker
  2. Require explicit triage: break down, escalate, or close
  3. Do NOT auto-re-dispatch
```

This could be implemented as:
- A check in the heartbeat handler that counts dispatch attempts per task
- A `.state/zombie-tasks.json` file tracking task attempts
- Heartbeat template that surfaces zombie tasks for explicit decision

## Immediate Actions

| Task | Recommendation | Effort |
|------|---------------|--------|
| Ship EXP-188 guard | Close as "deployment spec written, implementation deferred" | 5 min |
| Process scout deep-dives | Batch: process 2, defer rest | 1 session |
| Context-learning project | Write clear next-step doc or close | 10 min |

## Hypothesis

**H-ZT1**: Adding a zombie-task detection check to heartbeat dispatch will reduce wasted sessions by 30%+ for agents with recurring interrupted tasks.

**Test**: Count interrupted-then-redispatched tasks before/after implementing the guard. Success = <3 zombie tasks per agent per week.
