# Gym Scoring System — Known Issues & Fixes

## callIndex vs entryIndex (commit `3919694`, 2026-03-20)
- **Bug**: `hasVerificationAfterWrite` used `entryIndex` to order tool calls. Parallel tool calls in the same assistant turn share `entryIndex`, so same-turn write+verify was never detected.
- **Fix**: Added `callIndex` (sequential counter across ALL tool calls in transcript) to `ToolCall` interface. Use `callIndex` (not `entryIndex`) for ordering in:
  - `test/gym/lib/transcript-utils.ts`
  - `test/gym/lib/gym-score-utils.cjs`
  - Scenario-specific `success_criteria.js` files
- **Rule**: When comparing tool call order, always use `callIndex`. `entryIndex` groups by conversation turn, not by execution order.

## CJS/TS Sync Problem
- **Bug**: `gym-score-utils.cjs` is a manual CJS copy of the TS source. Gym runner copies `lib/` into temp dirs. If CJS isn't rebuilt after TS source changes, gym runs use stale scoring logic.
- **Symptom**: `Cannot read properties of undefined (reading 'includes')` errors in convention checks (C2.3, C30, etc.) — all convention checks fail, making growth-cycle pipeline unreliable.
- **Rule**: After changing `transcript-utils.ts` or scoring logic, always rebuild/sync the `.cjs` copy before running gym experiments.

## Scorer Argument Access
- **Bug** (sprint 5, 2026-03-20): 7 scorers used `c.args` instead of `c.arguments` to access tool call arguments. `c.args` is undefined.
- **Rule**: Tool call arguments are accessed via `c.arguments`, never `c.args`.

## Ceiling Effects in Experiments
- Pattern: Some experiments show FIXED/FAIL but the original failure was transient — baseline now passes without any SOUL change.
- Examples: exp-116 (bob sycophants-dilemma 7/7 baseline), exp-117 (coder error-recovery 4/4 after scorer bugfix).
- **Rule**: Always run fresh baselines before concluding a fix worked. If baseline passes, the experiment result is CEILING (not a real improvement).
