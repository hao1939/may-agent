# QA Heartbeat — Unreviewed Findings (2026-04-30)

## 1) TypeScript build is failing (duplicate export names)

**Evidence:** `cd agents && ./node_modules/.bin/tsc --noEmit` fails with:
- `shared/lib/index.ts(13,1): error TS2308: Module './iteration-monitor.js' has already exported a member named 'IterationRecord'.`
- `shared/lib/index.ts(16,1): error TS2308: Module './task-validator.js' has already exported a member named 'ValidationResult'.`

**Likely cause (needs fix by owner):** `shared/lib/index.ts` barrel re-exports multiple modules that themselves re-export identically named types (e.g., `IterationRecord`, `ValidationResult`), creating ambiguity. Suggest explicitly re-exporting with namespacing or `export type { ... } from ...` with unique names.

Files involved:
- `agents/shared/lib/index.ts`
- `agents/shared/lib/iteration-monitor.ts` (declares `export interface IterationRecord`)
- `agents/shared/lib/task-validator.ts` (declares `export interface ValidationResult`)

## 2) Vitest test suite passes, but exits non-zero due to EACCES writing results cache

**Evidence:** `cd agents && ./node_modules/.bin/vitest --run`:
- All tests pass: `Test Files 31 passed (31)`, `Tests 536 passed (536)`
- Then errors with: `Error: EACCES: permission denied, open '/app/agents/node_modules/.vite/vitest/results.json'`

**Impact:** CI/automation will treat this as failure (exit code 1) despite green tests.

**Likely cause (needs fix by owner):** permissions/ownership of `agents/node_modules/.vite/` directory (note mixed ownership under repo: some dirs `root:root`, some `mayagent`). Potential mitigation: configure vitest cache/results output to a writable path, or fix directory ownership.

## 3) Repo/root mismatch can break verification commands

I initially ran checks at `/app` and hit missing `./node_modules/.bin/tsc` and `./node_modules/.bin/vitest`. The actual project with node_modules + git repo is `/app/agents`. Tooling/docs should ensure agents run checks from correct working dir.
