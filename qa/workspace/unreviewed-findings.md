# QA Heartbeat — Unreviewed Findings (2026-04-30)

## Scope
Reviewed most recent commit in `/app/agents` repo:
- `32f041e48 may: hao-alignment moved to waiting/P2 — infrastructure complete, data-starved`

## Findings
### 1) TypeScript build broken due to ambiguous barrel re-exports (CRITICAL)
- Running `./node_modules/.bin/tsc --noEmit` fails:
  - `shared/lib/index.ts(13,1): error TS2308: Module './iteration-monitor.js' has already exported a member named 'IterationRecord'.`
  - `shared/lib/index.ts(16,1): error TS2308: Module './task-validator.js' has already exported a member named 'ValidationResult'.`
- Evidence:
  - `agents/shared/lib/index.ts` currently does `export * from './task-validator.js';` and `export * from './iteration-monitor.js';`.
  - `shared/lib/iteration-monitor.ts` exports `IterationRecord`.
  - `shared/lib/task-validator.ts` exports `ValidationResult`.

Likely another export chain (possibly `shared/lib/hao-alignment/index.js` or other barrels) also re-exports these types, causing duplicates in the final barrel.

**Impact:** TypeScript consumers importing from `@shared/lib` will fail to compile; CI/build gate would block.

**Recommendation:** Make `shared/lib/index.ts` avoid `export *` for the colliding modules and instead explicitly re-export (or rename) the types/functions, or remove the duplicate upstream exports.

### 2) Test suite passes, so runtime behavior likely unaffected (MINOR)
- `./node_modules/.bin/vitest --run` passes: **31 files, 536 tests**.
- This suggests the duplicate export problem is type-checking only (TS compilation), not runtime JS.

## Notes
- `rg` is not installed in this environment; used `grep` and `sed` for inspection.
