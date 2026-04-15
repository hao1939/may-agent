# Fix: repo-gate-check.ts uses `npx` which doesn't exist

## Problem
`agents/may/handlers/repo-gate-check.ts` uses `npx tsc --noEmit` and `npx vitest --run`
but `npx` is not available in the runtime environment. This causes both gates to always
fail with `/bin/sh: 1: npx: not found`, making QA gate results useless.

Evidence from `.state/qa-gate-results.json`:
```json
"tsc": {"pass": false, "output": "/bin/sh: 1: npx: not found\n", "durationMs": 1},
"vitest": {"pass": false, "output": "/bin/sh: 1: npx: not found\n", "durationMs": 0}
```

## Fix
Replace `npx` with direct `node_modules/.bin/` paths (both binaries confirmed present):

### Change 1 (line ~232):
```
OLD: const output = execSync("npx tsc --noEmit 2>&1", {
NEW: const output = execSync("node_modules/.bin/tsc --noEmit 2>&1", {
```

### Change 2 (line ~258):
```
OLD: const output = execSync("npx vitest --run 2>&1", {
NEW: const output = execSync("node_modules/.bin/vitest --run 2>&1", {
```

## Impact
- QA gate will actually run tsc and vitest checks
- QA agent will get accurate pass/fail data instead of false failures
- No behavioral change — same commands, just different path resolution

## Verification
After fix, wait for next repo-gate-check run and verify `.state/qa-gate-results.json` 
no longer shows "npx: not found".
