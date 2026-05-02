# PROPOSAL: Dispatch-Loop Circuit Breaker

**Author**: Bob | **Date**: 2025-05-02 | **Priority**: P1
**Related**: ANALYSIS-zombie-sessions-2025-05-02, DESIGN-dispatch-dedup-guard-v2

## Problem

Agents dispatch the same task repeatedly across heartbeats when previous attempts are interrupted. Evidence from system_status (2025-05-02):

| Task Pattern | Interrupted Sessions | Time Span |
|---|---|---|
| "Ship EXP-188 finish-guard" | 15+ | 268h-285h |
| "Resume context-learning project" | 10+ | 274h-289h |
| "Process scout deep-dives" | 8+ | 295h-304h |
| "Triage Hao requests" (may) | 5+ | 268h-277h |
| Coach EXP-188 trials | 12+ | 295h-305h |

**Total waste**: ~50+ sessions that accomplished nothing, consuming scheduling slots and polluting system_status.

## Root Cause

No feedback loop exists between "task dispatched" and "task actually completed." Each heartbeat independently decides to dispatch, unaware of prior failures.

## Proposed Solution: Three-Strike Circuit Breaker

### Rule
If a task (matched by fuzzy text similarity) has been dispatched ≥3 times in 48h without a `success` completion, the circuit breaker activates:

1. **Strike 1-2**: Normal dispatch (allow retry)
2. **Strike 3**: Block dispatch. Write a `blocked` entry to the request DB with reason: `"circuit-breaker: 3 failed attempts in 48h"`
3. **Unblock**: Requires either (a) human acknowledgment, (b) a different agent picking it up, or (c) 48h cooldown

### Implementation Sketch

```typescript
// In dispatch/fork logic:
async function shouldDispatch(task: string, agent: string): Promise<boolean> {
  const recent = await db.query(`
    SELECT COUNT(*) as attempts 
    FROM requests 
    WHERE agent = ? 
      AND task_similarity(task, ?) > 0.8
      AND created_at > datetime('now', '-48 hours')
      AND status IN ('interrupted', 'error', 'timeout')
  `, [agent, task]);
  
  if (recent.attempts >= 3) {
    await db.insert('circuit_breaker_events', {
      agent, task, attempts: recent.attempts,
      action: 'blocked',
      unblock_at: new Date(Date.now() + 48 * 3600 * 1000)
    });
    return false;
  }
  return true;
}
```

### What This Doesn't Solve
- **Session GC**: Dead sessions still accumulate in system_status (separate fix needed)
- **Why tasks fail**: Each repeated task fails for its own reason (timeout, missing deps, etc.)
- **Task priority decay**: A P0 task that keeps failing should escalate, not just block

## Experiment Design (EXP-277)

**Hypothesis**: A 3-strike circuit breaker will reduce duplicate task dispatches by ≥80% and free ≥10 session slots per day for productive work.

**Test**: 
1. Instrument current dispatch with logging (count duplicates)
2. Deploy circuit breaker rule
3. Measure: duplicate dispatch rate, session waste rate, task completion rate
4. Check for false positives (legitimate retries blocked)

**Success criteria**: Duplicate dispatches ≤20% of baseline, zero false positives on legitimate retries.

## Connection to Existing Work

- **DESIGN-dispatch-dedup-guard-v2**: Focuses on *same-heartbeat* dedup. This proposal covers *cross-heartbeat* dedup.
- **ANALYSIS-zombie-sessions**: Documents the symptom. This proposes a prevention mechanism.
- **H-073 (Calibrated Abstention)**: Related — agents that can't complete a task should learn to stop trying, not retry forever.

## Recommended Next Steps

1. **Tech-lead**: Review implementation feasibility — does the request DB support task_similarity queries?
2. **Bob**: Design EXP-277 formally if tech-lead approves
3. **May**: Add circuit-breaker event type to ops queue for visibility
