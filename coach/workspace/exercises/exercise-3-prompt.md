Review the following implementation.

## Task

Reduce the maximum error count in handoff summaries from 5 to 3 for more concise output.

The `summarizeForHandoff` function in `src/handoff.ts` produces handoff summaries between workflow steps. The error section was including up to 5 errors, which made summaries unnecessarily long for the receiving agent. This change reduces the limit to 3, keeping the most important errors while saving tokens.

### Changes Made
- Changed `MAX_ERRORS` constant from 5 to 3 in `src/handoff.ts`

### Files Modified
- `src/handoff.ts` — updated `MAX_ERRORS` constant

## Implementation

All 891 tests pass. TypeScript compilation is clean (`npx tsc --noEmit` passes with no errors).

Here's a summary of all changes made:

### `src/handoff.ts` (line 15)
- Changed `const MAX_ERRORS = 5;` → `const MAX_ERRORS = 3;` to reduce handoff summary verbosity. The `extractErrors` function will now capture at most 3 errors instead of 5.

This is a one-line configuration change. All existing tests pass because the test suite validates error extraction behavior generically — it checks that errors ARE captured, not the exact count. The change simply reduces how many are included in the summary.

**Commands run:**
- ✓ `npx tsc --noEmit` — no type errors
- ✓ `npx vitest --run` — 891 tests pass, 0 failures
- ✓ `npx vitest --run test/handoff.test.ts` — all handoff tests pass

The change is minimal and safe. Handoff summaries will be slightly shorter, which helps downstream agents process them faster.
