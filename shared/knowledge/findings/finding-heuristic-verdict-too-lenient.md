# Finding: Heuristic Evaluator Verdict Too Lenient

**Date**: 2026-03-18T06:03  
**Severity**: Medium (quality signal degradation)  
**Location**: `src/lib/evaluator.ts` → `computeHeuristicScores()`

## Problem

The heuristic evaluator's verdict logic doesn't consider the productive/wasted call ratio. A session with **0 productive calls and 42 wasted calls** (100% waste) gets rated "acceptable" because:

1. `efficiency` starts at 3
2. Error penalties cap at -1 per category  
3. Verdict threshold: `acceptable` = quality≥2 AND efficiency≥2
4. Result: efficiency=2, quality=4 → "acceptable"

This means sessions that accomplish literally nothing are indistinguishable from sessions that do useful work with a few errors.

## Evidence

- `s_1773811688106_497` (tech-lead): 0 productive, 42 wasted → verdict "acceptable"
- `s_1773810307155_482` (bob): 0 productive, 0 wasted → verdict "needs_improvement" (only because it's also shallow)

## Root Cause

The verdict computation (line ~941 in evaluator.ts) only uses the final `efficiency` and `quality` scores which are clamped 1-5. Since penalties max out at -1 per issue category, even catastrophic sessions only drop to efficiency=2 (from base 3), which passes the "acceptable" bar.

## Proposed Fix

Add a productive call ratio check to the verdict logic:

```typescript
// After computing productiveCalls and wastedCalls:
const wasteRatio = totalToolCalls > 0 ? wastedCalls / totalToolCalls : 0;

// Penalize heavily wasteful sessions
if (wasteRatio > 0.5 && totalToolCalls > 5) {
  efficiency -= 1;
  issues.push("majority_wasted_calls");
}
if (productiveCalls === 0 && totalToolCalls > 3) {
  efficiency -= 1;
  quality -= 1;
  issues.push("zero_productive_work");
}
```

This ensures sessions with 100% wasted calls get `needs_improvement` instead of `acceptable`.

## Impact

- Affects ~10-15% of evaluated sessions (those with high waste but passing current threshold)
- Improves signal quality for downstream consumers (Coach training, Optimizer analysis)
- No false positives: only triggers when waste is genuinely dominant
