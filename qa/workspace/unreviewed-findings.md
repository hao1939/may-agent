# Unreviewed findings (QA heartbeat)

## Context
Reviewed latest commit in `agents` repo: `43c316141 optimizer: add regression-detector utility with 7 tests and barrel export`.

## Automated checks
- `tsc --noEmit`: **FAIL** (barrel export type name collisions)
- `vitest --run`: **PASS** (31 files, 536 tests)

## Findings
### CRITICAL: TypeScript build broken due to duplicate exported type names
`agents/shared/lib/index.ts` barrels multiple modules that export the same type names, causing TS2308 ambiguity errors.

Evidence:
- `./node_modules/.bin/tsc --noEmit` fails with:
  - `shared/lib/index.ts(13,1): error TS2308: Module './iteration-monitor.js' has already exported a member named 'IterationRecord'.`
  - `shared/lib/index.ts(16,1): error TS2308: Module './task-validator.js' has already exported a member named 'ValidationResult'.`

Root cause evidence:
- `IterationRecord` is exported in multiple modules:
  - `shared/lib/session-analyzer.ts`
  - `shared/lib/iteration-monitor.ts`
  - `shared/lib/workflow-metrics.ts`
- `ValidationResult` is exported in multiple modules:
  - `shared/lib/config-validator.ts`
  - `shared/lib/task-validator.ts`

Impact:
- Any consumer importing from `@shared/lib` (barrel) will have ambiguous exports; `tsc` fails, so this is a ship-blocker.

Suggested remediation:
- Rename one or more of the conflicting interfaces, or stop re-exporting conflicting names from the barrel.
- Alternatively, explicitly re-export with aliases in `shared/lib/index.ts`, e.g. `export type { ValidationResult as TaskValidationResult } from './task-validator.js'` and avoid `export *` for those modules.
