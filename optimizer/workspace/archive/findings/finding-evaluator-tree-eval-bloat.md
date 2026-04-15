# Finding: Evaluator Tree-Eval Transcript Bloat

**Date**: 2026-03-18T18:30
**Impact**: Moderate ($2.52/day in evaluator costs, 47 sessions/day)
**Status**: Fix proposed, awaiting implementation

## Problem

The `evaluateTask()` function in `src/lib/evaluator.ts` sends full formatted transcripts of all child sessions as a single task message to the evaluator agent. This creates massive payloads:

- **622 tree-eval sessions** observed (all-time)
- **38 tree-evals in last 24h** with 2,255KB total task payloads
- **Average task size: 59KB**, max **341KB** (4 coach sessions with transcripts up to 130KB each)
- **Average ops: 1.8** — evaluator barely does anything with these massive inputs
- **9 retry sessions** (24%) when evaluator fails to produce valid JSON

### Size distribution
- P50: 28KB, P75: 50KB, P90: 82KB, Max: 341KB

### Root cause
`formatTranscript()` truncates individual tool results to 2000 chars, but there's **no cap on overall transcript length per session**. A coach session with 56 ops generates a 130KB transcript.

## Proposed Fix

Add a per-session transcript budget in `evaluateTask()`:

```typescript
// In evaluateTask(), after formatTranscript()
const MAX_TRANSCRIPT_PER_SESSION = 15_000; // ~15KB per session
if (transcript.length > MAX_TRANSCRIPT_PER_SESSION) {
  // Keep first 5KB (task start) + last 10KB (conclusion/results)
  transcript = transcript.slice(0, 5_000) + 
    '\n\n[... transcript truncated for review brevity ...]\n\n' +
    transcript.slice(-10_000);
}
```

### Expected savings
- 32% reduction in tree-eval payload sizes (24.1MB → ~16.4MB all-time)
- Fewer retry sessions (smaller payloads → evaluator more likely to produce valid JSON)
- Estimated: $0.80-1.00/day savings

### Alternative: Evaluate per-session instead of per-tree
Instead of batching all child sessions into one massive eval, evaluate each child session individually. This would:
- Cap each eval at ~30-40KB instead of 100-340KB
- Enable better prompt caching (same system prompt reused)
- Reduce retry waste (one bad parse doesn't lose all evaluations)

## Evidence

```
# From analysis of last 50 sessions:
evaluator: 3/5 sessions with ≤1 op (wasted sessions)

# From 24h tree-eval analysis:
38 tree-evals, 9 retries = 47 sessions
2,255KB total task messages
Average 1.8 ops per tree-eval session
6 sessions with 0 ops (complete waste)
Task sizes: 0.6KB to 341KB
```
