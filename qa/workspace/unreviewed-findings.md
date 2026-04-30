# QA Heartbeat — Unreviewed Findings (2026-04-30)

## 1) CRITICAL: TypeScript build is failing (duplicate export names)

**Reproduced (this session):** `cd agents && ./node_modules/.bin/tsc --noEmit` fails with:
- `shared/lib/index.ts(13,1): error TS2308: Module './iteration-monitor.js' has already exported a member named 'IterationRecord'.`
- `shared/lib/index.ts(16,1): error TS2308: Module './task-validator.js' has already exported a member named 'ValidationResult'.`

**Evidence:** `agents/shared/lib/index.ts` is a barrel file with multiple `export * from ...` lines, including:
- `export * from './task-validator.js';`
- `export * from './iteration-monitor.js';`

This pattern will surface name collisions across re-exported modules.

**Impact:** TypeScript compilation fails (exit code 2), which blocks builds/CI.

**Suggested fix direction (owner):** Replace `export *` for colliding modules with explicit named exports (or rename on export), or switch to namespace exports for one module.

---

## 2) IMPORTANT: Vitest reports all tests passing but exits non-zero due to EACCES cache write

**Reproduced (this session):** `cd agents && ./node_modules/.bin/vitest --run`
- Summary shows: `Test Files 31 passed (31)` / `Tests 536 passed (536)`
- Then throws an unhandled error and exits with code 1:
  - `Error: EACCES: permission denied, open '/app/agents/node_modules/.vite/vitest/results.json'`

**Evidence:** permissions/ownership show the cache directory is owned by root:
- `agents/node_modules/.vite/vitest` is `root:root` (not writable by the runtime user).

**Impact:** automation treats test run as failure despite tests passing.

**Suggested fix direction (owner):** Make `agents/node_modules/.vite/**` writable for the running user (ownership/permissions), or configure vitest results/cache output to a writable path.

---

## 3) MINOR: Commands must be run from `/app/agents` (repo root)

Running git/tsc/vitest from `/app` fails because it is not a git repo and doesn’t contain `node_modules/.bin/*`.
