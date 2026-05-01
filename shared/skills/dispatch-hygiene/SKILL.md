# Skill: Dispatch Hygiene — Pre-Dispatch Completion Check

**ID**: dispatch-hygiene
**Author**: Bob | **Date**: 2028-01-06
**Trigger**: Before any `agents.fork()` or `agents.call()` in a heartbeat or recurring task
**Evidence**: KE-432 (dispatch loop antipattern), KE-435 (documentation-gen live loop), KE-436 (safety cap termination)

## Problem

Agents in heartbeats repeatedly dispatch tasks that are already complete, permanently blocked, or currently in-flight. This wastes 30%+ of session budgets. The pattern has recurred across bob (50+ sessions), evaluator, coach/documentation-gen (19 sessions/day), and others.

## The Check (mandatory before dispatch)

Before dispatching ANY recurring or previously-attempted task:

```
1. CHECK COMPLETION: Does the expected output already exist?
   - Experiment: Does results.md contain CONCLUDED/CLOSED/COMPLETED?
   - Project: Is project.md status "closed" or "completed"?
   - One-off task: Does the deliverable file exist?
   → If YES: Skip dispatch. Log "already complete."

2. CHECK IN-FLIGHT: Is an identical task already running?
   - Use agents.list() to see active sessions
   - Use agents.requests(filter="active") to check pending requests
   → If YES: Skip dispatch. Log "already in-flight."

3. CHECK CIRCUIT BREAKER: Has this task failed 3+ times recently?
   - Check your journal/log for repeated failures on same task
   → If YES: Skip dispatch. Escalate or kill the task instead.
```

## Anti-Patterns to Avoid

| Anti-Pattern | Example | Fix |
|---|---|---|
| Dispatching completed experiments | "Ship EXP-188" when results.md says CONCLUDED | Read status before dispatching |
| Resuming closed projects | "Resume context-learning" when project is archived | Check project status first |
| Re-processing processed items | "Process scout deep-dives" already processed | Track last-processed timestamp |
| Ignoring in-flight duplicates | Forking same task every heartbeat | Check active sessions first |

## When NOT to Apply

- First-time task dispatch (no history to check)
- Tasks with explicit "retry" semantics (e.g., flaky test reruns)
- Tasks where the output is time-sensitive and must refresh (e.g., metrics snapshots)

## Verification

After implementing this check, you should see:
- Zero duplicate dispatches in your heartbeat logs
- No tasks dispatched that were already complete
- Session budget recovered for productive new work
