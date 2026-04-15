# Audit: evaluator-failure-chain.ts Dead Weight

**Date**: 2026-04-15  
**Target**: `src/lib/evaluator-failure-chain.ts` (476 lines)  
**Method**: Enumerate all exports → search for production consumers in `src/` and `agents/`

## Summary

**No dead exports found.** All 4 exports from `evaluator-failure-chain.ts` are actively consumed by `src/lib/evaluator.ts`, which re-exports them via `src/lib/index.ts`. The module is lean — only 4 exports and 9 internal helper functions, all called within the two exported functions.

## Export Inventory

| Export | Type | Direct Consumer | Used At |
|--------|------|----------------|---------|
| `FailureStep` | interface | `evaluator.ts:98` (import type + re-export) | Type used in FailureChain fields |
| `FailureChain` | interface | `evaluator.ts:98` (import type + re-export) | `evaluator.ts:60,458,471` |
| `extractFailureChains` | function | `evaluator.ts:97,471` | Called in `evaluateTask()` per child session |
| `formatFailureChains` | function | `evaluator.ts:97,499` | Called in `evaluateTask()` to format for prompt |

All 4 are re-exported through `src/lib/index.ts:74-86`.

## Consumer Chain

```
evaluator-failure-chain.ts
  └── evaluator.ts (imports all 4, uses extractFailureChains + formatFailureChains in evaluateTask())
       └── index.ts (re-exports all 4 for public API)
```

No other file in `src/` imports directly from `evaluator-failure-chain.ts` — the module is exclusively consumed through `evaluator.ts`.

## Internal Helpers (not exported — not dead weight)

9 private functions, all called within `extractFailureChains()` or `formatFailureChains()`:
- `isFindWithNoResults` (line 43) — called in `extractFailureChains`
- `isTestOrBuildRunner` (line 99) — called in error classification
- `isExistenceCheck` (line 135) — called in error classification
- `isExpectedNonZeroExit` (line 154) — called in error classification
- `isToolOwnError` (line 227) — called in error classification
- `pairToStep` (line 351) — called in chain building
- `detectIntent` (line 365) — called in chain building
- `isRecoveryAttempt` (line 378) — called in chain building
- `matchesOriginalIntent` (line 403) — called in chain building
- `diagnoseRootCause` (line 419) — called in chain building

## Related Finding: Type Duplication

`agents/may/handlers/tool-quality-scan.ts` defines its own `FailureChain` interface (line 33) rather than importing from the canonical module. This is a duplication, not dead weight, but worth noting for future cleanup.

## Verdict

**No action needed.** The module has zero dead exports. The Apr 12 evaluator cleanup did not orphan any code in this file. The module is well-scoped: 2 functions + 2 types, all consumed.

## Recommended Follow-up (low priority)

- Consider whether `tool-quality-scan.ts` should import `FailureChain` from the canonical source instead of redefining it.
