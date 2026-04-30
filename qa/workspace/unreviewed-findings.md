# QA Heartbeat — Unreviewed Findings (2026-04-30)

## 1) TypeScript build is failing (duplicate export names)

**Evidence (reproduced):** `cd agents && ./node_modules/.bin/tsc --noEmit` fails with:
- `shared/lib/index.ts(13,1): error TS2308: Module './iteration-monitor.js' has already exported a member named 'IterationRecord'.`
- `shared/lib/index.ts(16,1): error TS2308: Module './task-validator.js' has already exported a member named 'ValidationResult'.`

**Confirmed code location:** `agents/shared/lib/index.ts` is a barrel file with many `export * from ...` statements (see file content below).

**Likely cause (needs fix by owner):** `shared/lib/index.ts` barrel re-exports multiple modules that export identically named types (e.g., `IterationRecord`, `ValidationResult`), creating ambiguity at the barrel level. Mitigations:
- Avoid `export *` for modules with overlapping exported names.
- Explicitly re-export types with unique names or namespace exports.

**Files involved:**
- `agents/shared/lib/index.ts`

## 2) Vitest test suite passes, but exits non-zero due to EACCES writing results cache

**Evidence (reproduced):** `cd agents && ./node_modules/.bin/vitest --run`:
- Reports: `Test Files 31 passed (31)`, `Tests 536 passed (536)`
- Then unhandled error: `Error: EACCES: permission denied, open '/app/agents/node_modules/.vite/vitest/results.json'`

**Confirmed root cause:** `agents/node_modules/.vite` and `agents/node_modules/.vite/vitest` are owned by `root:root` (not writable by the running user), so vitest cannot write its results cache.

**Impact:** CI/automation will treat this as failure (exit code 1) despite green tests.

**Likely fix (needs fix by owner):** ensure `agents/node_modules/.vite/**` is writable for the executing user (ownership/permissions), or configure vitest cache/results output to a writable location.

## 3) Repo/root mismatch can break verification commands

**Evidence:** Git repo + node tooling are under `/app/agents` (not `/app`). Running checks from `/app` fails with “not a git repository” / missing `node_modules/.bin/*`.

---

### Evidence snippet: `agents/shared/lib/index.ts`

```
/**
 * Shared library barrel exports
 * Import from '@shared/lib' to access all shared utilities.
 */

export * from './hao-alignment/index.js';
export * from './growth.js';
export * from './project-health.js';
export * from './task-validator.js';
export * from './task-template.js';
export * from './iteration-monitor.js';
export * from './project-template.js';
export * from './session-analyzer.js';
export * from './regression-detector.js';
export * from './workflow-metrics.js';
export * from './config-validator.js';
export * from './cost-tracker.js';
export * from './prompt-builder.js';
```
