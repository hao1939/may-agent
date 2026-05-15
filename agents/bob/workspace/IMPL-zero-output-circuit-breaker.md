# IMPL: Zero-Output Loop Circuit Breaker

**Date**: 2025-05-02 | **Target**: `agents/shared/workflows/master-worker-resilient.ts`
**Design**: DESIGN-zero-output-circuit-breaker.md (APPROVED)

## Implementation Plan

### Phase 1: Logging-only (this PR)

Add `DeliverableTracker` to the resilient master-worker loop. Log events but don't terminate.

#### Code to add in `master-worker-resilient.ts`:

```typescript
// --- Zero-Output Loop Detection ---

interface DeliverableTracker {
  consecutiveZeroOutput: number;
  totalIterations: number;
  iterationsWithOutput: number;
}

function createDeliverableTracker(): DeliverableTracker {
  return { consecutiveZeroOutput: 0, totalIterations: 0, iterationsWithOutput: 0 };
}

/** What counts as output (non-zero iteration) */
function hasDeliverableOutput(result: IterationResult): boolean {
  // Deliverables reported in finish()
  if (result.deliverables && result.deliverables.length > 0) return true;
  // Explicit blocked status (not a loop — agent is aware)
  if (result.status === 'blocked') return true;
  // write/edit tool calls detected
  if (result.toolCalls?.some(t => t.name === 'write' || t.name === 'edit')) return true;
  // agents tool with 'context' action (info-gathering, exempt per review)
  if (result.toolCalls?.some(t => t.name === 'agents' && t.params?.action === 'context')) return true;
  return false;
}

const ZERO_OUTPUT_ESCALATE = 3;
const ZERO_OUTPUT_TERMINATE = 5;

function checkZeroOutput(tracker: DeliverableTracker): 'continue' | 'escalate' | 'terminate' {
  if (tracker.consecutiveZeroOutput >= ZERO_OUTPUT_TERMINATE) return 'terminate';
  if (tracker.consecutiveZeroOutput >= ZERO_OUTPUT_ESCALATE) return 'escalate';
  return 'continue';
}
```

#### Integration point (after each iteration completes):

```typescript
// In the iteration loop, after result is available:
tracker.totalIterations++;

// Skip first iteration (planning grace)
if (tracker.totalIterations > 1) {
  if (hasDeliverableOutput(result)) {
    tracker.consecutiveZeroOutput = 0;
    tracker.iterationsWithOutput++;
  } else {
    tracker.consecutiveZeroOutput++;
  }
}

const zeroAction = checkZeroOutput(tracker);
if (zeroAction !== 'continue') {
  logger.warn(`[zero-output-breaker] ${zeroAction}: ${tracker.consecutiveZeroOutput} consecutive zero-output iterations`, {
    sessionId, agent, task: taskSummary,
    tracker,
  });
  // Phase 1: log only. Phase 2 will add termination.
}
```

### Phase 2: Enforcement (after 1 week of data)

- At `escalate`: inject warning into next iteration prompt
- At `terminate`: stop loop, return `status: 'blocked'` with reason `zero-output-loop-breaker`

### Exemptions

- First iteration (planning pass)
- Tasks with `[REVIEW ONLY]` in prompt
- `read()` calls don't count as output, but `agents(action='context')` does

### Testing

Add to `agents/shared/tests/master-worker-resilient.test.ts`:
1. Test tracker increments correctly
2. Test `hasDeliverableOutput` with various result shapes
3. Test thresholds trigger at 3 and 5
4. Test first-iteration grace period

### Success Criteria

- [x] Phase 1 implementation merged into `master-worker-resilient.ts` with logging-only mode
- [x] Tests added: 13 new tests covering tracker, hasDeliverableOutput, thresholds, grace period
- [x] All 36 tests pass in `master-worker-resilient.test.ts` (verified 2025-05-02)
- [x] Review feedback incorporated: thresholds at 3/5, first-iteration grace, context exemption
- [ ] Tracker logging appears in production logs — **awaiting data** (checked 2025-05-02, no logs yet)
- [ ] No false positives on legitimate planning-heavy tasks
- [ ] After 1 week: data shows clear separation between stuck loops and productive sessions
- [ ] Phase 2: Enable enforcement (prompt injection at escalate, termination at terminate)

### Monitoring Checklist (check each heartbeat)
- 2025-05-02: No log entries yet (circuit breaker deployed but no sessions triggered it)
