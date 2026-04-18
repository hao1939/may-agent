# Brief: Standardize OpBudget Logging (P85)

## Problem
The `delegation-metrics` skill tracks Integration Success Rate (ISR) by analyzing `delegation.jsonl`. However, it cannot see when a session fails due to **OpBudget Exhaustion** because these events are not logged in a structured format. This creates a blind spot: we see a failure (caller retry), but we don't know *why* (callee ran out of ops).

## Requirement
Update `src/lib/manager.ts` to log a specific, parseable JSON line when an agent hits its op limit.

## Design
In the `run()` or `loop()` function where `opCount >= opBudget` is checked:

```typescript
// Current (approximate):
// logger.warn(`Agent ${agent.name} exceeded op budget ${agent.opBudget}`);

// Required:
logger.warn({
  type: "OpBudgetExceeded",
  agent: agent.name,
  sessionId: session.id,
  opBudget: agent.opBudget,
  opCount: session.opCount
}, "Op budget exceeded");
```

## Why
This allows `delegation-metrics.cjs` to grep for `"type":"OpBudgetExceeded"` and correlate it with session failures, distinguishing "Agent Crashed" from "Agent Worked Too Hard".

## Action
1. Edit `src/lib/manager.ts`.
2. Locate the op budget check.
3. Replace/Add the structured log.
4. Verify with a test case (or manual run).
