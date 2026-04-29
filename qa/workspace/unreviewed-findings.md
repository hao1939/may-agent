# QA Heartbeat — Unreviewed Findings (2026-04-29)

## Context
Reviewed recent change `8e04cab0d` (agents repo): added `shared/workflows/health-check.ts` and related shared tests/config.

## Findings

### CRITICAL — Test suite failure in agents repo
- Running Vitest in `/app/agents` fails:
  - `test/health-check.test.ts`: 36/36 tests fail
  - `test/workflow-runner.test.ts`: 1 test fails
- Failure mode: imports expected symbols from `../shared/workflows/health-check.js` but `shared/workflows/health-check.ts` only exports `runHealthCheck` and `WORKFLOW_MODULES`. Missing exports (or incorrect import path) cause runtime `TypeError: <fn> is not a function` for:
  - `isAtTarget`, `parseMetrics`, `extractLastActivity`, `isStalled`, `analyzeProject`, `checkHealth`.

**Evidence:** `./node_modules/.bin/vitest --run` output shows 37 failed tests, all `TypeError: ... is not a function`.

### IMPORTANT — Silent error handling in health-check workflow
In `agents/shared/workflows/health-check.ts`, several helpers swallow errors:
- `checkTestFileCount`: `catch {}`
- `checkOutputFileCount`: `catch {}`
- `checkSatelliteProjects`: `catch {}`

This makes failures indistinguishable from legitimate “0 files” results; consider at least capturing error text in `details`.

**Evidence:** `agents/shared/workflows/health-check.ts` contains empty catch blocks.

## Suggested next steps (for implementer)
1. Align `shared/workflows/health-check.ts` exports with what the tests and `workflow-runner` expect (either implement/export the missing functions or update tests/imports to match the intended API).
2. Re-run `./node_modules/.bin/vitest --run` until green.
3. Consider replacing empty `catch {}` blocks with error details in check results.
