# Unreviewed findings (QA heartbeat)

## Context
Latest commit in `/app/agents` is `c82e69779` (validate-on-create workflow hook).

## Findings

### CRITICAL — `tsc --noEmit` fails in agents repo
Running TypeScript compile in `/app/agents` currently fails with duplicate export names in the shared barrel export:

```
shared/lib/index.ts(13,1): error TS2308: Module './iteration-monitor.js' has already exported a member named 'IterationRecord'.
shared/lib/index.ts(15,1): error TS2308: Module './iteration-monitor.js' has already exported a member named 'IterationRecord'.
shared/lib/index.ts(16,1): error TS2308: Module './task-validator.js' has already exported a member named 'ValidationResult'.
```

Evidence:
- `cd agents && ./node_modules/.bin/tsc --noEmit --pretty false`

Likely cause:
- Multiple modules export the same symbol names (`IterationRecord` appears in `iteration-monitor.ts`, `session-analyzer.ts`, `workflow-metrics.ts`; `ValidationResult` appears in `config-validator.ts` and `task-validator.ts`) and `shared/lib/index.ts` re-exports all of them via `export *`.

Impact:
- Consumers importing types from `@shared/lib` will have ambiguous/duplicate exports; TypeScript compilation fails.

Suggested fix direction (not implemented here):
- Rename the conflicting exported types in their modules, or stop `export *`-re-exporting conflicting names and instead explicitly export with aliases.

### Notes
- Test suite still passes: `cd agents && ./node_modules/.bin/vitest --run` (536 tests).
