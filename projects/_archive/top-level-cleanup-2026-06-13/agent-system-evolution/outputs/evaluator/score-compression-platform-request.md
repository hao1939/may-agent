# Platform Request: Evaluator Score Compression Fix

**Status**: NOT ADOPTED — packaging as platform request  
**Date**: 2026-05-25  
**Origin**: `projects/agent-system-evolution/outputs/evaluator/score-compression-experiment.md`

## Problem

The evaluator heuristic path (line 439 of `agents/evaluator/workflows/evaluator-aftermath.ts`) assigns a flat `quality=0.85` to all "good" verdict sessions. This produces extreme score compression:

| Metric (last 72h, "good" verdict sessions) | Value |
|----|------|
| Total "good" sessions | 3,075 |
| Sessions with quality=0.85 | 2,686 (87%) |
| Heuristic-evaluated sessions | 2,616 (85%) |
| Unique quality values for "good" | ~10 (but 87% at single value) |

Sessions doing 5 ops with 1 output signal are scored identically to sessions doing 27 ops with 5 verified artifacts.

## Proposed Fix

Replace the flat mapping at line 439:
```typescript
quality: failed ? 0.2 : finishOnlySelfRepaired ? 0.85 : issues.length ? 0.55 : 0.85,
```

With a weighted sub-dimension calculation:
```typescript
function computeQuality(session: { opCount: number; lane: string; outputSignals: string[]; productiveCalls: number; wastedCalls: number; failed: boolean; finishOnlySelfRepaired: boolean; issues: string[] }): number {
  if (session.failed) return 0.2;
  if (session.issues.length) return 0.55;
  
  const base = 0.70;
  const signalBonus = Math.min(session.outputSignals.length * 0.03, 0.15);
  const depthBonus = session.opCount >= 20 ? 0.10 : session.opCount >= 10 ? 0.05 : 0;
  const wasteRatio = session.wastedCalls / Math.max(session.productiveCalls + session.wastedCalls, 1);
  const efficiencyAdj = (wasteRatio > 0.2) ? -0.05 : (session.wastedCalls === 0 && session.opCount >= 5) ? 0.05 : 0;
  const lanePenalty = session.lane === 'routine_ok' ? -0.05 : 0;
  
  return Math.max(0.60, Math.min(1.00, base + signalBonus + depthBonus + efficiencyAdj + lanePenalty));
}
```

All inputs (`lane`, `outputSignals`, `productiveCalls`, `wastedCalls`, `opCount`) are already available in the heuristic evaluation context.

## Before/After Variance Data (from experiment on 15 sessions)

| Metric | Before (v1) | After (v2) |
|--------|-------------|------------|
| Unique quality values | 2 | 7 |
| Score_1_5 distribution | {5:14, 3:1} | {5:5, 4:8, 3:1} |
| Quality stdev | 0.075 | 0.097 |
| % at modal score | 93% | 33% |
| Effective score categories used | 2 | 4 |

## Acceptance Criteria

1. Quality scores for "good" verdict heuristic sessions span at least [0.70, 0.97]
2. No two sessions with different (lane, signalCount, opCount≥10 bucket) combinations receive the same quality score
3. Score_1_5 distribution across 50 "good" sessions uses at least 3 distinct values
4. Backward compatible: `failed`, `issues.length > 0` paths unchanged
5. `finishOnlySelfRepaired` sessions use the same v2 formula (remove special-case to 0.85)

## Impact

- Enables meaningful evaluator feedback differentiation
- Allows score-based quality trends to detect regressions
- Supports agent skill-level scoring for delegation decisions
- ~20-line patch, no transcript re-reading required
