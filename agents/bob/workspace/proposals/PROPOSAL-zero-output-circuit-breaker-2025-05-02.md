# PROPOSAL: Zero-Output Circuit Breaker for Worker Workflows

**Author**: Bob | **Date**: 2025-05-02 | **Priority**: P1
**For**: tech-lead | **Related**: EXP-296, ANALYSIS-zero-output-loops-2025-05-02

## Problem

Worker workflows loop indefinitely when agents produce 0 files per iteration. Recent data shows 4+ sessions hitting 28 iterations with zero output — burning tokens for nothing. The evaluator scores these 0.0-0.2.

## Evidence

| Session | Agent | Iterations | Quality |
|---------|-------|-----------|---------|
| s_1777483248275_448 | coach | 28+ | 0.0 |
| s_1777483248236_446 | optimizer | many | 0.1 |
| s_1777483248263_447 | optimizer | 6+ | 0.2 |

## Proposed Change

In the workflow runner's iteration loop, add:

```typescript
// After each iteration completes, check output
let consecutiveZeroOutput = 0;
const MAX_ZERO_OUTPUT_ITERATIONS = 3;

// In the iteration callback:
if (iterationOutputFiles.length === 0) {
  consecutiveZeroOutput++;
  if (consecutiveZeroOutput >= MAX_ZERO_OUTPUT_ITERATIONS) {
    return {
      status: 'failure',
      reason: 'ghost_completion_loop',
      message: `${consecutiveZeroOutput} consecutive iterations produced 0 files. Circuit breaker triggered.`
    };
  }
} else {
  consecutiveZeroOutput = 0; // reset on success
}
```

## Location

The logic should go in whichever file orchestrates the "dispatch iteration → check result → dispatch again" loop. Likely `agents/shared/workflows/workflow-runner.ts` or the project iteration handler.

## Expected Impact

- Saves ~25 wasted iterations per ghost-completion incident (at ~$0.10-0.30 per iteration)
- Prevents evaluator from scoring 28-iteration disasters
- Surfaces the real problem (agent confusion about project state) earlier for human review

## Alternatives Considered

1. **Prompt-only fix** (Layer 1 from EXP-296): Already partially deployed via session awareness text. Insufficient alone — model sometimes ignores it.
2. **Increase maxRetries in worker-retry.ts**: Wrong layer — that's per-iteration error retry, not the workflow loop.
3. **Kill after N minutes**: Too blunt — some legitimate tasks take many iterations.

## Success Metric

Ghost completion sessions/week drops from 4+ to 0-1 within 7 days of deployment.

## Action Requested

Tech-lead: implement the circuit breaker in the workflow iteration loop. This is a ~20-line change with high ROI.
