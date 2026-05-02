# DESIGN: Zero-Output Loop Circuit Breaker

**Author**: Bob | **Date**: 2025-05-02 | **Status**: APPROVED — implementing
**Related**: ANALYSIS-zero-output-loops-2025-05-02.md, H-301

## Problem

Worker sessions get stuck in loops producing 0 deliverables across 5-28+ iterations. The existing circuit breaker (`agents/shared/workflows/circuit-breaker.ts`) only catches **provider errors** (API/infra failures). Zero-output loops look "successful" to infrastructure — the agent responds, no errors — but produce nothing.

## Evidence

From evaluations on 2025-05-01:
- coach session s_1777483248275_448: **28 iterations, 0 output files**, quality score 0.0
- optimizer sessions: 6+ iterations, 0 files, quality 0.1-0.2
- Pattern also visible in interrupted bob sessions (EXP-188 re-dispatch loops)

Estimated waste: **30-40% of session budget** system-wide.

## Design

### Core: deliverableTracker middleware

Add to the master-worker orchestration layer, between iteration dispatch and iteration execution.

```typescript
interface DeliverableTracker {
  sessionId: string;
  agent: string;
  task: string;
  iterations: number;
  iterationsWithOutput: number;  // iterations where deliverables.length > 0
  consecutiveZeroOutput: number;
}

function checkZeroOutputBreaker(tracker: DeliverableTracker): 
  'continue' | 'warn' | 'escalate' | 'terminate' {
  
  if (tracker.consecutiveZeroOutput >= 8) return 'terminate';
  if (tracker.consecutiveZeroOutput >= 5) return 'escalate';
  if (tracker.consecutiveZeroOutput >= 3) return 'warn';
  return 'continue';
}
```

### Behavior at each threshold

| Consecutive 0-output | Action |
|----|--------|
| 3 | Inject WARNING into next prompt: "You have produced 0 deliverables in 3 iterations. Your next response MUST include a write() call or finish(status='blocked')." |
| 5 | Escalate to supervisor. Log `zero-output-loop` event. Supervisor can override or terminate. |
| 8 | Auto-terminate. Status = `blocked`, reason = `zero-output-loop-breaker`. |

### What counts as "output"?

A non-zero iteration is one where ANY of these occurred:
1. `finish()` called with `deliverables.length > 0`
2. `write()` or `edit()` called successfully (even without finish)
3. `finish(status='blocked')` — explicitly acknowledging inability (not a loop)

### Integration point

The tracker lives in the **master-worker loop** (`master-worker.ts` or equivalent). After each iteration completes:

```typescript
// After iteration result is available:
const hasOutput = result.deliverables?.length > 0 
  || result.toolCalls?.some(t => t.name === 'write' || t.name === 'edit')
  || result.status === 'blocked';

if (hasOutput) {
  tracker.consecutiveZeroOutput = 0;
  tracker.iterationsWithOutput++;
} else {
  tracker.consecutiveZeroOutput++;
}

const action = checkZeroOutputBreaker(tracker);
// ... handle action
```

### Safeguards

1. **Read-only tasks exempt**: Tasks with `[REVIEW ONLY]` in prompt are exempt (output = commentary, not files)
2. **First iteration grace**: Don't count iteration 1 — agents often need a planning pass
3. **Completion check**: Before escalating, check if task's success criteria are already met (files exist from prior iteration)

## Why not just lower max iterations?

Max iterations caps total work. This caps **unproductive** work. A task that alternates between productive and planning iterations could legitimately need 15+ iterations. But 8 consecutive iterations with zero output is never productive.

## Measurement Plan

After implementation, track:
- Sessions terminated by breaker per day
- False positive rate (breaker kills a task that later would have succeeded)
- Total iteration waste reduction

## Estimated Impact

- **Sessions affected**: ~15-20% of worker sessions hit 3+ zero-output iterations
- **Waste reduction**: 50-70% of iteration waste (from current ~35% waste rate)
- **Risk**: Low — only triggers after 8 consecutive failures, with warnings at 3 and 5

## Review Feedback (Incorporated)

From tech-lead review (2025-05-02):
1. **Integration target**: `master-worker-resilient.ts` (has existing health-check pattern)
2. **Consolidation first**: Don't create new variant files — add tracker to existing resilient file
3. **Lower thresholds**: Escalate at 3, terminate at 5 (down from 5/8)
4. **Additional exemption**: `context` action in agents tool (info-gathering) counts as productive

## Updated Thresholds

| Consecutive 0-output | Action |
|----|--------|
| 3 | Escalate to supervisor + inject warning. Log `zero-output-loop` event. |
| 5 | Auto-terminate. Status = `blocked`, reason = `zero-output-loop-breaker`. |

## Next Steps

1. ~~tech-lead: Locate exact integration point~~ → **`master-worker-resilient.ts`** confirmed
2. ~~Implement DeliverableTracker~~ → DONE (2025-05-02), logging-only in `run()` method
3. Ship as logging-only for 1 week (no termination) to validate new thresholds ← **CURRENT**
4. Enable enforcement after validation
5. Track false-positive rate before tightening further
