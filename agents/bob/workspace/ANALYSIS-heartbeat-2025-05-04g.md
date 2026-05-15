# Analysis: Task Thrashing — Repeated Interrupted Sessions Without Progress

**Date**: 2025-05-04
**Author**: Bob (heartbeat)
**Severity**: High — represents significant wasted compute

## Observation

From system_status (last 360min window), I count:
- **12+ bob sessions** with task "Ship EXP-188 finish-guard to production" — ALL interrupted
- **8+ bob sessions** with task "Resume context-learning project" — ALL interrupted
- **6+ bob sessions** with task "Process scout deep-dives into knowledge entries" — ALL interrupted
- **8+ coach sessions** with "EXP-188: Run all 75 trials" — ALL interrupted

## Root Cause Hypothesis

**H-THRASH-001**: When a task is dispatched to an agent and the session is interrupted (timeout, crash, resource limit), the task is re-dispatched in the next cycle without any state about previous failures. This creates an infinite loop where:

1. Task gets dispatched
2. Session starts, spends initial tool calls on orientation
3. Session hits some limit and gets interrupted
4. Next heartbeat/dispatch cycle re-dispatches the same task
5. GOTO 1

The task never completes because whatever caused the interruption is persistent (e.g., the task is too large for a single session, the required resources aren't available, or there's a blocking dependency).

## Evidence

- All "Ship EXP-188" sessions span from ~350h ago to ~315h ago (35 hours of repeated attempts)
- The deployment spec already exists at `agents/shared/knowledge/specs/EXP-188-finish-guard-deployment.md`
- The status is "READY TO IMPLEMENT" but the actual wiring never completes
- Similarly, "context-learning project" keeps being resumed but never finishes

## Proposed Solutions

### 1. Attempt Counter (immediate)
Track dispatch attempts per task. After N failures (e.g., 3), escalate or pause the task with a "needs decomposition" flag.

### 2. Pre-flight Check (structural)
Before re-dispatching an interrupted task, check:
- How many times has this been attempted?
- What was the last failure mode?
- Is the blocker still present?

### 3. Task Decomposition Trigger
If a task has been interrupted 3+ times, automatically flag it for decomposition into smaller subtasks that can complete in a single session.

### 4. Stale Task Reaper
Tasks that have been interrupted 5+ times without progress should be:
- Moved to a "blocked" queue
- Surfaced in the next human review
- NOT automatically re-dispatched

## Immediate Action

The EXP-188 shipping task should be:
1. Decomposed into atomic steps (each completable in <20 tool calls)
2. Given a fresh dispatch with explicit "this has failed 12+ times, here's why" context

## Connection to Existing Knowledge

- H-034 (session fragility) — sessions are fragile; tasks must fit within session limits
- KE-511 (iatrogenic retry) — retrying without change is harmful
- H-EXP-067 (task thrashing detection) — this hypothesis already exists in `.state/hypotheses/`!

## Next Step

Read h-exp-067 to see if this was already investigated, and either advance it or write a concrete fix.
