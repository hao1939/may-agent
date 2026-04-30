# Unreviewed Findings (QA heartbeat)

## 2026-04-30

### TypeScript build is failing (CRITICAL)

- Command: `./node_modules/.bin/tsc --noEmit`
- Fails with duplicate re-export name collisions in `shared/lib/index.ts`:
  - `shared/lib/index.ts(13,1): Module './iteration-monitor.js' has already exported a member named 'IterationRecord'.`
  - `shared/lib/index.ts(16,1): Module './task-validator.js' has already exported a member named 'ValidationResult'.`

**Impact:** Any consumer compiling TS in this repo will fail typechecking.

**Likely cause:** Barrel export file `shared/lib/index.ts` re-exports multiple modules that each export overlapping symbol names (e.g., `IterationRecord`, `ValidationResult`) and TS considers them ambiguous.

**Suggested fix direction:** In `shared/lib/index.ts`, replace `export * from './iteration-monitor.js'` and/or the conflicting module with explicit re-exports, e.g.
`export { IterationMonitor, type IterationRecord } from './iteration-monitor.js'` and ensure no other re-export defines `IterationRecord` under same name. Similar for `ValidationResult`.

### Vitest tests pass but runner exits non-zero due to permissions (IMPORTANT, env)

- Command: `./node_modules/.bin/vitest --run`
- All tests pass: `536 passed (536)` across `31` files.
- But Vitest exits with error:
  - `EACCES: permission denied, open '/app/agents/node_modules/.vite/vitest/results.json'`

**Impact:** CI/local runs may fail despite green tests.

**Likely cause:** `node_modules/.vite` directory is not writable under current user.

**Suggested fix direction:** Ensure `node_modules/.vite` is writable (permissions/ownership), or configure Vitest cache/results output to a writable location.
