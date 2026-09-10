---
name: dispatch-hygiene
description: Prevent duplicate, completed, blocked, or already-running work before direct agent call/fork or proposed task actions by checking canonical task resources, receipts, attempts, Conditions, active sessions, and owner disposition.
---

# Dispatch Hygiene — Pre-Dispatch Completion Check

**Trigger**: Before a direct `agents` call/fork or before proposing task actions
for recurring or previously attempted work
**Evidence**: KE-432 (dispatch loop antipattern), KE-435 (documentation-gen live loop), KE-436 (safety cap termination)

## Problem

Agents in heartbeats repeatedly dispatch tasks that are already complete, permanently blocked, or currently in-flight. This wastes 30%+ of session budgets. The pattern has recurred across bob (50+ sessions), evaluator, coach/documentation-gen (19 sessions/day), and others.

## The Check (mandatory before dispatch)

Before dispatching ANY recurring or previously-attempted task:

```
1. CHECK COMPLETION: Does the expected output already exist?
   - Experiment: Does results.md contain CONCLUDED/CLOSED/COMPLETED?
   - Project: Is `project.json` terminal, is the maintain task converged, or
     does a completion receipt already cover the finite work?
   - Owner review: Does a durable delivery receipt show the same material
     finding was already delivered, even under a different stable request ID?
     Compare the desired outcome, evidence, and owner obligation—not only the
     incoming identity. Unless changed evidence requires updating the existing
     owner work, treat prior material delivery as completion.
   - One-off task: Does the deliverable file exist?
   → If YES: Skip dispatch. Log "already complete."

2. CHECK IN-FLIGHT: Is an identical task already running or waiting?
   - Use the `agents` tool with `action: "list"` to see active sessions.
   - Read canonical task status, current attempt, exact Conditions, completion
     receipts, event trace, and durable App inbox.
   - Use the generated tree only as a projection; do not invent a parallel
     request queue.
   → If YES: Skip dispatch. Log "already in-flight."

3. CHECK CIRCUIT BREAKER: Has this task failed 3+ times recently?
   - Check durable attempts and Conditions for repeated failures on the same
     task generation.
   → If YES: Do not dispatch around the controller. Return owner judgment,
     revise desired state, or escalate across an ownership boundary.
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

This exemption permits a fresh observation; it does not permit duplicate task
assignment or a second scheduling queue.

## Verification

After implementing this check, you should see:
- Zero duplicate dispatches in your heartbeat logs
- No tasks dispatched that were already complete
- Session budget recovered for productive new work
