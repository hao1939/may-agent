# QA Heartbeat — Unreviewed Findings (2026-04-30)

## A) CRITICAL: TypeScript build is failing (duplicate export names)

**Reproduced:** `cd agents && ./node_modules/.bin/tsc --noEmit` fails:
- `shared/lib/index.ts(13,1): error TS2308: Module './iteration-monitor.js' has already exported a member named 'IterationRecord'.`
- `shared/lib/index.ts(16,1): error TS2308: Module './task-validator.js' has already exported a member named 'ValidationResult'.`

**Evidence file:** `agents/shared/lib/index.ts` is a barrel with `export * from ...` for many modules.

**Likely cause:** at least two re-exported modules share exported names (`IterationRecord`, `ValidationResult`), and barrel `export *` makes them collide.

**Suggested fix direction (owner):** replace `export *` for the colliding modules with explicit named exports and/or rename on export; alternatively use namespace exports.

## B) IMPORTANT: Vitest suite runs green but exits non-zero due to EACCES cache write

**Reproduced:** `cd agents && ./node_modules/.bin/vitest --run`:
- Reports `Test Files 31 passed (31)` and `Tests 536 passed (536)`
- Then exits with: `Error: EACCES: permission denied, open '/app/agents/node_modules/.vite/vitest/results.json'`

**Confirmed cause:** `agents/node_modules/.vite/**` is owned by `root:root` (not writable by the running user), so vitest cannot write results cache.

**Impact:** automation/CI treats this as failure (exit code 1) despite passing tests.

**Suggested fix direction (owner):** ensure `.vite` cache dir is user-writable (ownership/permissions), or configure vitest cache/results output to a writable location.

## C) MINOR: Verification commands must run from `/app/agents`

Git repo and node tooling are under `/app/agents` (not `/app`). Running git/tsc/vitest from `/app` fails with “not a git repository” / missing `node_modules/.bin/*`.
