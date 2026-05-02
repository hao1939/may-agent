# ANALYSIS: Dispatch-Without-Completion Loop — Root Cause & Fix Design

**Author**: Bob | **Date**: 2025-05-02 | **Type**: System Improvement Proposal
**Related**: ANALYSIS-zombie-sessions-2025-05-02.md, EXP-275 (anti-shallow), EXP-276 (phantom completion)

## Problem Statement

The system accumulates 396 zombie sessions because tasks get re-dispatched every heartbeat when previous attempts were interrupted. This creates:
1. **Massive system_status bloat** (50KB+ of stale data drowning 2 real sessions)
2. **Wasted compute** — same task dispatched 15+ times (e.g., "Ship EXP-188 finish-guard")
3. **No learning** — each new session starts fresh, unaware of prior failures

## Evidence (from this session's system_status)

| Repeated Task Pattern | Interrupted Sessions | Time Span |
|----------------------|---------------------|-----------|
| "Ship EXP-188 finish-guard" | 15+ | 270h-288h ago |
| "Resume context-learning project" | 10+ | 275h-289h ago |
| "Process scout deep-dives" | 8+ | 270h-301h ago |
| Coach EXP-188 trials | 12+ | 295h-305h ago |
| "Triage Hao requests" (May) | 5+ | 268h-277h ago |

**Total estimated waste**: ~50 interrupted sessions × ~$0.50/session = ~$25 burned on zero-output retries.

## Root Cause Analysis

### RC-1: Heartbeat "inbox" doesn't track prior attempts
When a heartbeat fires, it sees "task X is pending" and dispatches it. It has no memory that the same task was dispatched 14 times before and failed every time.

### RC-2: No backoff or escalation
Retry #1 and retry #15 use identical strategy. There's no:
- Exponential backoff
- Strategy change after N failures
- Escalation to human after M failures

### RC-3: Tasks that can't succeed keep getting retried
"Ship EXP-188 finish-guard to production" likely requires a code change to a handler file. If the agent lacks permissions or the approach is wrong, retrying the same way is futile.

## Proposed Fix: Dispatch Dedup Guard v3

### Mechanism
Before dispatching task T to agent A:
1. Query recent sessions (last 48h) for agent A with similar task description
2. If ≥2 interrupted/failed sessions exist for the same task:
   - Log: "Task has failed N times. Previous approaches: [summaries]"
   - If N ≥ 3: change strategy (e.g., simplify scope, try different approach)
   - If N ≥ 5: mark task as BLOCKED and escalate to human
3. If dispatching, include context: "Previous attempt failed because: [last session summary]"

### Implementation Sketch
```typescript
// In heartbeat dispatch logic
async function shouldDispatch(task: string, agent: string): Promise<{dispatch: boolean, context?: string}> {
  const recentAttempts = await queryDB(`
    SELECT sessionId, status, summary, createdAt 
    FROM sessions 
    WHERE agent = ? AND task LIKE ? AND createdAt > datetime('now', '-48 hours')
    ORDER BY createdAt DESC
  `, [agent, `%${taskFingerprint(task)}%`]);
  
  const failures = recentAttempts.filter(s => s.status === 'interrupted' || s.status === 'error');
  
  if (failures.length >= 5) {
    return { dispatch: false, context: `BLOCKED: Task failed ${failures.length} times. Needs human review.` };
  }
  if (failures.length >= 2) {
    return { 
      dispatch: true, 
      context: `WARNING: ${failures.length} prior failures. Last: ${failures[0].summary}. Try a different approach.` 
    };
  }
  return { dispatch: true };
}
```

### Key Design Decision: Fingerprinting
Task descriptions vary slightly between dispatches. Use a fuzzy match:
- Extract key nouns/verbs (e.g., "EXP-188", "finish-guard", "production")
- Match if >60% of key terms overlap
- OR: use a task ID field in dispatch metadata

## Relationship to EXP-275 and EXP-276

- **EXP-275** (Anti-Shallow): The dispatch loop creates shallow sessions because retried tasks often time out mid-work. Fixing the loop reduces the denominator of shallow sessions.
- **EXP-276** (Phantom Completion): Some retried sessions "complete" by claiming success without evidence. The dedup guard would catch this by comparing claimed completion with actual file changes.

## Hypothesis

**H-277**: A dispatch dedup guard that tracks prior failures and escalates after 3+ attempts will reduce zombie session accumulation by >80% and save >$20/week in wasted compute.

**Test**: Implement guard → measure zombie session count over 1 week → compare to current baseline of ~50 zombies/week.

## Next Steps
1. Brief tech-lead on implementation requirements
2. Design EXP-277 to test the hypothesis
3. Check if existing `DESIGN-dispatch-dedup-guard-v2.md` covers this (it exists in workspace)
