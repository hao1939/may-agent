# Finding: Vitest Cache Pollution (2026-03-30)

## Problem
vitest was discovering 175 test files from `.state/.bun/install/cache/` (e.g., zod's own tests in `.state/.bun/install/cache/zod/4.3.6@@@1/src/v3/tests/`). These third-party tests were:

1. **Noisy QA output** — zod test lines mixed with real project tests
2. **Slower test runs** — 293 total files collected vs 118 real project files
3. **Misleading test counts** — evaluator saw inflated test totals
4. **Contributing to `bash:other` waste** — vitest runs failing/timing out from the extra load

## Root Cause
`vitest.config.ts` only excluded `**/node_modules/**` and `**/dist/**`. The bun package cache at `.state/.bun/install/cache/` was not excluded, and vitest's glob pattern matched test files inside it.

## Fix
Added `.state/**` to vitest.config.ts exclude list (commit aee8a66).

```diff
 exclude: [
   "**/node_modules/**",
   "**/dist/**",
+  ".state/**",
   "agents/gym/scenarios/**/environment/**",
 ],
```

## Impact
- Test file count: 293 → 118 (60% reduction)
- Collection time: reduced (175 fewer files to scan/parse)
- No real tests lost — all excluded files are third-party package tests
- Cleaner QA output for evaluator to assess

## Verification
- `vitest --run` output shows 118 test files, 1641 tests total
- No `.state/` paths appear in test output
- `find .state/.bun/install/cache -name "*.test.ts" -o -name "*.test.js" | wc -l` = 175
