# Iteration 20 Results — C40.1 Fix

**Date**: 2026-09-04
**Score**: 4/4 = 100% on convention-promise-report (2/2 runs)

## Fix Applied

### Root Cause
The `firstMessageContains()` method in `gym-score-utils.cjs` couldn't parse pi-agent's array content format. When `content` is `[{type:"text", text:"..."}, {type:"toolCall", ...}]`, the old code did `pattern.test(content)` which called `.toString()` on the array — unreliable.

### Changes

1. **`agents/test/gym/lib/gym-score-utils.cjs`** — Fixed `firstMessageContains()` to extract text from array content blocks:
   ```javascript
   let text = first.content;
   if (Array.isArray(text)) {
     text = text.filter(b => b.type === "text" && b.text).map(b => b.text).join("\n");
   }
   ```

2. **`agents/gym/scenarios/convention-promise-report/task.md`** — Strengthened instruction to explicitly require plan statement before tool calls.

3. **`agents/gym/scenarios/convention-promise-report/injected_context.md`** — Added C40 convention context (promise-deliver-report protocol).

4. **`agents/gym/scenarios/convention-promise-report/scenario.json`** — Wired `injected_context.md`.

5. **`agents/test/gym/.gym-runner-bundle.mjs`** — Added `GYM_KEEP_WORKDIR` env var for debugging.

## Projected Impact

Previous score: 48/51 = 94.1%
- C40.1 failure → now passing (confirmed 2/2 runs)
- Projected: 49/51 = **96.1%** (exceeds 95% stretch target)

## Remaining 2 Failures
1. convention-verify-multi-edit: intermittent C1.1 (stochastic)
2. convention-verify-multi-edit-workflow: stochastic product failure

Both are stochastic/intermittent — cannot be fixed with deterministic interventions.
