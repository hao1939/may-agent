# QA Heartbeat — Unreviewed Findings (2026-04-23)

## Scope
Reviewed most recent change in the **agents** repo (commit `e44348dd7`) affecting the project health handler.

## Findings
### 1) Environment/test suite drift: 4 failing vitest suites due to missing modules (CRITICAL for test reliability)
Running vitest in `/app/agents` currently fails because several test files import modules that do not exist in `agents/src/lib/*`.

Evidence (vitest output):
- `test/lessons.test.ts`: cannot find `../src/lib/lessons.ts`
- `test/ops-gate.test.ts`: cannot find `../src/lib/ops-gate.js`
- `test/orders.test.ts`: cannot find `../src/lib/orders.js`
- `test/security.test.ts`: cannot find `../src/lib/tools/security.js`

`agents/src/lib` currently contains only:
- `edit-guard.ts`, `finish-guard.ts`, `path-guard.ts`, `project-health.ts`

Impact:
- Breaks the repo’s ability to use vitest as a gate.
- Makes it hard to verify new changes with the mandatory QA steps.

Recommendation:
- Either restore the missing modules, update test imports/paths to match current code layout, or remove/skip obsolete tests.

### 2) Potential bug in `project-health.ts` persistence helpers (IMPORTANT)
In `agents/shared/lib/project-health.ts`, the persistence helpers use `mkdirSync(join(file, ".."), { recursive: true })`. This is likely intended to create the parent directory of `file`, but `join(file, "..")` is an odd pattern and depends on path normalization.

Safer would be `dirname(file)`.

Evidence:
- File: `agents/shared/lib/project-health.ts` (in `writeHealthState` and `writeInflight`)

Impact:
- Could fail to create the intended directory in edge cases; state writes are silently swallowed (`catch { /* best effort */ }`), which could hide errors.

## Verified file reads
- `agents/may/handlers/project.ts` (read lines 1–260)
- `agents/shared/lib/project-health.ts` (read lines 1–380)
