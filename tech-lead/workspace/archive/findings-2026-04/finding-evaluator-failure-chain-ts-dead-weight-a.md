# Finding: evaluator-failure-chain.ts Dead Weight Audit

**File**: `src/lib/evaluator-failure-chain.ts` (476 LOC)
**Lens**: C (Dead Weight)
**Date**: 2026-04-16

## Summary

**No significant dead weight found.** This file is well-structured and fully consumed.

## Evidence

### Exports (all consumed)
- `FailureStep` (interface, L14) — imported by `src/lib/evaluator.ts:98`, re-exported at L100, used in test files
- `FailureChain` (interface, L22) — imported by `src/lib/evaluator.ts:98`, re-exported at L100, used in test files
- `extractFailureChains` (function, L260) — imported by `src/lib/evaluator.ts:97`, called at L471 and L826; also re-exported via `src/lib/index.ts:74`
- `formatFailureChains` (function, L447) — imported by `src/lib/evaluator.ts:97`, called at L499 and L827; also re-exported via `src/lib/index.ts:76`

### Internal helpers (all called within file)
- `isFindWithNoResults` (L46) — called in `isToolOwnError` at ~L238
- `isTestOrBuildRunner` (L96) — called in `isExpectedNonZeroExit` at ~L185
- `isExistenceCheck` (L121) — called in `isExpectedNonZeroExit` at ~L192
- `isExpectedNonZeroExit` (L139) — called in `isToolOwnError` at ~L232
- `isToolOwnError` (L218) — called in `extractFailureChains` pair-building loop at ~L301
- `pairToStep` (L352) — called in chain extraction loop (L316, L332, L329)
- `detectIntent` (L365) — called in chain extraction at L324
- `isRecoveryAttempt` (L378) — called in chain extraction at L328
- `matchesOriginalIntent` (L403) — called in chain extraction at L330
- `diagnoseRootCause` (L419) — called in chain extraction at L340

### Test coverage
Two test files exercise this module:
- `test/evaluator-failure-chain.test.ts` — direct import tests
- `test/failure-chains.test.ts` — tests via re-export from evaluator.ts

## Severity

**None** — no dead code, no unused exports, no redundant logic.

## Recommended Action

No action needed. This file is clean.
